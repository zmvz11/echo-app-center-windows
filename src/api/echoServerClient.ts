import { getServerUrl, getToken, setToken, clearToken } from '../auth/sessionStore';
import type { CurrentUser } from '../types/auth';
import type { EchoApp, AppRelease, StoreSection, GitHubAppSource, PackageValidationReport, DownloadLocation, EchoNode, EchoNodeRequest, NodeAdminState, NodePermissions } from '../types/catalog';

const DEFAULT_TIMEOUT_MS = 6000;
const CONNECT_TIMEOUT_MS = 3000;
const UPLOAD_TIMEOUT_MS = 60000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function explainMissingRoute(path: string, status: number): string {
  if (status === 404 && (path.startsWith('/api/store') || path.startsWith('/api/releases/admin') || path.includes('/github-source') || path.includes('/media/upload') || path.includes('/apps/admin'))) {
    return 'Server request failed: 404. Echo App Server is missing the Store/Add Apps API routes. Update and restart Echo App Server, then try again.';
  }
  return `Server request failed: ${status}`;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('Server connection timed out. Check the IP address, port, and that Echo App Server is running.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const token = getToken();
  const response = await fetchWithTimeout(`${getServerUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? explainMissingRoute(path, response.status));
  return data as T;
}

async function multipartRequest<T>(path: string, form: FormData, timeoutMs = UPLOAD_TIMEOUT_MS): Promise<T> {
  const token = getToken();
  const response = await fetchWithTimeout(`${getServerUrl()}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? explainMissingRoute(path, response.status));
  return data as T;
}

export async function testServerUrl(url: string): Promise<{ product: string; version: string }> {
  const response = await fetchWithTimeout(`${url.replace(/\/$/, '')}/health`, {}, CONNECT_TIMEOUT_MS);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error('Server did not respond as Echo App Server.');
  return data;
}

export async function setupStatus(): Promise<{ needsOwner: boolean }> { return request('/api/setup/status'); }

export async function createOwner(input: { username: string; displayName?: string; password: string }, remember = true): Promise<CurrentUser> {
  const data = await request<{ user: CurrentUser; token: string }>('/api/setup/owner', { method: 'POST', body: JSON.stringify(input) });
  setToken(data.token, remember);
  return data.user;
}

export async function login(input: { username: string; password: string }, remember = false): Promise<CurrentUser> {
  const data = await request<{ user: CurrentUser; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
  setToken(data.token, remember);
  return data.user;
}

export async function register(input: { username: string; displayName?: string; password: string; requestNote?: string }): Promise<void> {
  await request('/api/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export async function me(): Promise<CurrentUser> { const data = await request<{ user: CurrentUser }>('/api/auth/me'); return data.user; }
export async function logout(): Promise<void> { try { await request('/api/auth/logout', { method: 'POST' }, 2000); } finally { clearToken(); } }

export async function getCatalog(): Promise<EchoApp[]> { const data = await request<{ apps: EchoApp[] }>('/api/catalog'); return data.apps; }
export async function getStoreApps(): Promise<EchoApp[]> { const data = await request<{ apps: EchoApp[] }>('/api/store/apps'); return data.apps; }
export async function getFeaturedApps(): Promise<EchoApp[]> { const data = await request<{ apps: EchoApp[] }>('/api/store/featured'); return data.apps; }
export async function getStoreSections(): Promise<StoreSection[]> { const data = await request<{ sections: StoreSection[] }>('/api/store/sections'); return data.sections; }
export async function getStoreCategories(): Promise<string[]> { const data = await request<{ categories: string[] }>('/api/store/categories'); return data.categories; }
export async function getStoreApp(id: string): Promise<EchoApp> { const data = await request<{ app: EchoApp }>(`/api/store/apps/${id}`); return data.app; }

export async function getAdminApps(): Promise<EchoApp[]> { const data = await request<{ apps: EchoApp[] }>('/api/apps/admin/all'); return data.apps; }
export async function getPendingUsers(): Promise<any[]> { const data = await request<{ users: any[] }>('/api/admin/users/pending'); return data.users; }
export async function approveUser(id: string): Promise<void> { await request(`/api/admin/users/${id}/approve`, { method: 'POST' }); }

export async function createApp(input: Partial<EchoApp> & { id: string; name: string }): Promise<EchoApp> {
  const data = await request<{ app: EchoApp }>('/api/apps/admin/create', { method: 'POST', body: JSON.stringify(input) });
  return data.app;
}

export async function updateAppAdmin(id: string, input: Partial<EchoApp>): Promise<EchoApp> {
  const data = await request<{ app: EchoApp }>(`/api/apps/admin/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  return data.app;
}

export async function setAppFeatured(id: string, featured: boolean): Promise<EchoApp> {
  const data = await request<{ app: EchoApp }>(`/api/apps/admin/${id}/featured`, { method: 'PATCH', body: JSON.stringify({ featured }) });
  return data.app;
}

export async function setAppVisibility(id: string, visibility: string): Promise<EchoApp> {
  const data = await request<{ app: EchoApp }>(`/api/apps/admin/${id}/visibility`, { method: 'PATCH', body: JSON.stringify({ visibility }) });
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

export async function getReleases(): Promise<AppRelease[]> { const data = await request<{ releases: AppRelease[] }>('/api/releases/admin'); return data.releases; }
export async function createRelease(appId: string, input: Partial<AppRelease>): Promise<AppRelease> {
  const data = await request<{ release: AppRelease }>(`/api/releases/admin/apps/${appId}/releases`, { method: 'POST', body: JSON.stringify(input) });
  return data.release;
}


export async function validateReleasePackage(input: { file: File; version: string; channel: string; platform: string; entrypoint: string; installType: string }): Promise<PackageValidationReport> {
  const form = new FormData();
  form.set('file', input.file);
  form.set('version', input.version);
  form.set('channel', input.channel);
  form.set('platform', input.platform);
  form.set('entrypoint', input.entrypoint);
  form.set('installType', input.installType);
  const data = await multipartRequest<{ report: PackageValidationReport }>('/api/releases/admin/package/validate', form, 60000);
  return data.report;
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
  const data = await multipartRequest<{ release: AppRelease }>(`/api/releases/admin/apps/${appId}/releases/upload`, form, 120000);
  return data.release;
}


export type GitHubSourceInput = Pick<GitHubAppSource, 'owner' | 'repo' | 'channel' | 'platform' | 'assetPattern' | 'entrypoint' | 'installType'> & { includePrereleases?: boolean; tag?: string };

export async function testGitHubSource(input: GitHubSourceInput): Promise<any> {
  return request('/api/releases/admin/github-source/test', { method: 'POST', body: JSON.stringify(input) }, 10000);
}

export async function saveGitHubSource(appId: string, input: GitHubSourceInput): Promise<GitHubAppSource> {
  const data = await request<{ source: GitHubAppSource }>(`/api/releases/admin/apps/${appId}/github-source`, { method: 'POST', body: JSON.stringify(input) }, 15000);
  return data.source;
}

export async function checkGitHubSource(appId: string, input?: Partial<GitHubSourceInput>): Promise<GitHubAppSource> {
  const data = await request<{ source: GitHubAppSource }>(`/api/releases/admin/apps/${appId}/github-source/check`, { method: 'POST', body: JSON.stringify(input ?? {}) }, 15000);
  return data.source;
}

export async function importLatestGitHubRelease(appId: string, input?: Partial<GitHubSourceInput>): Promise<AppRelease> {
  const data = await request<{ release: AppRelease }>(`/api/releases/admin/apps/${appId}/github-source/import-latest`, { method: 'POST', body: JSON.stringify(input ?? {}) }, 15000);
  return data.release;
}

export async function submitRelease(id: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/submit-review`, { method: 'POST' }); }
export async function approveRelease(id: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/approve`, { method: 'POST' }); }
export async function publishRelease(id: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/publish`, { method: 'POST' }); }
export async function rollbackRelease(id: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/rollback`, { method: 'POST' }); }
export async function rejectRelease(id: string, reason: string): Promise<void> { await request(`/api/releases/admin/releases/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); }
export async function getClients(): Promise<{ clients: any[]; installReports: any[] }> { return request('/api/clients/admin'); }
export async function getAuditLogs(): Promise<any[]> { const data = await request<{ logs: any[] }>('/api/logs/admin'); return data.logs; }
export async function getServerRuntimeSettings(): Promise<any> { const data = await request<{ settings: any }>('/api/admin/server/settings'); return data.settings; }


export async function getDownloadLocations(): Promise<DownloadLocation[]> {
  const data = await request<{ locations: DownloadLocation[] }>('/api/nodes/download-locations', {}, 5000);
  return data.locations;
}

export async function getAdminNodes(): Promise<NodeAdminState> {
  return request<NodeAdminState>('/api/admin/nodes', {}, 6000);
}

export async function approveNodeRequest(id: string, permissions: Partial<NodePermissions>): Promise<{ node: EchoNode; request: EchoNodeRequest }> {
  return request(`/api/admin/nodes/requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ permissions }) }, 8000);
}

export async function rejectNodeRequest(id: string, reason = 'Rejected from Echo App Center.'): Promise<{ request: EchoNodeRequest }> {
  return request(`/api/admin/nodes/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }, 8000);
}

export async function testNode(id: string): Promise<{ node: EchoNode; health: { online: boolean; pingMs?: number; detail: string } }> {
  return request(`/api/admin/nodes/${id}/test`, { method: 'POST' }, 6000);
}

export async function syncNodeNow(id: string): Promise<{ node: EchoNode }> {
  return request(`/api/admin/nodes/${id}/sync-now`, { method: 'POST' }, 6000);
}

export async function updateNodePermissions(id: string, permissions: Partial<NodePermissions>): Promise<{ node: EchoNode }> {
  return request(`/api/admin/nodes/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions }) }, 8000);
}

export async function removeNode(id: string): Promise<void> {
  await request(`/api/admin/nodes/${id}`, { method: 'DELETE' }, 8000);
}

export async function runSyncNow(): Promise<{ nodes: EchoNode[] }> {
  return request('/api/admin/sync/run', { method: 'POST' }, 8000);
}
