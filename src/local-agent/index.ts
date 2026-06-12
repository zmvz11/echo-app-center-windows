import express from 'express';
import cors from 'cors';
import AdmZip from 'adm-zip';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, hostname, platform as osPlatform } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const AGENT_PORT = Number(process.env.ECHO_AGENT_PORT ?? 17888);
const AGENT_HOST = process.env.ECHO_AGENT_HOST ?? '127.0.0.1';
const APP_CENTER_VERSION = '1.0.0';
const DEFAULT_INSTALL_ROOT = process.env.ECHO_INSTALL_ROOT ?? join(homedir(), 'EchoApps');
const DATA_DIR = process.env.ECHO_AGENT_DATA_DIR ?? join(homedir(), '.echo-app-center');
const STATE_PATH = join(DATA_DIR, 'local-state.json');
const DOWNLOAD_DIR = join(DATA_DIR, 'downloads');

type InstalledApp = { appId: string; name: string; version: string; platform: string; installPath: string; entrypoint: string; installedAt: string; updatedAt: string; status: 'installed' | 'broken' };
type Job = { id: string; appId: string; action: string; status: 'queued' | 'running' | 'succeeded' | 'failed'; progress: number; message: string; createdAt: string; updatedAt: string };
type State = { clientId: string; installRoots: string[]; installedApps: InstalledApp[]; jobs: Job[] };

function now() { return new Date().toISOString(); }
function makeId(prefix: string) { return `${prefix}_${randomBytes(8).toString('hex')}`; }
function ensureDirs() { mkdirSync(DATA_DIR, { recursive: true }); mkdirSync(DOWNLOAD_DIR, { recursive: true }); mkdirSync(DEFAULT_INSTALL_ROOT, { recursive: true }); }
function readState(): State { ensureDirs(); if (!existsSync(STATE_PATH)) { const initial: State = { clientId: makeId('client'), installRoots: [DEFAULT_INSTALL_ROOT], installedApps: [], jobs: [] }; writeState(initial); return initial; } return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as State; }
function writeState(state: State) { ensureDirs(); writeFileSync(STATE_PATH, JSON.stringify(state, null, 2)); }
function updateState<T>(fn: (state: State) => T): T { const state = readState(); const result = fn(state); writeState(state); return result; }
function setJob(job: Job, patch: Partial<Job>) { Object.assign(job, patch, { updatedAt: now() }); updateState((state) => { const idx = state.jobs.findIndex((item) => item.id === job.id); if (idx >= 0) state.jobs[idx] = job; else state.jobs.unshift(job); state.jobs = state.jobs.slice(0, 100); }); }
function makeJob(appId: string, action: string): Job { const job = { id: makeId('job'), appId, action, status: 'queued' as const, progress: 0, message: 'Queued', createdAt: now(), updatedAt: now() }; updateState((state) => state.jobs.unshift(job)); return job; }
function appPlatform(): string { return osPlatform() === 'win32' ? 'windows-x64' : 'linux-x64'; }
async function downloadFile(url: string, outputPath: string) { const response = await fetch(url); if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`); const buffer = Buffer.from(await response.arrayBuffer()); writeFileSync(outputPath, buffer); }
async function serverRequest<T>(serverUrl: string, path: string, token?: string, init: RequestInit = {}): Promise<T> { const response = await fetch(`${serverUrl.replace(/\/$/, '')}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? `Server request failed: ${response.status}`); return data as T; }
async function report(serverUrl: string, token: string | undefined, clientId: string, appId: string, action: any, status: any, message?: string, version?: string) { try { await serverRequest(serverUrl, '/api/clients/report', token, { method: 'POST', body: JSON.stringify({ clientId, appId, action, status, message, version }) }); } catch { /* non-blocking */ } }

