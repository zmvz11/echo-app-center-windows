import { useEffect, useMemo, useRef, useState } from 'react';
import { approveRelease, approveUser, checkGitHubSource, createApp, getAdminApps, getAuditLogs, getClients, getPendingUsers, getReleases, getServerRuntimeSettings, importLatestGitHubRelease, publishRelease, rejectRelease, rollbackRelease, saveGitHubSource, setAppFeatured, setAppVisibility, submitRelease, testGitHubSource, updateAppAdmin, uploadMedia, validateReleasePackage, uploadReleasePackage } from '../api/echoServerClient';
import type { CurrentUser } from '../types/auth';
import { userCan } from '../types/auth';
import type { AppMediaType, EchoApp, AppRelease } from '../types/catalog';
import { cardThumbnailUrl, iconUrl, libraryBannerUrl, screenshots, storeHeroUrl } from '../types/catalog';
import { StoreAppCard } from '../components/StoreComponents';
import { StoreLayoutBuilderPage } from './StoreLayoutBuilderPage';

type AdminTab = 'dashboard' | 'users' | 'addApps' | 'storeLayout' | 'releases' | 'clients' | 'logs' | 'server';

type AppDraft = {
  id: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  developer: string;
  category: string;
  tagsText: string;
  platformsText: string;
  visibility: string;
  featured: boolean;
};

type ReleaseDraft = {
  version: string;
  channel: 'stable' | 'beta' | 'dev';
  platform: string;
  entrypoint: string;
  installType: 'portable' | 'installer';
  changelog: string;
};

type PendingMedia = { type: AppMediaType; file: File; previewUrl: string; sortOrder: number };

type ReleaseSourceMode = 'upload' | 'github';

type GitHubSourceDraft = { owner: string; repo: string; channel: 'stable' | 'beta' | 'dev'; platform: string; assetPattern: string; entrypoint: string; installType: 'portable' | 'installer'; includePrereleases: boolean; tag: string; autoImport: boolean; };

const blankDraft: AppDraft = {
  id: '',
  name: '',
  shortDescription: '',
  fullDescription: '',
  developer: 'Echo Apps',
  category: 'Utility',
  tagsText: 'Utility, Echo App',
  platformsText: 'windows-x64, linux-x64',
  visibility: 'draft',
  featured: false,
};

const blankRelease: ReleaseDraft = {
  version: '1.0.0',
  channel: 'stable',
  platform: 'windows-x64',
  entrypoint: 'echo-app.json',
  installType: 'portable',
  changelog: 'Initial release',
};

const blankGitHubSource: GitHubSourceDraft = {
  owner: '',
  repo: '',
  channel: 'stable',
  platform: 'windows-x64',
  assetPattern: '*.zip',
  entrypoint: 'echo-app.json',
  installType: 'portable',
  includePrereleases: false,
  tag: '',
  autoImport: true,
};

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function csv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function draftToPreview(draft: AppDraft, pending: PendingMedia[], selected?: EchoApp): EchoApp {
  const pendingMedia = pending.map((item, index) => ({ id: `pending-${index}`, type: item.type, url: item.previewUrl, sortOrder: item.sortOrder }));
  return {
    id: draft.id || 'new-echo-app',
    name: draft.name || 'New Echo App',
    shortDescription: draft.shortDescription || 'Short Store description appears here.',
    fullDescription: draft.fullDescription || 'Use this area to explain what the app does, who it is for, and why users should install it.',
    developer: draft.developer || 'Echo Apps',
    category: draft.category || 'Utility',
    tags: csv(draft.tagsText),
    platforms: csv(draft.platformsText),
    visibility: draft.visibility,
    featured: draft.featured,
    media: [...(selected?.media ?? []), ...pendingMedia],
    releases: selected?.releases ?? [],
  };
}

function useAdminApps() {
  const [apps, setApps] = useState<EchoApp[]>([]);
  const [message, setMessage] = useState('');
  async function load() {
    try {
      setApps(await getAdminApps());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load apps.');
    }
  }
  return { apps, setApps, load, message, setMessage };
}

