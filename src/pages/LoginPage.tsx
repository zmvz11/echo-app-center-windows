import { FormEvent, useMemo, useState } from 'react';
import { login, setupStatus, testServerUrl } from '../api/echoServerClient';
import { getServerUrl, setServerUrl } from '../auth/sessionStore';
import { validateUsername } from '../auth/usernameRules';
import type { CurrentUser } from '../types/auth';

type ParsedServerUrl = { protocol: 'http' | 'https'; host: string; port: string };

function parseServerUrl(url: string): ParsedServerUrl {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol === 'https:' ? 'https' : 'http',
      host: parsed.hostname || 'localhost',
      port: parsed.port || (parsed.protocol === 'https:' ? '443' : '8080'),
    };
  } catch {
    return { protocol: 'http', host: 'localhost', port: '8080' };
  }
}

function buildServerUrl(protocol: 'http' | 'https', host: string, port: string): string {
  const cleanHost = host.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanPort = port.trim();
  return `${protocol}://${cleanHost}${cleanPort ? `:${cleanPort}` : ''}`;
}

export function LoginPage(props: { onLoggedIn: (user: CurrentUser) => void; onCreateAccount: () => void; onNeedsOwner: () => void }) {
  const initial = useMemo(() => parseServerUrl(getServerUrl()), []);
  const [protocol, setProtocol] = useState<'http' | 'https'>(initial.protocol);
  const [serverHost, setServerHost] = useState(initial.host);
  const [serverPort, setServerPort] = useState(initial.port);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const fullServerUrl = buildServerUrl(protocol, serverHost, serverPort);

  async function connectToServer() {
    setError('');
    setConnectionMessage('Testing server connection...');
    setServerUrl(fullServerUrl);
    try {
      const health = await testServerUrl(fullServerUrl);
      const status = await setupStatus();
      setConnected(true);
      if (status.needsOwner) {
        setConnectionMessage(`${health.product} connected. No owner account exists yet. Create the first admin account next.`);
        props.onNeedsOwner();
        return;
      }
      setConnectionMessage(`${health.product} connected. Log in with your username and password.`);
    } catch (err) {
      setConnected(false);
      setConnectionMessage('');
      setError(err instanceof Error ? err.message : 'Could not connect to Echo App Server.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setServerUrl(fullServerUrl);
    const usernameError = validateUsername(username);
    if (usernameError) return setError(usernameError);
    try {
      const status = await setupStatus();
      if (status.needsOwner) {
        props.onNeedsOwner();
        return;
      }
      const user = await login({ username, password });
      props.onLoggedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    }
  }

  return (
    <main className="centered-card">
      <form className="auth-card wide-auth-card" onSubmit={submit}>
        <h1>Echo App Center</h1>
        <p className="muted">Connect this desktop client to your Echo App Server, then log in.</p>

        <div className="connection-box">
          <h2>Server Connection</h2>
          <div className="details-grid">
            <label>Protocol
              <select value={protocol} onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}>
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </label>
            <label>Server IP / Hostname
              <input value={serverHost} onChange={(e) => setServerHost(e.target.value)} placeholder="192.168.0.50" autoFocus />
            </label>
            <label>Port
              <input value={serverPort} onChange={(e) => setServerPort(e.target.value)} placeholder="8080" inputMode="numeric" />
            </label>
          </div>
          <label>Full Server URL<input value={fullServerUrl} readOnly /></label>
          <button type="button" onClick={connectToServer}>Connect to Server</button>
          {connectionMessage && <p className="success">{connectionMessage}</p>}
        </div>

        <h2>Login</h2>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Log In</button>
        <button type="button" className="link-button" onClick={props.onCreateAccount}>Create an account</button>
        {!connected && <p className="muted">The login button also saves and checks the server address above.</p>}
      </form>
    </main>
  );
}
