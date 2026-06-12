import { getServerUrl, getToken } from '../auth/sessionStore';
import type { InstalledApp } from '../types/catalog';

const AGENT_URL_KEY = 'echo_app_center_agent_url';

export type DownloadJob = {
  id: string;
  appId: string;
  action: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
};

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

export async function testAgent(): Promise<{ ok: boolean; product: string; version: string }> {
  return agentRequest('/health');
}

export async function listInstalledApps(): Promise<InstalledApp[]> {
  const data = await agentRequest<{ apps: InstalledApp[] }>('/api/installed-apps');
  return data.apps;
}

export async function listDownloads(): Promise<DownloadJob[]> {
  const data = await agentRequest<{ jobs: DownloadJob[] }>('/api/downloads');
  return data.jobs;
}

export async function installApp(appId: string, platform: string, channel = 'stable'): Promise<DownloadJob> {
  const data = await agentRequest<{ job: DownloadJob }>('/api/install', {
    method: 'POST',
    body: JSON.stringify({ appId, platform, channel, serverUrl: getServerUrl(), token: getToken() }),
  });
  return data.job;
}

export async function updateApp(appId: string, platform: string, channel = 'stable'): Promise<DownloadJob> {
  const data = await agentRequest<{ job: DownloadJob }>('/api/update', {
    method: 'POST',
    body: JSON.stringify({ appId, platform, channel, serverUrl: getServerUrl(), token: getToken() }),
  });
  return data.job;
}

export async function repairApp(appId: string, platform: string, channel = 'stable'): Promise<DownloadJob> {
  const data = await agentRequest<{ job: DownloadJob }>('/api/repair', {
    method: 'POST',
    body: JSON.stringify({ appId, platform, channel, serverUrl: getServerUrl(), token: getToken() }),
  });
  return data.job;
}

export async function uninstallApp(appId: string): Promise<void> {
  await agentRequest(`/api/apps/${appId}/uninstall`, { method: 'POST' });
}

export async function launchApp(appId: string): Promise<void> {
  await agentRequest(`/api/apps/${appId}/launch`, { method: 'POST' });
}

export async function checkInClient(): Promise<void> {
  await agentRequest('/api/check-in', { method: 'POST', body: JSON.stringify({ serverUrl: getServerUrl(), token: getToken() }) });
}
