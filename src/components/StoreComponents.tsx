import type { EchoApp } from '../types/catalog';
import { cardThumbnailUrl, iconUrl, latestStableRelease, libraryBannerUrl, screenshots, storeHeroUrl } from '../types/catalog';

type ActionState = 'install' | 'launch' | 'update' | 'disabled';

export function StoreHero(props: { app: EchoApp; onOpen?: () => void; onAction?: () => void; actionLabel?: string }) {
  const app = props.app;
  const image = storeHeroUrl(app);
  return (
    <article className="steam-hero" onClick={props.onOpen}>
      {image ? <img src={image} alt="" /> : <div className="steam-hero-placeholder">{app.name}</div>}
      <div className="steam-hero-info">
        <div className="eyebrow">Featured</div>
        <h2>{app.name}</h2>
        <p>{app.shortDescription}</p>
        <div className="tag-row">{(app.tags ?? []).slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <button type="button" onClick={(event) => { event.stopPropagation(); props.onAction?.(); }}>{props.actionLabel ?? 'View App'}</button>
      </div>
    </article>
  );
}

export function StoreAppCard(props: { app: EchoApp; onOpen?: () => void; onAction?: () => void; state?: ActionState }) {
  const image = cardThumbnailUrl(props.app);
  const icon = iconUrl(props.app);
  const release = latestStableRelease(props.app);
  const label = props.state === 'launch' ? 'Launch' : props.state === 'update' ? 'Update' : props.state === 'disabled' ? 'Unavailable' : 'Install';
  return (
    <article className="steam-app-card" onClick={props.onOpen}>
      <div className="steam-card-image">{image ? <img src={image} alt="" /> : <span>{props.app.name}</span>}</div>
      <div className="steam-card-body">
        {icon ? <img className="app-icon" src={icon} alt="" /> : <span className="app-icon generated">E</span>}
        <div className="steam-card-copy">
          <h3>{props.app.name}</h3>
          <p>{props.app.shortDescription}</p>
        </div>
      </div>
      <div className="steam-card-footer">
        <div className="tag-row compact">{(props.app.tags ?? []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <button type="button" disabled={props.state === 'disabled'} onClick={(event) => { event.stopPropagation(); props.onAction?.(); }}>{label}</button>
      </div>
      {release && <small className="version-badge">v{release.version}</small>}
    </article>
  );
}

export function StoreAppDetail(props: { app: EchoApp; onBack?: () => void; onAction?: () => void; actionLabel?: string }) {
  const app = props.app;
  const shots = screenshots(app);
  const hero = libraryBannerUrl(app) ?? storeHeroUrl(app);
  const release = latestStableRelease(app);
  return (
    <article className="steam-detail-page">
      {props.onBack && <button className="link-button" onClick={props.onBack}>← Back to Store</button>}
      <div className="steam-detail-title"><small>All Apps › {app.category}</small><h1>{app.name}</h1></div>
      <div className="steam-detail-grid">
        <div className="media-theater">
          {hero ? <img className="main-media" src={hero} alt="" /> : <div className="main-media placeholder-hero">{app.name}</div>}
          <div className="filmstrip">{shots.length ? shots.slice(0, 8).map((shot) => <img key={shot.id} src={shot.url} alt="" />) : <span>No screenshots uploaded.</span>}</div>
        </div>
        <aside className="detail-sidebar">
          {storeHeroUrl(app) ? <img src={storeHeroUrl(app)} alt="" /> : <div className="sidebar-logo">{app.name}</div>}
          <p>{app.fullDescription || app.shortDescription}</p>
          <dl>
            <dt>Developer</dt><dd>{app.developer}</dd>
            <dt>Category</dt><dd>{app.category}</dd>
            <dt>Latest Version</dt><dd>{release?.version ?? 'No release yet'}</dd>
            <dt>Platforms</dt><dd>{app.platforms?.join(', ') || 'Windows, Linux'}</dd>
          </dl>
          <div className="tag-row">{(app.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div>
        </aside>
      </div>
      <div className="download-box">
        <div><h2>{release ? `Download ${app.name}` : `${app.name} is not ready to install`}</h2><p>{release ? `Stable release ${release.version}` : 'Add and publish a release package from the Admin Portal.'}</p></div>
        <button onClick={props.onAction}>{props.actionLabel ?? (release ? 'Install' : 'No Release')}</button>
      </div>
    </article>
  );
}

export function StoreSectionRow(props: { title: string; apps: EchoApp[]; onOpen: (app: EchoApp) => void; onAction?: (app: EchoApp) => void }) {
  return (
    <section className="steam-row-section">
      <div className="section-header"><h2>{props.title}</h2><button type="button">See More</button></div>
      <div className="horizontal-scroller"><button className="scroll-arrow left" type="button">‹</button><div className="steam-row-cards">{props.apps.map((app) => <StoreAppCard key={app.id} app={app} onOpen={() => props.onOpen(app)} onAction={() => props.onAction?.(app)} />)}</div><button className="scroll-arrow right" type="button">›</button></div>
    </section>
  );
}

export function LibraryTile(props: { app: EchoApp; selected?: boolean; status: string; onClick: () => void }) {
  const image = cardThumbnailUrl(props.app) ?? libraryBannerUrl(props.app) ?? storeHeroUrl(props.app);
  return (
    <button className={`library-cover ${props.selected ? 'active' : ''}`} onClick={props.onClick}>
      {image ? <img src={image} alt="" /> : <span>{props.app.name}</span>}
      <strong>{props.app.name}</strong>
      <small>{props.status}</small>
    </button>
  );
}
