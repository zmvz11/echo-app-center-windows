import { getServerUrl, getToken, setToken, clearToken } from '../auth/sessionStore';
import type { CurrentUser } from '../types/auth';
import type { EchoApp, AppRelease } from '../types/catalog';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${getServerUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Server request failed: ${response.status}`);
  return data as T;
}

async function multipartRequest<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const response = await fetch(`${getServerUrl()}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Server upload failed: ${response.status}`);
  return data as T;
}

export async function testServerUrl(url: string): Promise<{ product: string; version: string }> {
  const response = await fetch(`${url.replace(/\/$/, '')}/health`);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error('Server did not respond as Echo App Server.');
  return data;
}

export async function setupStatus(): Promise<{ needsOwner: boolean }> {
  return request('/api/setup/status');
}

export async function createOwner(input: { username: string; displayName?: string; password: string }): Promise<CurrentUser> {
  const data = await request<{ user: CurrentUser; token: string }>('/api/setup/owner', { method: 'POST', body: JSON.stringify(input) });
  setToken(data.token);
  return data.user;
}

export async function login(input: { username: string; password: string }): Promise<CurrentUser> {
  const data = await request<{ user: CurrentUser; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
  setToken(data.token);
  return data.user;
}

export async function register(input: { username: string; displayName?: string; password: string; requestNote?: string }): Promise<void> {
  await request('/api/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export async function me(): Promise<CurrentUser> {
  const data = await request<{ user: CurrentUser }>('/api/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  try { await request('/api/auth/logout', { method: 'POST' }); } finally { clearToken(); }
}

export async function getCatalog(): Promise<EchoApp[]> {
  const data = await request<{ apps: EchoApp[] }>('/api/catalog');
  return data.apps;
}

export async function getAdminApps(): Promise<EchoApp[]> {
  const data = await request<{ apps: EchoApp[] }>('/api/apps/admin/all');
  return data.apps;
}

export async function getPendingUsers(): Promise<any[]> {
  const data = await request<{ users: any[] }>('/api/admin/users/pending');
  return data.users;
}

export async function approveUser(id: string): Promise<void> {
  await request(`/api/admin/users/${id}/approve`, { method: 'POST' });
}

export async function createApp(input: Partial<EchoApp> & { id: string; name: string }): Promise<EchoApp> {
  const data = await request<{ app: EchoApp }>('/api/apps/admin/create', { method: 'POST', body: JSON.stringify(input) });
  return data.app;
}

export async function updateAppAdmin(id: string, input: Partial<EchoApp>): Promise<EchoApp> {
  const data = await request<{ app: EchoApp }>(`/api/apps/admin/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  return data.app;
}

export async function addMedia(appId: string, input: { type: string; url: string; sortOrder: number }): Promise<void> {
  await request(`/api/apps/admin/${appId}/media`, { method: 'POST', body: JSON.stringify(input) });
}

export async function uploadMedia(appId: string, input: { type: string; sortOrder: number; file: File }): Promise<void> {
  const form = new FormData();
  form.set('type', input.type);
  form.set('sortOrder', String(input.sortOrder));
  form.set('file', input.file);
  await multipartRequest(`/api/apps/admin/${appId}/media/upload`, form);
}

export async function getReleases(): Promise<AppRelease[]> {
  const data = await request<{ releases: AppRelease[] }>('/api/releases/admin');
  return data.releases;
}

export async function createRelease(appId: string, input: Partial<AppRelease>): Promise<AppRelease> {
  const data = await request<{ release: AppRelease }>(`/api/releases/admin/apps/${appId}/releases`, { method: 'POST', body: JSON.stringify(input) });
  return data.release;
}

export async function uploadReleasePackage(appId: string, input: { file: File; version: string; channel: string; platform: string; entrypoint: string; installType: string; changelog: string }): Promise<AppRelease> {
  const form = new FormData();
  form.set('file', input.file);
  form.set('version', input.version);
  form.set('channel', input.channel);
  form.set('platform', input.platform);
  form.set('entrypoint', input.entrypoint);
  form.set('installType', input.installType);
  form.set('changelog', input.changelog);
  const data = await multipartRequest<{ release: AppRelease }>(`/api/releases/admin/apps/${appId}/releases/upload`, form);
  return data.release;
}

export async function submitRelease(id: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/submit-review`, { method: 'POST' }); }
export async function approveRelease(id: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/approve`, { method: 'POST' }); }
export async function publishRelease(id: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/publish`, { method: 'POST' }); }
export async function rollbackRelease(id: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/rollback`, { method: 'POST' }); }
export async function rejectRelease(id: string, reason: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); }

export async function getClients(): Promise<{ clients: any[]; installReports: any[] }> {
  return request('/api/clients/admin');
}

export async function getAuditLogs(): Promise<any[]> {
  const data = await request<{ logs: any[] }>('/api/logs/admin');
  return data.logs;
}

export async function getServerRuntimeSettings(): Promise<any> {
  const data = await request<{ settings: any }>('/api/admin/server/settings');
  return data.settings;
}
