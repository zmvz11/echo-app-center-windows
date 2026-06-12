import { FormEvent, useState } from 'react';
import { register } from '../api/echoServerClient';
import { validateUsername } from '../auth/usernameRules';

export function CreateAccountPage(props: { onBack: () => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const usernameError = validateUsername(username);
    if (usernameError) return setError(usernameError);
    if (password.length < 12) return setError('Password must be at least 12 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    try {
      await register({ username, displayName: displayName || undefined, password, requestNote: requestNote || undefined });
      setMessage('Account created. Waiting for admin approval.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed.');
    }
  }

  return (
    <main className="centered-card">
      <form className="auth-card" onSubmit={submit}>
        <h1>Create Echo Account</h1>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></label>
        <label>Display Name optional<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label>Confirm Password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <label>Request Note optional<textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <button type="submit">Create Account</button>
        <button type="button" className="link-button" onClick={props.onBack}>Back to login</button>
      </form>
    </main>
  );
}