export function AdminPortalPage(props: { user: CurrentUser }) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  return (
    <section className="admin-page">
      <aside className="admin-tabs">
        <h1>Admin Portal</h1>
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
        {userCan(props.user, 'users.approve') && <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>}
        {userCan(props.user, 'apps.create') && <button className={tab === 'addApps' ? 'active' : ''} onClick={() => setTab('addApps')}>Add Apps</button>}
        {userCan(props.user, 'apps.edit') && <button className={tab === 'storeLayout' ? 'active' : ''} onClick={() => setTab('storeLayout')}>Store Layout</button>}
        {userCan(props.user, 'releases.create') && <button className={tab === 'releases' ? 'active' : ''} onClick={() => setTab('releases')}>Releases</button>}
        {userCan(props.user, 'logs.view') && <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>Clients</button>}
        {userCan(props.user, 'logs.view') && <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>Audit Logs</button>}
        {userCan(props.user, 'server.settings.edit') && <button className={tab === 'server' ? 'active' : ''} onClick={() => setTab('server')}>Server Settings</button>}
      </aside>
      <div className="admin-content">
        {tab === 'dashboard' && <AdminDashboard />}
        {tab === 'users' && <UsersAdmin />}
        {tab === 'addApps' && <AddAppsLauncher />}
        {tab === 'storeLayout' && <StoreLayoutLauncher />}
        {tab === 'releases' && <ReleasesAdmin />}
        {tab === 'clients' && <ClientsAdmin />}
        {tab === 'logs' && <LogsAdmin />}
        {tab === 'server' && <ServerSettingsAdmin />}
      </div>
    </section>
  );
}

function AdminDashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
      <div className="stats-grid">
        <div className="stat">Add Apps<span>Steam-style Store template builder</span></div>
        <div className="stat">Users<span>Approval gate enabled</span></div>
        <div className="stat">Releases<span>Review before publish</span></div>
        <div className="stat">Clients<span>Check-ins tracked</span></div>
      </div>
    </div>
  );
}

function UsersAdmin() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  function load() { getPendingUsers().then(setUsers).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users.')); }
  useEffect(load, []);
  return <div><h2>Pending Users</h2>{error && <p className="error">{error}</p>}{users.map((user) => <div className="row" key={user.id}><span><strong>{user.username}</strong> {user.displayName}</span><button onClick={() => approveUser(user.id).then(load)}>Approve</button></div>)}{users.length === 0 && <p className="muted">No pending users.</p>}</div>;
}

