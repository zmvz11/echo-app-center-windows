import { useEffect, useState } from 'react';
import { getInstallLocations, saveInstallLocations } from '../storage/installLocations';
import { clearSavedLogin, getDownloadLocationPreference, getServerUrl, setDownloadLocationPreference, setServerUrl } from '../auth/sessionStore';
import { approveNodeRequest, getAdminNodes, getDownloadLocations, rejectNodeRequest, runSyncNow, syncNodeNow, testNode, testServerUrl } from '../api/echoServerClient';
import { addAgentInstallLocation, getAgentUrl, listAgentInstallLocations, makeDefaultAgentInstallLocation, removeAgentInstallLocation, setAgentUrl, testAgent } from '../api/localAgentClient';
import type { DownloadLocation, EchoNode, EchoNodeRequest, NodePermissions } from '../types/catalog';

const DEFAULT_LOGS_NOTE = 'Logs are written by the server, local agent, and installer scripts. Use this page to test connections, manage download locations, approve server nodes, and reset client-side saved state.';

type ParsedServerUrl = { protocol: 'http' | 'https'; host: string; port: string; };

const defaultMirrorPermissions: NodePermissions = {
  canPullPackages: true,
  canPullMedia: true,
  canServeDownloads: true,
  canPullDatabaseBackup: false,
  canBePromoted: false,
  canRunAdminApi: false,
};

