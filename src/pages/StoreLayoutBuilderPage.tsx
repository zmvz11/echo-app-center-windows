import { useEffect, useMemo, useRef, useState } from 'react';
import { getAdminApps, getStoreLayout, saveStoreLayout } from '../api/echoServerClient';
import type { EchoApp, StoreLayout, StoreLayoutSection, StoreLayoutSectionType, StoreLayoutSource } from '../types/catalog';
import { cardThumbnailUrl, iconUrl, storeHeroUrl } from '../types/catalog';
import { StoreAppCard, StoreHero, StoreSectionRow } from '../components/StoreComponents';

const componentGroups: Array<{ title: string; items: Array<{ type: StoreLayoutSectionType; label: string; hint: string }> }> = [
  { title: 'Feature Blocks', items: [
    { type: 'hero', label: 'Hero Feature', hint: 'Large top feature with image and action button.' },
    { type: 'promo', label: 'Promo Banner', hint: 'Wide text panel for announcements or featured collections.' },
  ] },
  { title: 'App Shelves', items: [
    { type: 'app_row', label: 'Horizontal App Row', hint: 'Scrollable shelf with arrows.' },
    { type: 'app_grid', label: 'App Grid', hint: 'Dense Store grid for collections.' },
    { type: 'category_row', label: 'Category Row', hint: 'Auto-filled row from one category.' },
  ] },
  { title: 'Navigation', items: [
    { type: 'category_tabs', label: 'Category Tabs', hint: 'Quick category filter section.' },
    { type: 'spacer', label: 'Spacing Block', hint: 'Adds breathing room between sections.' },
  ] },
];

const defaultSectionTitles: Record<StoreLayoutSectionType, string> = {
  hero: 'Featured App',
  app_row: 'Featured & Recommended',
  app_grid: 'Browse Echo Apps',
  category_row: 'Category Shelf',
  category_tabs: 'Browse by Category',
  promo: 'Store Announcement',
  spacer: 'Spacing',
};