function DropZone(props: { title: string; hint: string; type: AppMediaType; pending: PendingMedia[]; existingUrl?: string; onAdd: (item: PendingMedia) => void; sortOrder?: number; multiple?: boolean; large?: boolean }) {
  const preview = props.pending.find((item) => item.type === props.type && !props.multiple);
  function addFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file, index) => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
      props.onAdd({ type: props.type, file, previewUrl: URL.createObjectURL(file), sortOrder: props.sortOrder ?? index });
    });
  }
  const imageUrl = preview?.previewUrl ?? props.existingUrl;
  return (
    <label className={`drop-zone ${props.large ? 'large' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
      {imageUrl ? <img src={imageUrl} alt="" /> : <div><strong>{props.title}</strong><span>{props.hint}</span><small>Drag/drop or click to upload PNG, JPG, WEBP</small></div>}
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple={props.multiple} onChange={(e) => addFiles(e.target.files)} />
    </label>
  );
}

export function AddAppsAdmin(props: { windowMode?: boolean; initialAppId?: string } = {}) {
  const { apps, load, message, setMessage } = useAdminApps();
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<AppDraft>(blankDraft);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [releaseDraft, setReleaseDraft] = useState<ReleaseDraft>(blankRelease);
  const [releaseFile, setReleaseFile] = useState<File | null>(null);
  const [packageValidation, setPackageValidation] = useState('');
  const [releaseSource, setReleaseSource] = useState<ReleaseSourceMode>('upload');
  const [githubSource, setGithubSource] = useState<GitHubSourceDraft>(blankGitHubSource);
  const [githubResult, setGithubResult] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState(props.initialAppId ?? '');
  const allowCloseRef = useRef(false);
  const [filter, setFilter] = useState('');
  const selectedApp = apps.find((app) => app.id === selectedId);
  const previewApp = draftToPreview(draft, pendingMedia, selectedApp);
  const filteredApps = useMemo(() => apps.filter((app) => `${app.name} ${app.id} ${app.category}`.toLowerCase().includes(filter.toLowerCase())), [apps, filter]);
  const requiredChecks = [
    { label: 'App name', done: Boolean(draft.name.trim()) },
    { label: 'App ID', done: Boolean(draft.id.trim()) },
    { label: 'Short description', done: Boolean(draft.shortDescription.trim()) },
    { label: 'Store hero image', done: Boolean(storeHeroUrl(previewApp)) },
    { label: 'Icon', done: Boolean(iconUrl(previewApp)) },
    { label: 'Category', done: Boolean(draft.category.trim()) },
  ];
  const recommendedChecks = [
    { label: 'Library banner', done: Boolean(libraryBannerUrl(previewApp)) },
    { label: 'Card thumbnail', done: Boolean(cardThumbnailUrl(previewApp)) },
    { label: '3 screenshots', done: screenshots(previewApp).length >= 3 },
    { label: 'Release package or GitHub source', done: Boolean(releaseFile) || (releaseSource === 'github' && Boolean(githubSource.owner && githubSource.repo && githubSource.assetPattern)) || Boolean((selectedApp?.releases ?? []).length) },
  ];
  const readiness = requiredChecks.filter((item) => item.done).length;

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!props.windowMode) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (allowCloseRef.current || !dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, props.windowMode]);

  useEffect(() => {
    if (!props.windowMode || !window.echoDesktop?.onBuilderSelectApp) return;
    return window.echoDesktop.onBuilderSelectApp((appId) => setPendingSelectId(appId));
  }, [props.windowMode]);

  function confirmDiscardChanges(): boolean {
    return !dirty || window.confirm('You have unsaved app changes. Discard them and continue?');
  }

  function resetBuilder() {
    if (!confirmDiscardChanges()) return;
    setSelectedId('');
    setDraft(blankDraft);
    setReleaseDraft(blankRelease);
    setReleaseFile(null);
    setPackageValidation('');
    setPendingMedia([]);
    setReleaseSource('upload');
    setGithubSource(blankGitHubSource);
    setGithubResult('');
    setDirty(false);
    setMessage('New app template opened. Fill the Store page and click Post App when ready.');
  }

  function selectApp(app: EchoApp) {
    if (dirty && selectedId !== app.id && !window.confirm('You have unsaved app changes. Discard them and open this app?')) return;
    setSelectedId(app.id);
    setDraft({ id: app.id, name: app.name, shortDescription: app.shortDescription, fullDescription: app.fullDescription, developer: app.developer, category: app.category, tagsText: app.tags.join(', '), platformsText: (app.platforms ?? ['windows-x64', 'linux-x64']).join(', '), visibility: app.visibility, featured: Boolean(app.featured) });
    setReleaseDraft(blankRelease);
    setReleaseFile(null);
    setPackageValidation('');
    setPendingMedia([]);
    setReleaseSource(app.githubSource ? 'github' : 'upload');
    setGithubSource(app.githubSource ? { owner: app.githubSource.owner, repo: app.githubSource.repo, channel: app.githubSource.channel, platform: app.githubSource.platform, assetPattern: app.githubSource.assetPattern, entrypoint: app.githubSource.entrypoint, installType: app.githubSource.installType, includePrereleases: Boolean(app.githubSource.includePrereleases), tag: app.githubSource.tag ?? '', autoImport: false } : blankGitHubSource);
    setGithubResult(app.githubSource?.latestTag ? `GitHub source linked: ${app.githubSource.owner}/${app.githubSource.repo} @ ${app.githubSource.latestTag}` : '');
    setDirty(false);
    setMessage(`Editing ${app.name}. Changes are not live until you save or post.`);
  }

  function addPending(item: PendingMedia) {
    setDirty(true);
    setPendingMedia((current) => item.type === 'screenshot' ? [...current, { ...item, sortOrder: current.filter((i) => i.type === 'screenshot').length }] : [...current.filter((i) => i.type !== item.type), item]);
  }

  useEffect(() => {
    if (!pendingSelectId || apps.length === 0) return;
    const target = apps.find((app) => app.id === pendingSelectId);
    if (!target) return;
    selectApp(target);
    setPendingSelectId('');
  }, [apps, pendingSelectId]);

  function markDirtyDraft(next: AppDraft) { setDirty(true); setDraft(next); }
  function markDirtyRelease(next: ReleaseDraft) { setDirty(true); setReleaseDraft(next); }
  function closeBuilderWindow() {
    if (dirty && !window.confirm('You have unsaved app changes. Close the builder anyway?')) return;
    allowCloseRef.current = true;
    setDirty(false);
    window.setTimeout(() => {
      void window.echoDesktop?.closeBuilderWindow?.();
      if (!window.echoDesktop) window.close();
    }, 0);
  }


  function markDirtyGitHub(next: GitHubSourceDraft) { setDirty(true); setGithubSource(next); }

  function githubPayload() {
    return {
      owner: githubSource.owner.trim(),
      repo: githubSource.repo.trim(),
      channel: githubSource.channel,
      platform: githubSource.platform,
      assetPattern: githubSource.assetPattern.trim() || '*.zip',
      entrypoint: githubSource.entrypoint.trim() || 'echo-app.json',
      installType: githubSource.installType,
      includePrereleases: githubSource.includePrereleases,
      ...(githubSource.tag.trim() ? { tag: githubSource.tag.trim() } : {}),
    };
  }

  async function testGitHubReleaseSource() {
    if (!githubSource.owner.trim() || !githubSource.repo.trim()) { setGithubResult('Enter a GitHub owner and repository first.'); return; }
    setGithubResult('Testing GitHub release source...');
    try {
      const result = await testGitHubSource(githubPayload());
      setGithubResult(`GitHub source OK: ${result.release.tagName} / ${result.release.asset?.name ?? 'no asset selected'}`);
    } catch (error) {
      setGithubResult(error instanceof Error ? error.message : 'GitHub source test failed.');
    }
  }

  async function checkLinkedGitHubSource() {
    if (!selectedId) { setGithubResult('Save the app first, then check the linked GitHub source.'); return; }
    setGithubResult('Checking linked GitHub source...');
    try {
      const source = await checkGitHubSource(selectedId, githubPayload());
      setGithubResult(source.updateAvailable ? `Update available from GitHub: ${source.latestTag} (${source.latestAssetName})` : `GitHub source current: ${source.latestTag}`);
      await load();
    } catch (error) {
      setGithubResult(error instanceof Error ? error.message : 'GitHub source check failed.');
    }
  }

  async function importLinkedGitHubRelease(appId = selectedId) {
    if (!appId) { setGithubResult('Save the app first, then import the latest GitHub release.'); return; }
    setGithubResult('Importing latest GitHub release...');
    try {
      const release = await importLatestGitHubRelease(appId, githubPayload());
      setGithubResult(`Imported GitHub release ${release.sourceTag ?? release.version} as draft package ${release.packageFileName ?? ''}.`);
      await load();
    } catch (error) {
      setGithubResult(error instanceof Error ? error.message : 'GitHub release import failed.');
    }
  }

  async function chooseReleasePackage(file: File | null) {
    setReleaseFile(file);
    setDirty(true);
    if (!file) { setPackageValidation(''); return; }
    setPackageValidation('Validating package metadata...');
    try {
      const report = await validateReleasePackage({ file, version: releaseDraft.version, channel: releaseDraft.channel, platform: releaseDraft.platform, entrypoint: releaseDraft.entrypoint, installType: releaseDraft.installType });
      const warnings = report.warnings.length ? ` Warnings: ${report.warnings.join(' ')}` : '';
      setPackageValidation(`${report.packageKind.toUpperCase()} package is ready.${warnings}`);
    } catch (error) {
      setPackageValidation(error instanceof Error ? error.message : 'Package validation failed.');
    }
  }

  async function saveApp(nextVisibility = draft.visibility) {
    if (saving) return;
    if (!draft.name.trim()) { setMessage('App name is required.'); return; }
    if (!draft.id.trim()) { setMessage('App ID is required.'); return; }
    if (nextVisibility === 'published' && readiness < requiredChecks.length) { setMessage('Finish the required Store fields before posting this app.'); return; }
    setMessage(nextVisibility === 'published' ? 'Posting app to Store...' : 'Saving draft...');
    setSaving(true);
    try {
      const payload = { id: draft.id, name: draft.name, shortDescription: draft.shortDescription, fullDescription: draft.fullDescription, developer: draft.developer, category: draft.category, tags: csv(draft.tagsText), platforms: csv(draft.platformsText), visibility: nextVisibility, featured: draft.featured };
      const app = selectedId ? await updateAppAdmin(selectedId, payload) : await createApp(payload);
      await setAppFeatured(app.id, draft.featured);
      await setAppVisibility(app.id, nextVisibility);
      let uploadedMedia = 0;
      for (const item of pendingMedia) {
        await uploadMedia(app.id, { type: item.type, sortOrder: item.sortOrder, file: item.file });
        uploadedMedia += 1;
      }
      if (releaseFile && releaseSource === 'upload') {
        await validateReleasePackage({ file: releaseFile, version: releaseDraft.version, channel: releaseDraft.channel, platform: releaseDraft.platform, entrypoint: releaseDraft.entrypoint, installType: releaseDraft.installType });
        await uploadReleasePackage(app.id, { file: releaseFile, version: releaseDraft.version, channel: releaseDraft.channel, platform: releaseDraft.platform, entrypoint: releaseDraft.entrypoint, installType: releaseDraft.installType, changelog: releaseDraft.changelog });
      }
      if (releaseSource === 'github') {
        await saveGitHubSource(app.id, githubPayload());
        if (githubSource.autoImport || nextVisibility === 'published') {
          const imported = await importLatestGitHubRelease(app.id, githubPayload());
          setGithubResult(`GitHub source linked and imported ${imported.sourceTag ?? imported.version}.`);
        } else {
          setGithubResult('GitHub source linked. Use Check Source later to detect updates.');
        }
      }
      setPendingMedia([]);
      setReleaseFile(null);
      setDirty(false);
      setSelectedId(app.id);
      setDraft({ ...draft, visibility: nextVisibility });
      setMessage(nextVisibility === 'published' ? `App posted to the Store.${uploadedMedia ? ` Uploaded ${uploadedMedia} media file(s).` : ''}` : `Draft saved.${uploadedMedia ? ` Uploaded ${uploadedMedia} media file(s).` : ''}`);
      await load();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error.';
      setMessage(`Could not ${nextVisibility === 'published' ? 'post' : 'save'} app: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={props.windowMode ? 'add-apps-admin builder-window-shell' : 'add-apps-admin'}>
      {props.windowMode && <div className="builder-window-topbar"><div><h1>Echo App Builder</h1><p>Build, preview, save, and post a Store listing.</p></div><div className="launcher-actions"><button type="button" disabled={saving} onClick={() => saveApp('draft')}>{saving ? 'Saving...' : 'Save Draft'}</button><button type="button" disabled={saving} className="primary" onClick={() => saveApp('published')}>{saving ? 'Posting...' : 'Post App'}</button><button type="button" onClick={closeBuilderWindow}>Close</button></div></div>}
      {dirty && <div className="unsaved-banner">Unsaved changes are in this builder window. Save Draft before closing.</div>
      }
      <header className="add-apps-header">
        <div>
          <span className="eyebrow">Admin Portal</span>
          <h2>Add Apps</h2>
          <p>Build the app page exactly where the Store preview appears. Drag images into the template, add copy, attach a package, then post the app.</p>
        </div>
        <button type="button" onClick={resetBuilder}>Create New App Page</button>
      </header>

      {message && <p className="muted">{message}</p>}

      <div className="app-template-window">
        <aside className="app-template-rail">
          <h3>Existing Apps</h3>
          <input placeholder="Search apps" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button type="button" className={!selectedId ? 'active' : ''} onClick={resetBuilder}>+ Blank Store Page</button>
          <div className="admin-app-list-scroll">
            {filteredApps.map((app) => <button key={app.id} className={`admin-app-row ${selectedId === app.id ? 'active' : ''}`} onClick={() => selectApp(app)}>{iconUrl(app) ? <img src={iconUrl(app)} /> : <span className="small-icon">E</span>}<span><strong>{app.name}</strong><small>{app.visibility}{app.featured ? ' • Featured' : ''}</small></span></button>)}
          </div>
          <div className="builder-checklist">
            <h3>Ready to Post</h3>
            <progress max={requiredChecks.length} value={readiness} />
            {requiredChecks.map((item) => <span key={item.label} className={item.done ? 'done' : ''}>{item.done ? '✓' : '○'} {item.label}</span>)}
            <h3>Recommended</h3>
            {recommendedChecks.map((item) => <span key={item.label} className={item.done ? 'done' : 'warn'}>{item.done ? '✓' : '⚠'} {item.label}</span>)}
          </div>
        </aside>

        <main className="steam-template-builder">
          <div className="builder-title-row">
            <small>All Apps &gt; {draft.category || 'Category'} &gt;</small>
            <input className="builder-title-input" placeholder="App title" value={draft.name} onChange={(e) => markDirtyDraft({ ...draft, name: e.target.value, id: selectedId ? draft.id : slugify(e.target.value) })} />
          </div>

          <section className="builder-product-grid">
            <div className="builder-media-column">
              <DropZone large title="Main Store Media / Hero" hint="Recommended 1920x720" type="store_hero" pending={pendingMedia} existingUrl={storeHeroUrl(selectedApp ?? previewApp)} onAdd={addPending} />
              <div className="builder-filmstrip">
                {screenshots(previewApp).map((shot) => <img key={shot.id} src={shot.url} />)}
                <DropZone title="Screenshots" hint="1920x1080, add 3-10" type="screenshot" pending={pendingMedia} onAdd={addPending} multiple />
              </div>
            </div>

            <aside className="builder-store-sidebar">
              <DropZone title="Header / Card Image" hint="600x338 thumbnail" type="card_thumbnail" pending={pendingMedia} existingUrl={cardThumbnailUrl(selectedApp ?? previewApp)} onAdd={addPending} />
              <DropZone title="App Icon" hint="512x512 icon" type="icon" pending={pendingMedia} existingUrl={iconUrl(selectedApp ?? previewApp)} onAdd={addPending} />
              <label>Short Store Description<textarea value={draft.shortDescription} onChange={(e) => markDirtyDraft({ ...draft, shortDescription: e.target.value })} /></label>
              <dl>
                <dt>Developer</dt><dd><input value={draft.developer} onChange={(e) => markDirtyDraft({ ...draft, developer: e.target.value })} /></dd>
                <dt>Category</dt><dd><input value={draft.category} onChange={(e) => markDirtyDraft({ ...draft, category: e.target.value })} /></dd>
                <dt>App ID</dt><dd><input value={draft.id} disabled={Boolean(selectedId)} onChange={(e) => markDirtyDraft({ ...draft, id: slugify(e.target.value) })} /></dd>
                <dt>Platforms</dt><dd><input value={draft.platformsText} onChange={(e) => markDirtyDraft({ ...draft, platformsText: e.target.value })} /></dd>
              </dl>
              <label>Tags<input value={draft.tagsText} onChange={(e) => markDirtyDraft({ ...draft, tagsText: e.target.value })} /></label>
              <DropZone title="Library Banner" hint="1920x620" type="library_banner" pending={pendingMedia} existingUrl={libraryBannerUrl(selectedApp ?? previewApp)} onAdd={addPending} />
            </aside>
          </section>

          <section className="download-box builder-release-box">
            <div>
              <h2>Release Source for {draft.name || 'New Echo App'}</h2>
              <p>Upload a package manually or link a GitHub repository so Echo can detect newer GitHub Releases later.</p>
              {selectedApp?.githubSource && <span className={`github-source-badge ${selectedApp.githubSource.updateAvailable ? 'update' : ''}`}>{selectedApp.githubSource.updateAvailable ? 'GitHub update available' : 'GitHub linked'}: {selectedApp.githubSource.owner}/{selectedApp.githubSource.repo}</span>}
            </div>
            <div className="release-source-toggle">
              <label><input type="radio" checked={releaseSource === 'upload'} onChange={() => { setDirty(true); setReleaseSource('upload'); }} /> Upload release ZIP</label>
              <label><input type="radio" checked={releaseSource === 'github'} onChange={() => { setDirty(true); setReleaseSource('github'); }} /> Link GitHub Repository</label>
            </div>
            {releaseSource === 'upload' ? (
              <>
              <div className="release-mini-form">
                <label>Version<input value={releaseDraft.version} onChange={(e) => markDirtyRelease({ ...releaseDraft, version: e.target.value })} /></label>
                <label>Platform<select value={releaseDraft.platform} onChange={(e) => markDirtyRelease({ ...releaseDraft, platform: e.target.value })}><option>windows-x64</option><option>linux-x64</option></select></label>
                <label>Channel<select value={releaseDraft.channel} onChange={(e) => markDirtyRelease({ ...releaseDraft, channel: e.target.value as ReleaseDraft['channel'] })}><option>stable</option><option>beta</option><option>dev</option></select></label>
                <label>Entrypoint<input value={releaseDraft.entrypoint} onChange={(e) => markDirtyRelease({ ...releaseDraft, entrypoint: e.target.value })} /></label>
                <label>Package File<input type="file" accept=".zip,.echoapp" onChange={(e) => chooseReleasePackage(e.target.files?.[0] ?? null)} /></label>
              </div>
              {packageValidation && <div className="github-status-card"><strong>Package Validation</strong><p>{packageValidation}</p></div>}
              </>
            ) : (
              <div className="github-source-box">
                <h3>GitHub Repository Source</h3>
                <p className="muted">Use GitHub Releases as the package source. Example repo: <code>zmvz11/echo-watchtower-sc</code>. Asset pattern should match the release ZIP, such as <code>*windows*.zip</code>.</p>
                <div className="release-mini-form">
                  <label>Owner<input value={githubSource.owner} placeholder="zmvz11" onChange={(e) => markDirtyGitHub({ ...githubSource, owner: e.target.value })} /></label>
                  <label>Repository<input value={githubSource.repo} placeholder="echo-watchtower-sc" onChange={(e) => markDirtyGitHub({ ...githubSource, repo: e.target.value })} /></label>
                  <label>Asset Pattern<input value={githubSource.assetPattern} placeholder="*windows*.zip" onChange={(e) => markDirtyGitHub({ ...githubSource, assetPattern: e.target.value })} /></label>
                  <label>Tag Override<input value={githubSource.tag} placeholder="leave blank for latest" onChange={(e) => markDirtyGitHub({ ...githubSource, tag: e.target.value })} /></label>
                  <label>Platform<select value={githubSource.platform} onChange={(e) => markDirtyGitHub({ ...githubSource, platform: e.target.value })}><option>windows-x64</option><option>linux-x64</option></select></label>
                  <label>Channel<select value={githubSource.channel} onChange={(e) => markDirtyGitHub({ ...githubSource, channel: e.target.value as GitHubSourceDraft['channel'] })}><option>stable</option><option>beta</option><option>dev</option></select></label>
                  <label>Entrypoint<input value={githubSource.entrypoint} onChange={(e) => markDirtyGitHub({ ...githubSource, entrypoint: e.target.value })} /></label>
                  <label>Install Type<select value={githubSource.installType} onChange={(e) => markDirtyGitHub({ ...githubSource, installType: e.target.value as GitHubSourceDraft['installType'] })}><option value="portable">portable</option><option value="installer">installer</option></select></label>
                </div>
                <label><input type="checkbox" checked={githubSource.includePrereleases} onChange={(e) => markDirtyGitHub({ ...githubSource, includePrereleases: e.target.checked })} /> Include prerelease GitHub releases</label>
                <label><input type="checkbox" checked={githubSource.autoImport} onChange={(e) => markDirtyGitHub({ ...githubSource, autoImport: e.target.checked })} /> Import latest GitHub release as a draft package when saving/posting</label>
                <div className="action-row"><button type="button" disabled={saving} onClick={testGitHubReleaseSource}>Test Source</button><button type="button" disabled={saving} onClick={checkLinkedGitHubSource}>Check Linked Source</button><button type="button" disabled={saving} onClick={() => importLinkedGitHubRelease()}>Import Latest</button></div>
                {githubResult && <div className="github-status-card"><strong>GitHub Source</strong><p>{githubResult}</p></div>}
              </div>
            )}
          </section>

          <section className="builder-about-section">
            <h2>About This App</h2>
            <textarea value={draft.fullDescription} onChange={(e) => markDirtyDraft({ ...draft, fullDescription: e.target.value })} />
          </section>

          <section className="builder-row-preview">
            <h2>How it will appear in Store rows</h2>
            <StoreAppCard app={previewApp} />
          </section>
        </main>
      </div>

      <footer className="floating-publish-bar">
        <label><input type="checkbox" checked={draft.featured} onChange={(e) => markDirtyDraft({ ...draft, featured: e.target.checked })} /> Feature on Store homepage</label>
        <label>Visibility<select value={draft.visibility} onChange={(e) => markDirtyDraft({ ...draft, visibility: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="hidden">Hidden</option><option value="archived">Archived</option></select></label>
        <button type="button" disabled={saving} onClick={() => saveApp('draft')}>{saving ? 'Saving...' : 'Save Draft'}</button>
        <button type="button" disabled={saving} className="primary" onClick={() => saveApp('published')}>{saving ? 'Posting...' : 'Post App'}</button>
      </footer>
    </div>
  );
}


function AddAppsLauncher() {
  const { apps, load, message } = useAdminApps();
  useEffect(() => { load().catch(() => undefined); }, []);
  async function openBuilder(appId?: string) {
    if (window.echoDesktop?.openAppBuilder) {
      await window.echoDesktop.openAppBuilder(appId);
      return;
    }
    const hash = appId ? `#app-builder?appId=${encodeURIComponent(appId)}` : '#app-builder';
    window.open(`${window.location.origin}${window.location.pathname}${hash}`, 'echo-app-builder', 'width=1600,height=940');
  }
  return (
    <div className="add-apps-launcher">
      <section className="add-apps-launcher-hero">
        <div><span className="eyebrow">Admin Portal</span><h2>Add Apps</h2><p>Open the dedicated Echo App Builder window to create a Store listing with drag/drop media, live product-page preview, Save Draft, and Post App.</p><div className="product-badges"><span>Separate Builder Window</span><span>Live Store Template</span><span>Drafts</span><span>Readiness Checklist</span></div></div>
        <div className="launcher-actions"><button type="button" className="primary" onClick={() => openBuilder()}>Open Echo App Builder</button><button type="button" onClick={() => load()}>Refresh Apps</button></div>
      </section>
      {message && <p className="muted">{message}</p>}
      <section className="panel"><h3>Existing Store Apps</h3>{apps.length === 0 && <p className="muted">No apps exist yet. Open the builder and create the first Store page.</p>}<div className="app-management-grid">{apps.map((app) => <button className="app-management-card" key={app.id} onClick={() => openBuilder(app.id)}>{iconUrl(app) ? <img src={iconUrl(app)} /> : <span className="small-icon">E</span>}<span><strong>{app.name}</strong><small>{app.visibility}{app.featured ? ' • Featured' : ''} • {app.category}</small></span></button>)}</div></section>
    </div>
  );
}


function StoreLayoutLauncher() {
  async function openLayoutBuilder() {
    if (window.echoDesktop?.openStoreLayoutBuilder) {
      await window.echoDesktop.openStoreLayoutBuilder();
      return;
    }
    window.open(`${window.location.origin}${window.location.pathname}#store-layout-builder`, 'echo-store-layout-builder', 'width=1720,height=980');
  }
  return (
    <div className="add-apps-launcher">
      <section className="add-apps-launcher-hero">
        <div>
          <span className="eyebrow">Admin Portal</span>
          <h2>Store Layout</h2>
          <p>Open the dedicated Store Layout Creator to arrange the Store homepage with draggable heroes, rows, grids, promos, categories, and app cards.</p>
          <div className="product-badges"><span>Separate Layout Window</span><span>Drag/Drop Shelves</span><span>App Catalog Palette</span><span>Publish Store Layout</span></div>
        </div>
        <div className="launcher-actions"><button type="button" className="primary" onClick={openLayoutBuilder}>Open Store Layout Creator</button></div>
      </section>
      <section className="panel">
        <h3>What this controls</h3>
        <p className="muted">This editor controls the Store homepage layout users see in Echo App Center. Add rows, choose categories, pin apps manually, and publish the final layout.</p>
      </section>
    </div>
  );
}

function ReleasesAdmin() {
  const [apps, setApps] = useState<EchoApp[]>([]); const [releases, setReleases] = useState<AppRelease[]>([]); const [appId, setAppId] = useState(''); const [version, setVersion] = useState('1.0.0'); const [platform, setPlatform] = useState('windows-x64'); const [entrypoint, setEntrypoint] = useState('echo-app.json'); const [channel, setChannel] = useState('stable'); const [file, setFile] = useState<File | null>(null); const [changelog, setChangelog] = useState('Initial release'); const [message, setMessage] = useState('');
  async function load() { const [a, r] = await Promise.all([getAdminApps(), getReleases()]); setApps(a); setReleases(r); if (!appId && a[0]) setAppId(a[0].id); }
  useEffect(() => { load().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load releases.')); }, []);
  async function upload() { if (!file) { setMessage('Select a package file first.'); return; } await uploadReleasePackage(appId, { file, version, platform, channel, entrypoint, installType: 'portable', changelog }); setMessage('Release package uploaded as draft.'); await load(); }
  async function transition(id: string, action: 'submit' | 'approve' | 'publish' | 'reject' | 'rollback') { if (action === 'submit') await submitRelease(id); if (action === 'approve') await approveRelease(id); if (action === 'publish') await publishRelease(id); if (action === 'reject') await rejectRelease(id, 'Rejected from admin portal.'); if (action === 'rollback') await rollbackRelease(id); await load(); }
  return <div><h2>Releases</h2><div className="panel"><label>App<select value={appId} onChange={(e) => setAppId(e.target.value)}>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label><div className="details-grid"><label>Version<input value={version} onChange={(e) => setVersion(e.target.value)} /></label><label>Platform<select value={platform} onChange={(e) => setPlatform(e.target.value)}><option>windows-x64</option><option>linux-x64</option></select></label><label>Channel<select value={channel} onChange={(e) => setChannel(e.target.value)}><option>stable</option><option>beta</option><option>dev</option></select></label><label>Entrypoint<input value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} /></label></div><label>Package File<input type="file" accept=".zip,.echoapp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label><label>Changelog<textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} /></label><button onClick={upload}>Upload Release Package</button></div>{message && <p className="muted">{message}</p>}<div className="panel"><h3>Release Queue</h3>{releases.map((rel) => <div className="release-row" key={rel.id}><div><strong>{rel.appId} v{rel.version}</strong><small>{rel.platform} • {rel.channel} • {rel.status}</small></div><div className="action-row"><button onClick={() => transition(rel.id, 'submit')}>Submit</button><button onClick={() => transition(rel.id, 'approve')}>Approve</button><button onClick={() => transition(rel.id, 'publish')}>Publish</button><button onClick={() => transition(rel.id, 'reject')}>Reject</button><button onClick={() => transition(rel.id, 'rollback')}>Rollback</button></div></div>)}</div></div>;
}

function ClientsAdmin() { const [data, setData] = useState<{ clients: any[]; installReports: any[] }>({ clients: [], installReports: [] }); useEffect(() => { getClients().then(setData).catch(() => undefined); }, []); return <div><h2>Client Computers</h2><div className="panel">{data.clients.map((client) => <div className="row" key={client.id}><strong>{client.name}</strong><span>{client.platform}</span><span>{client.lastCheckInAt}</span></div>)}{data.clients.length === 0 && <p className="muted">No clients have checked in.</p>}</div></div>; }
function LogsAdmin() { const [logs, setLogs] = useState<any[]>([]); useEffect(() => { getAuditLogs().then(setLogs).catch(() => undefined); }, []); return <div><h2>Audit Logs</h2><div className="panel">{logs.slice(0, 50).map((log) => <pre key={log.id}>{JSON.stringify(log, null, 2)}</pre>)}</div></div>; }
function ServerSettingsAdmin() { const [settings, setSettings] = useState<any>(); useEffect(() => { getServerRuntimeSettings().then(setSettings).catch(() => undefined); }, []); return <div><h2>Server Settings</h2><pre>{JSON.stringify(settings, null, 2)}</pre></div>; }
