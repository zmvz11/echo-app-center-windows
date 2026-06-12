const TOKEN_KEY = 'echo_app_center_session_token';
const SERVER_KEY = 'echo_app_center_server_url';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_KEY) || 'http://localhost:8080';
}

export function setServerUrl(url: string): void {
  localStorage.setItem(SERVER_KEY, url.replace(/\/$/, ''));
}
