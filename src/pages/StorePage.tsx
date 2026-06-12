import { useEffect, useMemo, useState } from 'react';
import { getStoreApps, getStoreCategories, getStoreSections } from '../api/echoServerClient';
import { installApp, launchApp, listInstalledApps, updateApp } from '../api/localAgentClient';
import type { EchoApp, InstalledApp, StoreSection } from '../types/catalog';
import { latestStableRelease, storeHeroUrl } from '../types/catalog';
import { getDefaultPlatform } from '../platform/platform';
import { StoreAppCard, StoreAppDetail, StoreHero, StoreSectionRow } from '../components/StoreComponents';

export function StorePage() {
  const [apps, setApps] = useState<EchoApp[]>([]);
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [installed, setInstalled] = useState<InstalledApp[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const platform = getDefaultPlatform();

  async function load() {
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
  }

  useEffect(() => { load().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load store.')); }, []);

  const installedMap = useMemo(() => new Map(installed.map((app) => [app.appId, app])), [installed]);
  const featured = apps.filter((app) => app.featured || storeHeroUrl(app)).slice(0, 6);
  const filteredApps = apps.filter((app) => {
    const matchesCategory = activeCategory === 'All' || app.category === activeCategory;
    const haystack = `${app.name} ${app.shortDescription} ${app.category} ${(app.tags ?? []).join(' ')}`.toLowerCase();
    const matchesSearch = !query.trim() || haystack.includes(query.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const selected = apps.find((app) => app.id === selectedId);
  const hero = featured[0] ?? apps[0];

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
      if (state === 'install') { setMessage(`Installing ${app.name}...`); await installApp(app.id, platform); }
      if (state === 'update') { setMessage(`Updating ${app.name}...`); await updateApp(app.id, platform); }
      if (state === 'launch') { setMessage(`Launching ${app.name}...`); await launchApp(app.id); }
      await load();
      setMessage(`${app.name}: ${state} completed.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `${app.name} action failed.`);
    }
  }

  if (selected) {
    return <StoreAppDetail app={selected} onBack={() => setSelectedId('')} onAction={() => runAction(selected)} actionLabel={actionState(selected) === 'launch' ? 'Launch' : actionState(selected) === 'update' ? 'Update' : 'Install'} />;
  }

  return (
    <section className="steam-store-page">
      <div className="store-topbar"><nav><button>Browse</button><button>Recommendations</button><button>Categories</button><button>Special Sections</button></nav><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the store" /></div>
      {message && <p className="muted">{message}</p>}
      {hero ? <StoreHero app={hero} onOpen={() => setSelectedId(hero.id)} onAction={() => runAction(hero)} actionLabel={actionState(hero) === 'launch' ? 'Launch' : actionState(hero) === 'update' ? 'Update' : 'Install'} /> : <div className="store-empty"><h1>No apps published yet.</h1><p>Open Admin Portal → Apps to add your first Echo app.</p></div>}
      <div className="category-tabs">{categories.map((category) => <button key={category} className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)}>{category}</button>)}</div>
      {filteredApps.length > 0 && <section><h2>Featured & Recommended</h2><div className="store-feature-grid">{filteredApps.slice(0, 8).map((app) => <StoreAppCard key={app.id} app={app} state={actionState(app)} onOpen={() => setSelectedId(app.id)} onAction={() => runAction(app)} />)}</div></section>}
      {sections.filter((section) => section.apps.length > 0).map((section) => <StoreSectionRow key={section.id} title={section.title} apps={section.apps} onOpen={(app) => setSelectedId(app.id)} onAction={runAction} />)}
      {filteredApps.length === 0 && apps.length > 0 && <div className="store-empty"><h2>No matches.</h2><p>Try a different search or category.</p></div>}
    </section>
  );
}