function newSection(type: StoreLayoutSectionType, apps: EchoApp[]): StoreLayoutSection {
  const firstFeatured = apps.find((app) => app.featured)?.id ?? apps[0]?.id ?? '';
  return {
    id: `section-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title: defaultSectionTitles[type],
    enabled: true,
    source: type === 'hero' && firstFeatured ? 'manual' : type === 'category_row' ? 'category' : type === 'app_grid' ? 'all' : 'featured',
    appIds: type === 'hero' && firstFeatured ? [firstFeatured] : [],
    category: apps[0]?.category ?? 'Utility',
    limit: type === 'hero' ? 1 : type === 'app_grid' ? 12 : 8,
    note: type === 'promo' ? 'Use this space for update notes, featured categories, or admin announcements.' : '',
  };
}

function fallbackLayout(): StoreLayout {
  return {
    id: 'default-store-layout',
    title: 'Echo Store Layout',
    status: 'published',
    sections: [
      { id: 'hero', type: 'hero', title: 'Featured App', enabled: true, source: 'featured', appIds: [], limit: 1 },
      { id: 'featured', type: 'app_row', title: 'Featured & Recommended', enabled: true, source: 'featured', appIds: [], limit: 10 },
      { id: 'recent', type: 'app_row', title: 'Recently Updated', enabled: true, source: 'recently_updated', appIds: [], limit: 10 },
      { id: 'all', type: 'app_grid', title: 'All Echo Apps', enabled: true, source: 'all', appIds: [], limit: 12 },
    ],
  };
}

function appsForSection(section: StoreLayoutSection, apps: EchoApp[]): EchoApp[] {
  let selected: EchoApp[] = [];
  if (section.source === 'manual') selected = section.appIds.map((id) => apps.find((app) => app.id === id)).filter(Boolean) as EchoApp[];
  if (section.source === 'featured') selected = apps.filter((app) => app.featured);
  if (section.source === 'category') selected = apps.filter((app) => app.category === section.category);
  if (section.source === 'recently_updated') selected = [...apps].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  if (section.source === 'all') selected = [...apps];
  if (section.source !== 'manual' && section.appIds.length) {
    const pinned = section.appIds.map((id) => apps.find((app) => app.id === id)).filter(Boolean) as EchoApp[];
    const remaining = selected.filter((app) => !section.appIds.includes(app.id));
    selected = [...pinned, ...remaining];
  }
  return selected.slice(0, Math.max(1, section.limit || 8));
}

function groupAppsByCategory(apps: EchoApp[]): Array<{ category: string; apps: EchoApp[] }> {
  const map = new Map<string, EchoApp[]>();
  for (const app of apps) {
    const category = app.category || 'Uncategorized';
    map.set(category, [...(map.get(category) ?? []), app]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => ({ category, apps: items.sort((a, b) => a.name.localeCompare(b.name)) }));
}

export function StoreLayoutBuilderPage() {
  const [apps, setApps] = useState<EchoApp[]>([]);
  const [layout, setLayout] = useState<StoreLayout>(fallbackLayout());
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const [openCategory, setOpenCategory] = useState('');
  const allowCloseRef = useRef(false);

  const publishedApps = useMemo(() => apps.filter((app) => app.visibility === 'published' || app.visibility === 'draft' || app.visibility === 'hidden'), [apps]);
  const categories = useMemo(() => Array.from(new Set(apps.map((app) => app.category).filter(Boolean))).sort(), [apps]);
  const groupedApps = useMemo(() => groupAppsByCategory(apps.filter((app) => `${app.name} ${app.id} ${app.category}`.toLowerCase().includes(appSearch.toLowerCase()))), [apps, appSearch]);
  const selectedSection = layout.sections.find((section) => section.id === selectedSectionId) ?? layout.sections[0];

  useEffect(() => {
    async function load() {
      try {
        const [loadedApps, loadedLayout] = await Promise.all([getAdminApps(), getStoreLayout().catch(() => fallbackLayout())]);
        setApps(loadedApps);
        setLayout(loadedLayout.sections?.length ? loadedLayout : fallbackLayout());
        setSelectedSectionId(loadedLayout.sections?.[0]?.id ?? '');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load Store Layout Creator.');
      }
    }
    load().catch(() => undefined);
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (allowCloseRef.current || !dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function updateLayout(next: StoreLayout): void {
    setLayout(next);
    setDirty(true);
  }

  function updateSection(id: string, patch: Partial<StoreLayoutSection>): void {
    updateLayout({ ...layout, sections: layout.sections.map((section) => section.id === id ? { ...section, ...patch } : section) });
  }

  function addComponent(type: StoreLayoutSectionType): void {
    const section = newSection(type, apps);
    updateLayout({ ...layout, sections: [...layout.sections, section] });
    setSelectedSectionId(section.id);
  }

  function removeSection(id: string): void {
    if (!window.confirm('Remove this Store layout section?')) return;
    const nextSections = layout.sections.filter((section) => section.id !== id);
    updateLayout({ ...layout, sections: nextSections });
    setSelectedSectionId(nextSections[0]?.id ?? '');
  }

  function duplicateSection(section: StoreLayoutSection): void {
    const copy = { ...section, id: `section-${Date.now()}-${Math.random().toString(16).slice(2)}`, title: `${section.title} Copy` };
    const index = layout.sections.findIndex((item) => item.id === section.id);
    const next = [...layout.sections];
    next.splice(index + 1, 0, copy);
    updateLayout({ ...layout, sections: next });
    setSelectedSectionId(copy.id);
  }

  function moveSection(id: string, direction: -1 | 1): void {
    const index = layout.sections.findIndex((section) => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layout.sections.length) return;
    const next = [...layout.sections];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateLayout({ ...layout, sections: next });
  }

  function addAppToSection(sectionId: string, appId: string): void {
    const section = layout.sections.find((item) => item.id === sectionId);
    if (!section || section.appIds.includes(appId)) return;
    updateSection(sectionId, { source: 'manual', appIds: [...section.appIds, appId] });
  }

  function removeAppFromSection(sectionId: string, appId: string): void {
    const section = layout.sections.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, { appIds: section.appIds.filter((id) => id !== appId) });
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    if (raw.startsWith('component:')) addComponent(raw.replace('component:', '') as StoreLayoutSectionType);
  }

  function handleSectionDrop(sectionId: string, event: React.DragEvent<HTMLElement>): void {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    if (raw.startsWith('app:')) addAppToSection(sectionId, raw.replace('app:', ''));
    if (raw.startsWith('component:')) addComponent(raw.replace('component:', '') as StoreLayoutSectionType);
  }

  async function save(status: 'draft' | 'published') {
    if (saving) return;
    setSaving(true);
    setMessage(status === 'published' ? 'Publishing Store layout...' : 'Saving Store layout draft...');
    try {
      const saved = await saveStoreLayout({ ...layout, status });
      setLayout(saved);
      setDirty(false);
      setMessage(status === 'published' ? 'Store layout published. The Store page will use this layout.' : 'Store layout draft saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save Store layout.');
    } finally {
      setSaving(false);
    }
  }

  function closeWindow() {
    if (dirty && !window.confirm('You have unsaved Store layout changes. Close anyway?')) return;
    allowCloseRef.current = true;
    void window.echoDesktop?.closeStoreLayoutBuilder?.();
    if (!window.echoDesktop) window.close();
  }

  function renderPreviewSection(section: StoreLayoutSection) {
    if (!section.enabled) return null;
    const sectionApps = appsForSection(section, publishedApps);
    if (section.type === 'spacer') return <div className="store-layout-spacer" />;
    if (section.type === 'promo') return <section className="store-layout-promo"><span className="eyebrow">Store Feature</span><h2>{section.title}</h2><p>{section.note || 'Add a curated message, release spotlight, or category promotion here.'}</p></section>;
    if (section.type === 'category_tabs') return <div className="category-tabs layout-preview-tabs">{categories.map((category) => <button type="button" key={category}>{category}</button>)}</div>;
    if (section.type === 'hero') return sectionApps[0] ? <StoreHero app={sectionApps[0]} actionLabel="Preview" /> : <div className="store-empty"><h2>{section.title}</h2><p>Drag an app from the catalog into this section.</p></div>;
    if (section.type === 'app_grid') return <section><h2>{section.title}</h2><div className="store-feature-grid">{sectionApps.map((app) => <StoreAppCard key={app.id} app={app} state="install" />)}</div></section>;
    return <StoreSectionRow title={section.title} apps={sectionApps} onOpen={() => undefined} />;
  }

  return (
    <div className="store-layout-builder-shell">
      <header className="builder-window-topbar store-layout-topbar">
        <div><h1>Echo Store Layout Creator</h1><p>Build the Store home page with draggable shelves, heroes, promos, categories, and app cards.</p></div>
        <div className="launcher-actions"><button type="button" disabled={saving} onClick={() => save('draft')}>{saving ? 'Saving...' : 'Save Draft'}</button><button type="button" disabled={saving} className="primary" onClick={() => save('published')}>{saving ? 'Publishing...' : 'Publish Layout'}</button><button type="button" onClick={closeWindow}>Close</button></div>
      </header>
      {dirty && <div className="unsaved-banner">Unsaved Store layout changes. Save Draft or Publish Layout before closing.</div>}
      {message && <p className={message.toLowerCase().includes('fail') ? 'error layout-message' : 'muted layout-message'}>{message}</p>}
      <div className="store-layout-builder-grid">
        <aside className="sims-catalog-panel">
          <div className="catalog-heading"><span className="eyebrow">Build Catalog</span><h2>Components</h2><p>Drag blocks onto the Store canvas.</p></div>
          {componentGroups.map((group) => <details key={group.title} open><summary>{group.title}</summary><div className="component-tile-grid">{group.items.map((item) => <button type="button" key={item.type} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', `component:${item.type}`)} onClick={() => addComponent(item.type)}><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div></details>)}
          <div className="catalog-heading"><span className="eyebrow">App Catalog</span><h2>Apps by Category</h2><p>Open a category, then drag apps into manual sections.</p></div>
          <input value={appSearch} onChange={(event) => setAppSearch(event.target.value)} placeholder="Search apps" />
          <div className="app-catalog-accordion">
            {groupedApps.map((group) => <section key={group.category}><button type="button" className="catalog-category-button" onClick={() => setOpenCategory(openCategory === group.category ? '' : group.category)}>{group.category}<span>{group.apps.length}</span></button>{openCategory === group.category && <div className="catalog-app-list">{group.apps.map((app) => <div key={app.id} className="catalog-app-chip" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', `app:${app.id}`)}><div>{iconUrl(app) ? <img src={iconUrl(app)} alt="" /> : <span className="small-icon">E</span>}</div><span><strong>{app.name}</strong><small>{app.visibility} • {app.id}</small></span></div>)}</div>}</section>)}
          </div>
        </aside>
        <main className="store-layout-canvas" onDragOver={(event) => event.preventDefault()} onDrop={handleCanvasDrop}>
          <div className="layout-canvas-header"><div><span className="eyebrow">Live Store Page</span><h2>{layout.title}</h2></div><input value={layout.title} onChange={(event) => updateLayout({ ...layout, title: event.target.value })} /></div>
          {layout.sections.length === 0 && <div className="store-empty"><h2>Drop a Store component here.</h2><p>Use the left catalog to add a hero, row, grid, promo, or category section.</p></div>}
          {layout.sections.map((section, index) => <section key={section.id} className={`layout-section-frame ${selectedSectionId === section.id ? 'active' : ''}`} onClick={() => setSelectedSectionId(section.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleSectionDrop(section.id, event)}>
            <div className="layout-section-toolbar"><strong>{index + 1}. {section.title}</strong><span>{section.type.replace('_', ' ')}</span><div className="action-row"><button type="button" onClick={(event) => { event.stopPropagation(); moveSection(section.id, -1); }}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveSection(section.id, 1); }}>↓</button><button type="button" onClick={(event) => { event.stopPropagation(); duplicateSection(section); }}>Duplicate</button><button type="button" className="danger" onClick={(event) => { event.stopPropagation(); removeSection(section.id); }}>Remove</button></div></div>
            <div className="layout-section-drop-hint">Drop apps here to manually pin them to this section.</div>
            {renderPreviewSection(section)}
          </section>)}
        </main>
        <aside className="store-layout-inspector">
          <span className="eyebrow">Inspector</span>
          {selectedSection ? <>
            <h2>{selectedSection.title}</h2>
            <label>Section Title<input value={selectedSection.title} onChange={(event) => updateSection(selectedSection.id, { title: event.target.value })} /></label>
            <label>Section Type<select value={selectedSection.type} onChange={(event) => updateSection(selectedSection.id, { type: event.target.value as StoreLayoutSectionType })}><option value="hero">Hero Feature</option><option value="app_row">Horizontal App Row</option><option value="app_grid">App Grid</option><option value="category_row">Category Row</option><option value="category_tabs">Category Tabs</option><option value="promo">Promo Banner</option><option value="spacer">Spacing Block</option></select></label>
            <label>Source<select value={selectedSection.source} onChange={(event) => updateSection(selectedSection.id, { source: event.target.value as StoreLayoutSource })}><option value="manual">Manual dragged apps</option><option value="featured">Featured apps</option><option value="recently_updated">Recently updated</option><option value="category">Category</option><option value="all">All apps</option></select></label>
            <label>Category<select value={selectedSection.category ?? categories[0] ?? ''} onChange={(event) => updateSection(selectedSection.id, { category: event.target.value, source: 'category' })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>Limit<input type="number" min={1} max={24} value={selectedSection.limit} onChange={(event) => updateSection(selectedSection.id, { limit: Number(event.target.value) || 1 })} /></label>
            <label className="check-row"><input type="checkbox" checked={selectedSection.enabled} onChange={(event) => updateSection(selectedSection.id, { enabled: event.target.checked })} /> Enabled on Store</label>
            <label>Promo / Admin Note<textarea value={selectedSection.note ?? ''} onChange={(event) => updateSection(selectedSection.id, { note: event.target.value })} /></label>
            <div className="panel"><h3>Pinned Apps</h3>{selectedSection.appIds.length === 0 && <p className="muted">Drag apps from the catalog to pin them here.</p>}{selectedSection.appIds.map((appId) => { const app = apps.find((item) => item.id === appId); return <div className="row" key={appId}><span>{app?.name ?? appId}</span><button type="button" onClick={() => removeAppFromSection(selectedSection.id, appId)}>Remove</button></div>; })}</div>
          </> : <p className="muted">Select a layout section to edit it.</p>}
        </aside>
      </div>
    </div>
  );
}
