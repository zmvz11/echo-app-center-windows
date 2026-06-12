import { getDownloadLocationPreference, getServerUrl, getToken } from '../auth/sessionStore';
import type { InstalledApp } from '../types/catalog';

const AGENT_URL_KEY = 'echo_app_center_agent_url';

export type DownloadJob = {
  id: string;
  appId: string;
  action: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
};

export type VerifyReport = { ok: boolean; appId: string; checkedAt: string; issues: string[]; installPath?: string; entrypoint?: string };
export type AgentInstallLocation = { id: string; path: string; isDefault: boolean };

export function getAgentUrl(): string {
  return localStorage.getItem(AGENT_URL_KEY) || 'http://127.0.0.1:17888';
}

export function setAgentUrl(url: string): void {
  localStorage.setItem(AGENT_URL_KEY, url.replace(/\/$/, ''));
}

async function agentRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getAgentUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Local agent request failed: ${response.status}`);
  return data as T;
}

export async function testAgent(): Promise<{ ok: boolean; product: string; version: string }> { return agentRequest('/health'); }
export async function listInstalledApps(): Promise<InstalledApp[]> { const data = await agentRequest<{ apps: InstalledApp[] }>('/api/installed-apps'); return data.apps; }
export async function listDownloads(): Promise<DownloadJob[]> { const data = await agentRequest<{ jobs: DownloadJob[] }>('/api/downloads'); return data.jobs; }
export async function cancelDownloadJob(id: string): Promise<DownloadJob> { const data = await agentRequest<{ job: DownloadJob }>(`/api/downloads/${id}/cancel`, { method: 'POST' }); return data.job; }
export async function clearCompletedDownloads(): Promise<DownloadJob[]> { const data = await agentRequest<{ jobs: DownloadJob[] }>('/api/downloads/clear-completed', { method: 'POST' }); return data.jobs; }
export async function listAgentInstallLocations(): Promise<AgentInstallLocation[]> { const data = await agentRequest<{ locations: AgentInstallLocation[] }>('/api/install-locations'); return data.locations; }
export async function addAgentInstallLocation(path: string): Promise<AgentInstallLocation[]> { const data = await agentRequest<{ locations: AgentInstallLocation[] }>('/api/install-locations', { method: 'POST', body: JSON.stringify({ path }) }); return data.locations; }
export async function makeDefaultAgentInstallLocation(path: string): Promise<AgentInstallLocation[]> { const data = await agentRequest<{ locations: AgentInstallLocation[] }>('/api/install-locations/default', { method: 'POST', body: JSON.stringify({ path }) }); return data.locations; }
export async function removeAgentInstallLocation(path: string): Promise<AgentInstallLocation[]> { const data = await agentRequest<{ locations: AgentInstallLocation[] }>('/api/install-locations/remove', { method: 'POST', body: JSON.stringify({ path }) }); return data.locations; }

export async function installApp(appId: string, platform: string, channel = 'stable', installRoot?: string): Promise<DownloadJob> {
  const download = getDownloadLocationPreference();
  const data = await agentRequest<{ job: DownloadJob }>('/api/install', { method: 'POST', body: JSON.stringify({ appId, platform, channel, installRoot, serverUrl: getServerUrl(), token: getToken(), downloadNodeId: download.id, downloadBaseUrl: download.baseUrl }) });
  return data.job;
}
export async function updateApp(appId: string, platform: string, channel = 'stable', installRoot?: string): Promise<DownloadJob> {
  const download = getDownloadLocationPreference();
  const data = await agentRequest<{ job: DownloadJob }>('/api/update', { method: 'POST', body: JSON.stringify({ appId, platform, channel, installRoot, serverUrl: getServerUrl(), token: getToken(), downloadNodeId: download.id, downloadBaseUrl: download.baseUrl }) });
  return data.job;
}
export async function repairApp(appId: string, platform: string, channel = 'stable', installRoot?: string): Promise<DownloadJob> {
  const download = getDownloadLocationPreference();
  const data = await agentRequest<{ job: DownloadJob }>('/api/repair', { method: 'POST', body: JSON.stringify({ appId, platform, channel, installRoot, serverUrl: getServerUrl(), token: getToken(), downloadNodeId: download.id, downloadBaseUrl: download.baseUrl }) });
  return data.job;
}
export async function verifyApp(appId: string): Promise<VerifyReport> { const data = await agentRequest<{ report: VerifyReport }>(`/api/apps/${appId}/verify`, { method: 'POST' }); return data.report; }
export async function openInstallFolder(appId: string): Promise<void> { await agentRequest(`/api/apps/${appId}/open-folder`, { method: 'POST' }); }
export async function moveInstalledApp(appId: string, installRoot: string): Promise<InstalledApp> { const data = await agentRequest<{ app: InstalledApp }>(`/api/apps/${appId}/move`, { method: 'POST', body: JSON.stringify({ installRoot }) }); return data.app; }
export async function uninstallApp(appId: string): Promise<void> { await agentRequest(`/api/apps/${appId}/uninstall`, { method: 'POST' }); }
export async function launchApp(appId: string): Promise<void> { await agentRequest(`/api/apps/${appId}/launch`, { method: 'POST' }); }
export async function checkInClient(): Promise<void> { await agentRequest('/api/check-in', { method: 'POST', body: JSON.stringify({ serverUrl: getServerUrl(), token: getToken() }) }); }