function parseServerUrl(url: string): ParsedServerUrl {
  try { const parsed = new URL(url); return { protocol: parsed.protocol === 'https:' ? 'https' : 'http', host: parsed.hostname || 'localhost', port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80') }; }
  catch { return { protocol: 'http', host: 'localhost', port: '8080' }; }
}

function buildServerUrl(protocol: 'http' | 'https', host: string, port: string): string {
  const cleanHost = host.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanPort = port.trim();
  return `${protocol}://${cleanHost}${cleanPort ? `:${cleanPort}` : ''}`;
}

function formatBytes(value?: number): string {
  if (!value) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function nodeTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function NodePermissionSummary({ permissions }: { permissions: NodePermissions }) {
  const enabled = Object.entries(permissions).filter(([, value]) => value).map(([key]) => key.replace(/^can/, '').replace(/[A-Z]/g, (m) => ` ${m}`).trim());
  return <span>{enabled.length ? enabled.join(', ') : 'No access approved'}</span>;
}

function NodeCard({ node, onRefresh }: { node: EchoNode; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  async function action(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try { await fn(); await onRefresh(); }
    finally { setBusy(''); }
  }
  return (
    <div className="node-card">
      <div className="node-card-head">
        <div><strong>{node.nickname}</strong><small>{nodeTypeLabel(node.nodeType)} · {node.baseUrl}</small></div>
        <span className={`status-pill ${node.status}`}>{node.status}</span>
      </div>
      <div className="details-grid compact">
        <span>Last seen: {node.lastSeenAt ?? 'not checked in yet'}</span>
        <span>Last sync: {node.lastSyncAt ?? 'never'}</span>
        <span>Packages: {node.packagesSynced ?? 0}</span>
        <span>Media: {node.mediaSynced ?? 0}</span>
        <span>Storage free: {formatBytes(node.storageFreeBytes)}</span>
        <span>Access: <NodePermissionSummary permissions={node.permissions} /></span>
      </div>
      {node.healthMessage && <p className="muted">{node.healthMessage}</p>}
      <div className="action-row">
        <button disabled={!!busy} onClick={() => action('test', () => testNode(node.id))}>Test Node</button>
        <button disabled={!!busy} onClick={() => action('sync', () => syncNodeNow(node.id))}>Sync Now</button>
      </div>
    </div>
  );
}

function PendingNodeCard({ request, onRefresh }: { request: EchoNodeRequest; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  const [permissions, setPermissions] = useState<NodePermissions>({
    ...defaultMirrorPermissions,
    canPullDatabaseBackup: request.nodeType !== 'download_mirror',
    canBePromoted: request.nodeType !== 'download_mirror',
  });
  async function approve() { setBusy('approve'); try { await approveNodeRequest(request.id, permissions); await onRefresh(); } finally { setBusy(''); } }
  async function reject() { setBusy('reject'); try { await rejectNodeRequest(request.id); await onRefresh(); } finally { setBusy(''); } }
  return (
    <div className="node-card pending">
      <div className="node-card-head">
        <div><strong>{request.nickname}</strong><small>{nodeTypeLabel(request.nodeType)} · {request.baseUrl}</small></div>
        <span className="status-pill pending">pending</span>
      </div>
      <p className="muted">Fingerprint: {request.fingerprint}</p>
      <div className="permission-grid">
        {Object.entries(permissions).map(([key, value]) => (
          <label key={key} className="check-row"><input type="checkbox" checked={value} onChange={(e) => setPermissions((current) => ({ ...current, [key]: e.target.checked }))} /> {key.replace(/^can/, '').replace(/[A-Z]/g, (m) => ` ${m}`).trim()}</label>
        ))}
      </div>
      <div className="action-row">
        <button disabled={!!busy} onClick={approve}>Accept Node</button>
        <button disabled={!!busy} className="danger" onClick={reject}>Reject</button>
      </div>
    </div>
  );
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
  const [downloadLocations, setDownloadLocations] = useState<DownloadLocation[]>([]);
  const [downloadChoice, setDownloadChoice] = useState(getDownloadLocationPreference().id);
  const [nodes, setNodes] = useState<EchoNode[]>([]);
  const [requests, setRequests] = useState<EchoNodeRequest[]>([]);
  const [nodesMessage, setNodesMessage] = useState('');
  const fullServerUrl = buildServerUrl(protocol, serverHost, serverPort);
  const fullAgentUrl = buildServerUrl('http', '127.0.0.1', agentPort);

  async function refreshNodes() {
    try {
      const [download, admin] = await Promise.all([getDownloadLocations(), getAdminNodes().catch((error) => { setNodesMessage(error instanceof Error ? `Admin node controls unavailable: ${error.message}` : 'Admin node controls unavailable.'); return null; })]);
      setDownloadLocations(download);
      if (admin) { setNodes(admin.nodes); setRequests(admin.requests); setNodesMessage(admin.syncSettings?.enabled ? `Sync enabled · ${admin.syncSettings.intervalMinutes} minute interval` : 'Sync approval is not enabled yet. Run echo-server sync setup on the primary server.'); }
    } catch (error) {
      setNodesMessage(error instanceof Error ? error.message : 'Could not load server nodes.');
    }
  }

  useEffect(() => { listAgentInstallLocations().then((agentLocations) => { setLocations(agentLocations); saveInstallLocations(agentLocations); }).catch(() => undefined); void refreshNodes(); }, []);

  function saveServer() { setServerUrl(fullServerUrl); setAgentUrl(fullAgentUrl); setMessage(`Saved server ${fullServerUrl} and local agent ${fullAgentUrl}`); void refreshNodes(); }
  async function testConnections() {
    setMessage('Testing connections...');
    try {
      setServerUrl(fullServerUrl);
      setAgentUrl(fullAgentUrl);
      const [server, agent] = await Promise.all([testServerUrl(fullServerUrl), testAgent()]);
      setMessage(`${server.product} online; ${agent.product} online.`);
      await refreshNodes();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection test failed.'); }
  }
  async function addLocation() { if (!newPath.trim()) return; const next = [...locations, { id: crypto.randomUUID(), path: newPath.trim(), isDefault: locations.length === 0 }]; setLocations(next); saveInstallLocations(next); try { const agentLocations = await addAgentInstallLocation(newPath.trim()); setLocations(agentLocations); saveInstallLocations(agentLocations); setMessage('Install folder added to App Center and the local agent.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Install folder saved locally; local agent did not accept it.'); } setNewPath(''); }
  async function makeDefault(id: string) { const target = locations.find((loc) => loc.id === id); const next = locations.map((loc) => ({ ...loc, isDefault: loc.id === id })); setLocations(next); saveInstallLocations(next); if (target) { try { const agentLocations = await makeDefaultAgentInstallLocation(target.path); setLocations(agentLocations); saveInstallLocations(agentLocations); setMessage('Default install folder updated.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Default saved locally; local agent did not update.'); } } }
  async function removeLocation(id: string) { const target = locations.find((loc) => loc.id === id); const next = locations.filter((loc) => loc.id !== id).map((loc, idx) => ({ ...loc, isDefault: idx === 0 ? loc.isDefault || !locations.some((x) => x.id !== id && x.isDefault) : loc.isDefault })); setLocations(next); saveInstallLocations(next); if (target) { try { const agentLocations = await removeAgentInstallLocation(target.path); setLocations(agentLocations); saveInstallLocations(agentLocations); setMessage('Install folder removed from App Center and local agent.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Folder removed locally; local agent did not update.'); } } }
  function resetSavedLogin() { clearSavedLogin(); setMessage('Saved login cleared. You will need to log in again next time.'); }
  function clearClientCache() { sessionStorage.clear(); setMessage('Temporary client cache cleared. Installed apps and server data were not deleted.'); }
  function saveDownloadChoice(value: string) {
    setDownloadChoice(value);
    const selected = downloadLocations.find((item) => item.id === value);
    setDownloadLocationPreference(value, selected?.baseUrl);
    setMessage(`Download Server Location saved: ${selected?.nickname ?? 'Auto - Best Available'}`);
  }
  async function syncAllNodes() { setNodesMessage('Requesting sync for all approved nodes...'); try { await runSyncNow(); await refreshNodes(); } catch (error) { setNodesMessage(error instanceof Error ? error.message : 'Sync request failed.'); } }

  return (
    <section className="settings-page premium-settings">
      <header className="settings-hero"><span className="eyebrow">Control Center</span><h1>Settings</h1><p>{DEFAULT_LOGS_NOTE}</p></header>
      <div className="settings-grid">
        <div className="panel"><h2>Server Connection</h2><p className="muted">Enter the Echo App Server address this client should use.</p><div className="details-grid"><label>Protocol<select value={protocol} onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}><option value="http">http</option><option value="https">https</option></select></label><label>Server IP / Hostname<input value={serverHost} onChange={(e) => setServerHost(e.target.value)} placeholder="192.168.0.50" /></label><label>Server Port<input value={serverPort} onChange={(e) => setServerPort(e.target.value)} placeholder="8080" inputMode="numeric" /></label></div><label>Full Server URL<input value={fullServerUrl} readOnly /></label><div className="action-row"><button onClick={saveServer}>Save Connections</button><button onClick={testConnections}>Test Connections</button></div></div>
        <div className="panel"><h2>Local Agent</h2><p className="muted">The local agent performs installs, updates, repairs, uninstalls, and launches on this computer.</p><label>Local Agent Port<input value={agentPort} onChange={(e) => setAgentPort(e.target.value)} /></label><label>Local Agent URL<input value={fullAgentUrl} readOnly /></label></div>
        <div className="panel"><h2>Downloads</h2><p className="muted">Choose which approved download server location App Center should prefer. Auto will use the best available primary or mirror.</p><label>Download Server Location<select value={downloadChoice} onChange={(e) => saveDownloadChoice(e.target.value)}><option value="auto">Auto - Best Available</option>{downloadLocations.map((loc) => <option key={loc.id} value={loc.id}>{loc.nickname} - {loc.baseUrl}</option>)}</select></label><div className="node-list compact-list">{downloadLocations.map((loc) => <div key={loc.id} className="storage-row"><span>{loc.nickname}<small>{loc.baseUrl} · {loc.status} · {loc.lastSyncAt ? `synced ${loc.lastSyncAt}` : 'sync unknown'}</small></span>{loc.isPrimary && <strong>Primary</strong>}</div>)}</div></div>
        <div className="panel settings-node-page"><div className="panel-title-row"><div><h2>Server Nodes</h2><p className="muted">Approve download mirrors and standby backup nodes that request access to this primary server.</p></div><div className="action-row"><button onClick={refreshNodes}>Refresh</button><button onClick={syncAllNodes}>Sync All</button></div></div>{nodesMessage && <p className="muted">{nodesMessage}</p>}<h3>Pending Node Requests</h3>{requests.length === 0 ? <p className="muted">No pending nodes. On another server, run <code>echo-server node setup</code> and enter this primary server IP/port.</p> : requests.map((request) => <PendingNodeCard key={request.id} request={request} onRefresh={refreshNodes} />)}<h3>Connected Nodes</h3>{nodes.length === 0 ? <p className="muted">No approved nodes yet.</p> : nodes.map((node) => <NodeCard key={node.id} node={node} onRefresh={refreshNodes} />)}</div>
        <div className="panel"><h2>Storage Libraries</h2><p className="muted">Choose where Echo apps install, similar to a game library folder setup.</p>{locations.map((loc) => <div key={loc.id} className="storage-row"><span>{loc.path}</span>{loc.isDefault && <strong>Default</strong>}<button onClick={() => makeDefault(loc.id)} disabled={loc.isDefault}>Make Default</button><button className="danger" onClick={() => removeLocation(loc.id)}>Remove</button></div>)}<div className="row"><input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="Add install folder, e.g. D:\EchoApps" /><button onClick={addLocation}>Add Folder</button></div></div>
        <div className="panel"><h2>Account and Maintenance</h2><p className="muted">These actions affect only this App Center install.</p><div className="action-row"><button onClick={resetSavedLogin}>Reset Saved Login</button><button onClick={clearClientCache}>Clear Temporary Cache</button></div><p className="muted">Server users, apps, releases, nodes, and media are not deleted by these buttons.</p></div>
      </div>
      {message && <p className={message.includes('online') || message.includes('Saved') || message.includes('cleared') ? 'success' : 'muted'}>{message}</p>}
    </section>
  );
}
