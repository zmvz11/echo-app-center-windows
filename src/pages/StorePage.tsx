import { useEffect, useMemo, useRef, useState } from 'react';
import { getCatalog, getStoreApps, getStoreCategories, getStoreSections } from '../api/echoServerClient';
import { installApp, launchApp, listInstalledApps, updateApp } from '../api/localAgentClient';
import type { EchoApp, InstalledApp, StoreSection } from '../types/catalog';
import { latestStableRelease, storeHeroUrl } from '../types/catalog';
import { getDefaultPlatform } from '../platform/platform';
import { StoreAppCard, StoreAppDetail, StoreHero, StoreSectionRow } from '../components/StoreComponents';

type StoreMode = 'browse' | 'recommendations' | 'categories' | 'special';

export function StorePage() {
  const [apps, setApps] = useState<EchoApp[]>([]);
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [installed, setInstalled] = useState<InstalledApp[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<StoreMode>('browse');
  const [message, setMessage] = useState('');
  const categoryRef = useRef<HTMLDivElement | null>(null);
  const sectionsRef = useRef<HTMLDivElement | null>(null);
  const platform = getDefaultPlatform();

  async function load() {
    setMessage('Loading Store...');
    try {
      const [storeApps, storeSections, cats, local] = await Promise.all([
        getStoreApps(),
        getStoreSections().catch(() => []),
        getStoreCategories().catch(() => []),
        listInstalledApps().catch(() => []),
      ]);
      setApps(storeApps);
      setSections(storeSections);
      setCategories(['All', ...cats.filter((cat) => cat !== 'All')]);
      setInstalled(local);
      setMessage('');
    } catch (error) {
      try {
        const [catalogApps, local] = await Promise.all([getCatalog(), listInstalledApps().catch(() => [])]);
        setApps(catalogApps.filter((app) => app.visibility === 'published'));
        setSections([]);
        setCategories(['All', ...Array.from(new Set(catalogApps.map((app) => app.category).filter(Boolean)))]);
        setInstalled(local);
        setMessage('Store API was unavailable, so Echo App Center loaded the catalog fallback. Update Echo App Server to Store API v2 for the full Store layout.');
      } catch {
        setMessage(error instanceof Error ? error.message : 'Failed to load store.');
      }
    }
  }

  useEffect(() => { load(); }, []);

  const installedMap = useMemo(() => new Map(installed.map((app) => [app.appId, app])), [installed]);
  const featured = apps.filter((app) => app.featured || storeHeroUrl(app)).slice(0, 6);
  const filteredApps = apps.filter((app) => {
    const matchesCategory = activeCategory === 'All' || app.category === activeCategory;
    const haystack = `${app.name} ${app.shortDescription} ${app.category} ${(app.tags ?? []).join(' ')}`.toLowerCase();
    const matchesSearch = !query.trim() || haystack.includes(query.toLowerCase());
    const matchesMode = mode !== 'special' || app.featured || (app.tags ?? []).some((tag) => /featured|special|utility/i.test(tag));
    return matchesCategory && matchesSearch && matchesMode;
  });
  const selected = apps.find((app) => app.id === selectedId);
  const hero = mode === 'recommendations' ? (featured[1] ?? featured[0] ?? apps[0]) : (featured[0] ?? apps[0]);

  function actionState(app: EchoApp): 'install' | 'launch' | 'update' | 'disabled' {
    const local = installedMap.get(app.id);
    const latest = latestStableRelease(app, platform);
    if (!latest) return 'disabled';
    if (!local) return 'install';
    if (latest.version !== local.version) return 'update';
    return 'launch';
  }

  async function runAction(app: EchoApp) {
    const state = actionState(app);
    try {
      if (state === 'disabled') { setMessage(`${app.name} has no published release for ${platform}.`); return; }
      if (state === 'install') { setMessage(`Installing ${app.name}...`); await installApp(app.id, platform); }
      if (state === 'update') { setMessage(`Updating ${app.name}...`); await updateApp(app.id, platform); }
      if (state === 'launch') { setMessage(`Launching ${app.name}...`); await launchApp(app.id); }
      await load();
      setMessage(`${app.name}: ${state} completed.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `${app.name} action failed.`);
    }
  }

  function setTopMode(next: StoreMode): void {
    setMode(next);
    if (next === 'browse') { setActiveCategory('All'); setQuery(''); }
    if (next === 'recommendations') { setActiveCategory('All'); setMessage('Showing featured and recommended Echo apps.'); }
    if (next === 'categories') { categoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (next === 'special') { sectionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }

  if (selected) {
    const state = actionState(selected);
    return <StoreAppDetail app={selected} onBack={() => setSelectedId('')} onAction={() => runAction(selected)} actionLabel={state === 'launch' ? 'Launch' : state === 'update' ? 'Update' : state === 'disabled' ? 'No Release' : 'Install'} />;
  }

  return (
    <section className="steam-store-page">
      <div className="store-topbar"><nav><button className={mode === 'browse' ? 'active' : ''} onClick={() => setTopMode('browse')}>Browse</button><button className={mode === 'recommendations' ? 'active' : ''} onClick={() => setTopMode('recommendations')}>Recommendations</button><button className={mode === 'categories' ? 'active' : ''} onClick={() => setTopMode('categories')}>Categories</button><button className={mode === 'special' ? 'active' : ''} onClick={() => setTopMode('special')}>Special Sections</button></nav><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the store" /></div>
      {message && <p className={message.includes('failed') || message.includes('404') ? 'error' : 'muted'}>{message}</p>}
      {hero ? <StoreHero app={hero} onOpen={() => setSelectedId(hero.id)} onAction={() => runAction(hero)} actionLabel={actionState(hero) === 'launch' ? 'Launch' : actionState(hero) === 'update' ? 'Update' : actionState(hero) === 'disabled' ? 'No Release' : 'Install'} /> : <div className="store-empty"><h1>No apps published yet.</h1><p>Open Admin Portal → Add Apps to add your first Echo app.</p></div>}
      <div className="category-tabs" ref={categoryRef}>{categories.map((category) => <button key={category} className={activeCategory === category ? 'active' : ''} onClick={() => { setActiveCategory(category); setMode('browse'); }}>{category}</button>)}</div>
      {filteredApps.length > 0 && <section><h2>{mode === 'special' ? 'Special Sections' : 'Featured & Recommended'}</h2><div className="store-feature-grid">{filteredApps.slice(0, 8).map((app) => <StoreAppCard key={app.id} app={app} state={actionState(app)} onOpen={() => setSelectedId(app.id)} onAction={() => runAction(app)} />)}</div></section>}
      <div ref={sectionsRef}>{sections.filter((section) => section.apps.length > 0).map((section) => <StoreSectionRow key={section.id} title={section.title} apps={section.apps} onOpen={(app) => setSelectedId(app.id)} onAction={runAction} onSeeMore={() => { setMode('special'); setActiveCategory('All'); }} />)}</div>
      {filteredApps.length === 0 && apps.length > 0 && <div className="store-empty"><h2>No matches.</h2><p>Try a different search or category.</p></div>}
    </section>
  );
}
