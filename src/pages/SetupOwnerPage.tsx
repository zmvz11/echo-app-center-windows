import { useState } from 'react';
import { createOwner } from '../api/echoServerClient';
import { getServerUrl } from '../auth/sessionStore';
import type { CurrentUser } from '../types/auth';

export function SetupOwnerPage(props: { onCreated: (user: CurrentUser) => void; onBack: () => void }) {
  const [username, setUsername] = useState('owner');
  const [displayName, setDisplayName] = useState('Owner');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const user = await createOwner({ username, displayName, password });
      props.onCreated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Owner setup failed.');
    }
  }

  return (
    <main className="centered-card">
      <form className="auth-card" onSubmit={submit}>
        <h1>Create First Admin</h1>
        <p className="muted">Connected server: {getServerUrl()}</p>
        <p className="muted">No owner account exists on this Echo App Server. Create the first admin account to lock setup and enable the Admin Portal.</p>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>Display Name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Create First Admin</button>
        <button type="button" className="link-button" onClick={props.onBack}>Back to connection</button>
      </form>
    </main>
  );
}
