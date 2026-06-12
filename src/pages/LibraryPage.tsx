import { useEffect, useMemo, useState } from 'react';
import { getCatalog } from '../api/echoServerClient';
import { installApp, launchApp, listInstalledApps, repairApp, uninstallApp, updateApp } from '../api/localAgentClient';
import type { EchoApp, InstalledApp } from '../types/catalog';
import { iconUrl, latestStableRelease, libraryBannerUrl, mediaUrl, screenshots } from '../types/catalog';
import { getDefaultPlatform } from '../platform/platform';
import { LibraryTile } from '../components/StoreComponents';

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
  const latest = selected ? latestStableRelease(selected, platform) : undefined;
  const updateAvailable = Boolean(local && latest && local.version !== latest.version);
  const whatsNew = apps.filter((app) => app.releases?.some((rel) => rel.status === 'published')).slice(0, 4);

  async function runAction(label: string, action: () => Promise<unknown>) {
    setMessage(`${label} started...`);
    try { await action(); await load(); setMessage(`${label} completed.`); }
    catch (err) { setMessage(err instanceof Error ? err.message : `${label} failed.`); }
  }

  function statusFor(app: EchoApp): string {
    const localApp = installedMap.get(app.id);
    const appLatest = latestStableRelease(app, platform);
    if (localApp && appLatest && appLatest.version !== localApp.version) return 'Update queued';
    if (localApp) return 'Installed';
    return 'Available';
  }

  if (!selected) return <section><h1>Library</h1><div className="panel">No apps are published yet.</div></section>;

  return (
    <section className="library-steam-layout">
      <aside className="steam-library-sidebar">
        <div className="library-home">Home</div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Apps and Software</option><option value="installed">Installed</option><option value="updates">Updates</option></select>
        <input placeholder="Search library" />
        <div className="library-category-title">— ECHO APPS ({visibleApps.length})</div>
        {visibleApps.map((app) => <button key={app.id} className={`library-list-item ${selected.id === app.id ? 'active' : ''}`} onClick={() => setSelectedId(app.id)}>{iconUrl(app) ? <img src={iconUrl(app)} /> : <span className="small-icon">E</span>}<span>{app.name}</span><small>{statusFor(app)}</small></button>)}
      </aside>
      <article className="library-steam-main">
        {whatsNew.length > 0 && <section className="whats-new"><h2>What's New</h2><div className="whats-new-row">{whatsNew.map((app) => <button key={app.id} onClick={() => setSelectedId(app.id)}>{libraryBannerUrl(app) ? <img src={libraryBannerUrl(app)} /> : <span>{app.name}</span>}<strong>{app.name}</strong><small>{latestStableRelease(app, platform)?.version ? `Version ${latestStableRelease(app, platform)?.version}` : app.category}</small></button>)}</div></section>}
        <div className="library-shelf-header"><h2>All Apps ({visibleApps.length})</h2><span>Sort by Recent Activity</span></div>
        <div className="library-cover-grid">{visibleApps.map((app) => <LibraryTile key={app.id} app={app} status={statusFor(app)} selected={selected.id === app.id} onClick={() => setSelectedId(app.id)} />)}</div>
        <div className="library-detail-drawer">
          <div className="hero">{mediaUrl(selected, 'library_banner') ? <img src={mediaUrl(selected, 'library_banner')} /> : <div className="placeholder-hero">{selected.name}</div>}</div>
          <div className="detail-header"><div><h1>{selected.name}</h1><p className="muted">{local ? `Installed • v${local.version}` : 'Not installed'} {updateAvailable ? `• Update ${latest?.version} available` : ''}</p></div><div className="action-row">{local ? <button onClick={() => runAction('Launch', () => launchApp(selected.id))}>Launch</button> : <button onClick={() => runAction('Install', () => installApp(selected.id, platform))}>Install</button>}{local && updateAvailable && <button onClick={() => runAction('Update', () => updateApp(selected.id, platform))}>Update</button>}{local && <button onClick={() => runAction('Repair', () => repairApp(selected.id, platform))}>Repair</button>}{local && <button className="danger" onClick={() => runAction('Uninstall', () => uninstallApp(selected.id))}>Uninstall</button>}</div></div>
          {message && <p className={message.includes('completed') ? 'success' : message.includes('failed') || message.includes('error') ? 'error' : 'muted'}>{message}</p>}
          <div className="panel"><h2>Description</h2><p>{selected.fullDescription || selected.shortDescription}</p></div>
          <div className="panel"><h2>Screenshots</h2><div className="screenshots">{screenshots(selected).map((shot) => <img key={shot.id} src={shot.url} />)}{screenshots(selected).length === 0 && <p className="muted">No screenshots uploaded.</p>}</div></div>
        </div>
      </article>
    </section>
  );
}
