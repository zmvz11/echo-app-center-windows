import { useState } from 'react';
import { getInstallLocations, saveInstallLocations } from '../storage/installLocations';
import { clearSavedLogin, getServerUrl, setServerUrl } from '../auth/sessionStore';
import { testServerUrl } from '../api/echoServerClient';
import { getAgentUrl, setAgentUrl, testAgent } from '../api/localAgentClient';

const DEFAULT_LOGS_NOTE = 'Logs are written by the server, local agent, and installer scripts. Use this page to test connections and reset client-side saved state.';

type ParsedServerUrl = { protocol: 'http' | 'https'; host: string; port: string; };

function parseServerUrl(url: string): ParsedServerUrl {
  try { const parsed = new URL(url); return { protocol: parsed.protocol === 'https:' ? 'https' : 'http', host: parsed.hostname || 'localhost', port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80') }; }
  catch { return { protocol: 'http', host: 'localhost', port: '8080' }; }
}

function buildServerUrl(protocol: 'http' | 'https', host: string, port: string): string {
  const cleanHost = host.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanPort = port.trim();
  return `${protocol}://${cleanHost}${cleanPort ? `:${cleanPort}` : ''}`;
}

export function SettingsPage() {
  const initialServer = parseServerUrl(getServerUrl());
  const initialAgent = parseServerUrl(getAgentUrl());
  const [protocol, setProtocol] = useState<'http' | 'https'>(initialServer.protocol);
  const [serverHost, setServerHost] = useState(initialServer.host);
  const [serverPort, setServerPort] = useState(initialServer.port);
  const [agentPort, setAgentPort] = useState(initialAgent.port || '17888');
  const [message, setMessage] = useState('');
  const [locations, setLocations] = useState(getInstallLocations());
  const [newPath, setNewPath] = useState('');
  const fullServerUrl = buildServerUrl(protocol, serverHost, serverPort);
  const fullAgentUrl = buildServerUrl('http', '127.0.0.1', agentPort);

  function saveServer() { setServerUrl(fullServerUrl); setAgentUrl(fullAgentUrl); setMessage(`Saved server ${fullServerUrl} and local agent ${fullAgentUrl}`); }
  async function testConnections() {
    setMessage('Testing connections...');
    try {
      setServerUrl(fullServerUrl);
      setAgentUrl(fullAgentUrl);
      const [server, agent] = await Promise.all([testServerUrl(fullServerUrl), testAgent()]);
      setMessage(`${server.product} online; ${agent.product} online.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection test failed.'); }
  }
  function addLocation() { if (!newPath.trim()) return; const next = [...locations, { id: crypto.randomUUID(), path: newPath.trim(), isDefault: locations.length === 0 }]; setLocations(next); saveInstallLocations(next); setNewPath(''); }
  function makeDefault(id: string) { const next = locations.map((loc) => ({ ...loc, isDefault: loc.id === id })); setLocations(next); saveInstallLocations(next); }
  function removeLocation(id: string) { const next = locations.filter((loc) => loc.id !== id).map((loc, idx) => ({ ...loc, isDefault: idx === 0 ? loc.isDefault || !locations.some((x) => x.id !== id && x.isDefault) : loc.isDefault })); setLocations(next); saveInstallLocations(next); }
  function resetSavedLogin() { clearSavedLogin(); setMessage('Saved login cleared. You will need to log in again next time.'); }
  function clearClientCache() { sessionStorage.clear(); setMessage('Temporary client cache cleared. Installed apps and server data were not deleted.'); }

  return (
    <section className="settings-page premium-settings">
      <header className="settings-hero"><span className="eyebrow">Control Center</span><h1>Settings</h1><p>{DEFAULT_LOGS_NOTE}</p></header>
      <div className="settings-grid">
        <div className="panel"><h2>Server Connection</h2><p className="muted">Enter the Echo App Server address this client should use.</p><div className="details-grid"><label>Protocol<select value={protocol} onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}><option value="http">http</option><option value="https">https</option></select></label><label>Server IP / Hostname<input value={serverHost} onChange={(e) => setServerHost(e.target.value)} placeholder="192.168.0.50" /></label><label>Server Port<input value={serverPort} onChange={(e) => setServerPort(e.target.value)} placeholder="8080" inputMode="numeric" /></label></div><label>Full Server URL<input value={fullServerUrl} readOnly /></label><div className="action-row"><button onClick={saveServer}>Save Connections</button><button onClick={testConnections}>Test Connections</button></div></div>
        <div className="panel"><h2>Local Agent</h2><p className="muted">The local agent performs installs, updates, repairs, uninstalls, and launches on this computer.</p><label>Local Agent Port<input value={agentPort} onChange={(e) => setAgentPort(e.target.value)} /></label><label>Local Agent URL<input value={fullAgentUrl} readOnly /></label></div>
        <div className="panel"><h2>Storage Libraries</h2><p className="muted">Choose where Echo apps install, similar to a game library folder setup.</p>{locations.map((loc) => <div key={loc.id} className="storage-row"><span>{loc.path}</span>{loc.isDefault && <strong>Default</strong>}<button onClick={() => makeDefault(loc.id)} disabled={loc.isDefault}>Make Default</button><button className="danger" onClick={() => removeLocation(loc.id)}>Remove</button></div>)}<div className="row"><input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="Add install folder, e.g. D:\EchoApps" /><button onClick={addLocation}>Add Folder</button></div></div>
        <div className="panel"><h2>Account and Maintenance</h2><p className="muted">These actions affect only this App Center install.</p><div className="action-row"><button onClick={resetSavedLogin}>Reset Saved Login</button><button onClick={clearClientCache}>Clear Temporary Cache</button></div><p className="muted">Server users, apps, releases, and media are not deleted by these buttons.</p></div>
      </div>
      {message && <p className={message.includes('online') || message.includes('Saved') || message.includes('cleared') ? 'success' : 'muted'}>{message}</p>}
    </section>
  );
}
