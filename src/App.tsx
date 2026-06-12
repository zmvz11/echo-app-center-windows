import { useEffect, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { CreateAccountPage } from './pages/CreateAccountPage';
import { SetupOwnerPage } from './pages/SetupOwnerPage';
import { StorePage } from './pages/StorePage';
import { LibraryPage } from './pages/LibraryPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { me, logout, setupStatus } from './api/echoServerClient';
import { checkInClient } from './api/localAgentClient';
import type { CurrentUser } from './types/auth';
import { userCan } from './types/auth';

export type Page = 'login' | 'create' | 'setup' | 'store' | 'library' | 'downloads' | 'settings' | 'admin';

export function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState<Page>('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setupStatus()
      .then((status) => {
        if (status.needsOwner) {
          setPage('setup');
          return null;
        }
        return me().then((current) => {
          setUser(current);
          setPage('library');
          checkInClient().catch(() => undefined);
        });
      })
      .catch(() => {
        setPage('login');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="centered-card">Loading Echo App Center...</main>;

  if (!user) {
    if (page === 'setup') {
      return <SetupOwnerPage onBack={() => setPage('login')} onCreated={(current) => { setUser(current); setPage('library'); }} />;
    }
    if (page === 'create') return <CreateAccountPage onBack={() => setPage('login')} />;
    return (
      <LoginPage
        onLoggedIn={(current) => { setUser(current); setPage('library'); checkInClient().catch(() => undefined); }}
        onCreateAccount={() => setPage('create')}
        onNeedsOwner={() => setPage('setup')}
      />
    );
  }

  const canAdmin = userCan(user, 'users.approve') || userCan(user, 'apps.create') || userCan(user, 'releases.approve') || userCan(user, 'logs.view');

  return (
    <div className="app-shell">
      <aside className="main-nav">
        <div className="brand">Echo App Center</div>
        <button className={page === 'store' ? 'active' : ''} onClick={() => setPage('store')}>Store</button>
        <button className={page === 'library' ? 'active' : ''} onClick={() => setPage('library')}>Library</button>
        <button className={page === 'downloads' ? 'active' : ''} onClick={() => setPage('downloads')}>Downloads</button>
        <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}>Settings</button>
        {canAdmin && <button className={page === 'admin' ? 'active' : ''} onClick={() => setPage('admin')}>Admin Portal</button>}
        <div className="nav-footer">
          <div>{user.displayName || user.username}</div>
          <small>{user.role}</small>
          <button onClick={() => logout().then(() => { setUser(null); setPage('login'); })}>Log out</button>
        </div>
      </aside>
      <main className="content">
        {page === 'store' && <StorePage />}
        {page === 'library' && <LibraryPage />}
        {page === 'downloads' && <DownloadsPage />}
        {page === 'settings' && <SettingsPage />}
        {page === 'admin' && canAdmin && <AdminPortalPage user={user} />}
      </main>
    </div>
  );
}
