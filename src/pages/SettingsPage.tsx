import { useState } from 'react';
import { getInstallLocations, saveInstallLocations } from '../storage/installLocations';
import { getServerUrl, setServerUrl } from '../auth/sessionStore';
import { testServerUrl } from '../api/echoServerClient';
import { getAgentUrl, setAgentUrl, testAgent } from '../api/localAgentClient';

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
      const [server, agent] = await Promise.all([testServerUrl(fullServerUrl), testAgent()]);
      setMessage(`${server.product} online; ${agent.product} online.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection test failed.'); }
  }
  function addLocation() { if (!newPath.trim()) return; const next = [...locations, { id: crypto.randomUUID(), path: newPath.trim(), isDefault: locations.length === 0 }]; setLocations(next); saveInstallLocations(next); setNewPath(''); }

  return (
    <section>
      <h1>Settings</h1>
      <div className="panel"><h2>Server Connection</h2><p className="muted">Enter the Echo App Server address this client should use.</p><div className="details-grid"><label>Protocol<select value={protocol} onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}><option value="http">http</option><option value="https">https</option></select></label><label>Server IP / Hostname<input value={serverHost} onChange={(e) => setServerHost(e.target.value)} placeholder="192.168.0.50" /></label><label>Server Port<input value={serverPort} onChange={(e) => setServerPort(e.target.value)} placeholder="8080" inputMode="numeric" /></label></div><label>Full Server URL<input value={fullServerUrl} readOnly /></label></div>
      <div className="panel"><h2>Local Agent</h2><p className="muted">The local agent performs installs, updates, repairs, uninstalls, and launches on this computer.</p><label>Local Agent Port<input value={agentPort} onChange={(e) => setAgentPort(e.target.value)} /></label><label>Local Agent URL<input value={fullAgentUrl} readOnly /></label><div className="action-row"><button onClick={saveServer}>Save Connections</button><button onClick={testConnections}>Test Connections</button></div>{message && <p className={message.includes('online') || message.includes('Saved') ? 'success' : 'muted'}>{message}</p>}</div>
      <div className="panel"><h2>Storage</h2>{locations.map((loc) => <div key={loc.id} className="row"><span>{loc.path}</span>{loc.isDefault && <strong>Default</strong>}</div>)}<div className="row"><input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="Add install folder" /><button onClick={addLocation}>Add Folder</button></div></div>
    </section>
  );
}
