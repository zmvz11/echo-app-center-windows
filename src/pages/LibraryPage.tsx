import { useEffect, useMemo, useState } from 'react';
import { getCatalog } from '../api/echoServerClient';
import { installApp, launchApp, listInstalledApps, repairApp, uninstallApp, updateApp } from '../api/localAgentClient';
import type { EchoApp, InstalledApp } from '../types/catalog';
import { mediaUrl, screenshots } from '../types/catalog';
import { getDefaultPlatform } from '../platform/platform';

export function LibraryPage() {
  const [apps, setApps] = useState<EchoApp[]>([]);
  const [installed, setInstalled] = useState<InstalledApp[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const platform = getDefaultPlatform();

  async function load() {
    const [catalog, localApps] = await Promise.all([getCatalog(), listInstalledApps().catch(() => [])]);
    setApps(catalog);
    setInstalled(localApps);
    if (!selectedId && catalog[0]) setSelectedId(catalog[0].id);
  }

  useEffect(() => { load().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load library.')); }, []);

  const installedMap = useMemo(() => new Map(installed.map((app) => [app.appId, app])), [installed]);
  const visibleApps = apps.filter((app) => filter === 'installed' ? installedMap.has(app.id) : filter === 'updates' ? Boolean(app.releases?.some((r) => r.platform === platform && r.status === 'published' && r.version !== installedMap.get(app.id)?.version)) : true);
  const selected = apps.find((app) => app.id === selectedId) ?? visibleApps[0];
  const local = selected ? installedMap.get(selected.id) : undefined;
  const latest = selected?.releases?.find((rel) => rel.platform === platform && rel.channel === 'stable');
  const updateAvailable = Boolean(local && latest && local.version !== latest.version);

  async function runAction(label: string, action: () => Promise<unknown>) {
    setMessage(`${label} started...`);
    try {
      await action();
      await load();
      setMessage(`${label} completed.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `${label} failed.`);
    }
  }

  if (!selected) {
    return <section><h1>Library</h1><div className="panel">No apps are published yet.</div></section>;
  }

  return (
    <section className="library-page">
      <aside className="library-list">
        <h1>Library</h1>
        <div className="filter-row">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'installed' ? 'active' : ''} onClick={() => setFilter('installed')}>Installed</button>
          <button className={filter === 'updates' ? 'active' : ''} onClick={() => setFilter('updates')}>Updates</button>
        </div>
        {visibleApps.map((app) => (
          <button key={app.id} className={`library-app ${selected.id === app.id ? 'active' : ''}`} onClick={() => setSelectedId(app.id)}>
            {mediaUrl(app, 'icon') ? <img src={mediaUrl(app, 'icon')} /> : <span className="small-icon">E</span>}
            <span><strong>{app.name}</strong><small>{installedMap.has(app.id) ? updateAvailable ? 'Update available' : 'Installed' : 'Not installed'}</small></span>
          </button>
        ))}
      </aside>
      <article className="library-detail">
        <div className="hero">{mediaUrl(selected, 'library_banner') ? <img src={mediaUrl(selected, 'library_banner')} /> : <div className="placeholder-hero">{selected.name}</div>}</div>
        <div className="detail-header">
          <div>
            <h1>{selected.name}</h1>
            <p className="muted">{local ? `Installed • v${local.version}` : 'Not installed'} {updateAvailable ? `• Update ${latest?.version} available` : ''}</p>
          </div>
          <div className="action-row">
            {local ? <button onClick={() => runAction('Launch', () => launchApp(selected.id))}>Launch</button> : <button onClick={() => runAction('Install', () => installApp(selected.id, platform))}>Install</button>}
            {local && updateAvailable && <button onClick={() => runAction('Update', () => updateApp(selected.id, platform))}>Update</button>}
            {local && <button onClick={() => runAction('Repair', () => repairApp(selected.id, platform))}>Repair</button>}
            {local && <button className="danger" onClick={() => runAction('Uninstall', () => uninstallApp(selected.id))}>Uninstall</button>}
          </div>
        </div>
        {message && <p className={message.includes('completed') ? 'success' : message.includes('failed') || message.includes('error') ? 'error' : 'muted'}>{message}</p>}
        <div className="panel"><h2>Description</h2><p>{selected.fullDescription || selected.shortDescription}</p></div>
        <div className="panel"><h2>Screenshots</h2><div className="screenshots">{screenshots(selected).map((shot) => <img key={shot.id} src={shot.url} />)}{screenshots(selected).length === 0 && <p className="muted">No screenshots uploaded.</p>}</div></div>
        <div className="panel details-grid">
          <div><small>Developer</small><strong>{selected.developer}</strong></div>
          <div><small>Category</small><strong>{selected.category}</strong></div>
          <div><small>Install path</small><strong>{local?.installPath ?? 'Not installed'}</strong></div>
          <div><small>Platform</small><strong>{platform}</strong></div>
        </div>
        <div className="panel"><h2>Changelog</h2>{latest?.changelog?.length ? <ul>{latest.changelog.map((line) => <li key={line}>{line}</li>)}</ul> : <p className="muted">No changelog provided.</p>}</div>
      </article>
    </section>
  );
}
