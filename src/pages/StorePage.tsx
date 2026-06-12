import { useEffect, useState } from 'react';
import { getCatalog } from '../api/echoServerClient';
import { installApp } from '../api/localAgentClient';
import type { EchoApp } from '../types/catalog';
import { mediaUrl } from '../types/catalog';
import { getDefaultPlatform } from '../platform/platform';

export function StorePage() {
  const [apps, setApps] = useState<EchoApp[]>([]);
  const [message, setMessage] = useState('');
  const platform = getDefaultPlatform();

  useEffect(() => { getCatalog().then(setApps).catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load store.')); }, []);

  async function install(id: string) {
    setMessage('Install started. Check Downloads for progress.');
    try { await installApp(id, platform); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Install failed.'); }
  }

  return (
    <section>
      <h1>Store</h1>
      {message && <p className="muted">{message}</p>}
      <div className="store-grid">
        {apps.map((app) => (
          <article className="store-card" key={app.id}>
            {mediaUrl(app, 'store_banner') || mediaUrl(app, 'library_banner') ? <img src={mediaUrl(app, 'store_banner') || mediaUrl(app, 'library_banner')} /> : <div className="placeholder-card">{app.name}</div>}
            <h2>{app.name}</h2>
            <p>{app.shortDescription}</p>
            <button onClick={() => install(app.id)}>Install</button>
          </article>
        ))}
      </div>
    </section>
  );
}