type InstallInput = { appId: string; platform?: string; channel?: string; serverUrl: string; token?: string; installRoot?: string };
async function installOrRepair(input: InstallInput, action: 'install' | 'update' | 'repair'): Promise<Job> {
  const job = makeJob(input.appId, action);
  const state = readState();
  report(input.serverUrl, input.token, state.clientId, input.appId, action, 'started');
  void (async () => {
    try {
      setJob(job, { status: 'running', progress: 10, message: 'Requesting latest release' });
      const platform = input.platform || appPlatform();
      const channel = input.channel || 'stable';
      const latest = await serverRequest<{ release: any }>(input.serverUrl, `/api/catalog/latest/${input.appId}?platform=${encodeURIComponent(platform)}&channel=${encodeURIComponent(channel)}`, input.token);
      const release = latest.release;
      setJob(job, { progress: 25, message: 'Downloading package' });
      const filePath = join(DOWNLOAD_DIR, `${input.appId}-${release.version}-${basename(release.packageUrl.split('?')[0]) || 'package.zip'}`);
      await downloadFile(release.packageUrl, filePath);
      setJob(job, { progress: 55, message: 'Extracting package' });
      const installRoot = resolve(input.installRoot || state.installRoots[0] || DEFAULT_INSTALL_ROOT);
      const appDir = join(installRoot, 'apps', input.appId);
      const previousDir = join(installRoot, 'backups', input.appId, `${Date.now()}`);
      if (existsSync(appDir)) { mkdirSync(dirname(previousDir), { recursive: true }); rmSync(previousDir, { recursive: true, force: true }); }
      rmSync(appDir, { recursive: true, force: true });
      mkdirSync(appDir, { recursive: true });
      const zip = new AdmZip(filePath);
      zip.extractAllTo(appDir, true);
      let entrypoint = release.entrypoint;
      const manifestPath = join(appDir, 'echo-app.json');
      let appName = input.appId;
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: string; entry?: { windows?: string; linux?: string } | string };
        appName = manifest.name || appName;
        if (typeof manifest.entry === 'string') entrypoint = manifest.entry;
        if (typeof manifest.entry === 'object') entrypoint = osPlatform() === 'win32' ? manifest.entry.windows || entrypoint : manifest.entry.linux || entrypoint;
      }
      const entryPath = join(appDir, entrypoint);
      if (osPlatform() !== 'win32' && existsSync(entryPath)) chmodSync(entryPath, 0o755);
      const installed: InstalledApp = { appId: input.appId, name: appName, version: release.version, platform, installPath: appDir, entrypoint, installedAt: now(), updatedAt: now(), status: 'installed' };
      updateState((next) => { const idx = next.installedApps.findIndex((app) => app.appId === input.appId); if (idx >= 0) next.installedApps[idx] = { ...next.installedApps[idx], ...installed, installedAt: next.installedApps[idx].installedAt }; else next.installedApps.push(installed); });
      setJob(job, { status: 'succeeded', progress: 100, message: `${action} completed` });
      report(input.serverUrl, input.token, state.clientId, input.appId, action, 'succeeded', `${action} completed`, release.version);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${action} failed`;
      setJob(job, { status: 'failed', progress: 100, message });
      report(input.serverUrl, input.token, state.clientId, input.appId, action, 'failed', message);
    }
  })();
  return job;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, product: 'Echo App Center Local Agent', version: APP_CENTER_VERSION }));
app.get('/api/installed-apps', (_req, res) => res.json({ apps: readState().installedApps }));
app.get('/api/downloads', (_req, res) => res.json({ jobs: readState().jobs }));
app.get('/api/install-locations', (_req, res) => res.json({ locations: readState().installRoots }));
app.post('/api/install-locations', (req, res) => { const path = String(req.body.path ?? '').trim(); if (!path) return res.status(400).json({ error: 'Path is required.' }); const locations = updateState((state) => { if (!state.installRoots.includes(path)) state.installRoots.push(path); return state.installRoots; }); res.json({ locations }); });
app.post('/api/install', async (req, res) => res.status(202).json({ job: await installOrRepair(req.body, 'install') }));
app.post('/api/update', async (req, res) => res.status(202).json({ job: await installOrRepair(req.body, 'update') }));
app.post('/api/repair', async (req, res) => res.status(202).json({ job: await installOrRepair(req.body, 'repair') }));
app.post('/api/apps/:id/uninstall', (req, res) => { const state = readState(); const installed = state.installedApps.find((item) => item.appId === req.params.id); if (installed) rmSync(installed.installPath, { recursive: true, force: true }); updateState((next) => { next.installedApps = next.installedApps.filter((item) => item.appId !== req.params.id); }); res.json({ ok: true }); });
app.post('/api/apps/:id/launch', (req, res) => { const installed = readState().installedApps.find((item) => item.appId === req.params.id); if (!installed) return res.status(404).json({ error: 'App is not installed.' }); const command = join(installed.installPath, installed.entrypoint); if (osPlatform() !== 'win32' && existsSync(command)) chmodSync(command, 0o755); if (!existsSync(command)) return res.status(404).json({ error: `Entrypoint not found: ${command}` }); const child = spawn(command, [], { detached: true, stdio: 'ignore', shell: osPlatform() === 'win32' }); child.unref(); res.json({ ok: true }); });
app.post('/api/check-in', async (req, res) => { const state = readState(); const serverUrl = String(req.body.serverUrl ?? ''); const token = String(req.body.token ?? ''); if (!serverUrl) return res.status(400).json({ error: 'Server URL is required.' }); const platform = appPlatform(); const registered = await serverRequest<{ client: any }>(serverUrl, '/api/clients/register', token, { method: 'POST', body: JSON.stringify({ id: state.clientId, name: hostname(), platform, appCenterVersion: APP_CENTER_VERSION, serverUrl }) }); await serverRequest(serverUrl, `/api/clients/${registered.client.id}/check-in`, token, { method: 'POST', body: JSON.stringify({ installedApps: state.installedApps.map((item) => ({ appId: item.appId, version: item.version, platform: item.platform, installPath: item.installPath, status: item.status })) }) }); res.json({ ok: true, client: registered.client }); });

export function startLocalAgent() {
  return app.listen(AGENT_PORT, AGENT_HOST, () => console.log(`Echo App Center Local Agent listening on http://${AGENT_HOST}:${AGENT_PORT}`));
}

if (process.env.ECHO_AGENT_AUTOSTART !== 'false') {
  startLocalAgent();
}

