const TOKEN_KEY = 'echo_app_center_session_token';
const SERVER_KEY = 'echo_app_center_server_url';
const REMEMBER_LOGIN_KEY = 'echo_app_center_remember_login';
const REMEMBERED_USERNAME_KEY = 'echo_app_center_remembered_username';

export function getRememberLogin(): boolean {
  return localStorage.getItem(REMEMBER_LOGIN_KEY) === 'true';
}

export function setRememberLogin(enabled: boolean): void {
  localStorage.setItem(REMEMBER_LOGIN_KEY, enabled ? 'true' : 'false');
  if (!enabled) localStorage.removeItem(REMEMBERED_USERNAME_KEY);
}

export function getRememberedUsername(): string {
  return localStorage.getItem(REMEMBERED_USERNAME_KEY) || '';
}

export function setRememberedUsername(username: string): void {
  const clean = username.trim();
  if (clean) localStorage.setItem(REMEMBERED_USERNAME_KEY, clean);
  else localStorage.removeItem(REMEMBERED_USERNAME_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember = getRememberLogin()): void {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function clearSavedLogin(): void {
  clearToken();
  setRememberLogin(false);
  localStorage.removeItem(REMEMBERED_USERNAME_KEY);
}

export function getServerUrl(): string {
  return localStorage.getItem(SERVER_KEY) || 'http://localhost:8080';
}

export function setServerUrl(url: string): void {
  localStorage.setItem(SERVER_KEY, url.replace(/\/$/, ''));
}
