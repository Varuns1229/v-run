import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { fmt, timeAgo } from '../lib.js';

const FIT_MESSAGES = {
  connected: ['Google Fit connected! Your real steps are synced.', 'success'],
  fallback: ['Google Fit linked, but the first sync failed, so demo data is shown for now.', 'info'],
  error: ['Could not connect Google Fit.', 'error'],
};

export default function Profile() {
  const { user, updateProfile, refreshUser, logout } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [fit, setFit] = useState(null);
  const [name, setName] = useState(user.name);
  const [goal, setGoal] = useState(user.dailyGoal);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const status = params.get('fit');
    if (status && FIT_MESSAGES[status]) {
      const [msg, type] = FIT_MESSAGES[status];
      const detail = params.get('msg');
      toast(detail ? `${msg} ${detail}` : msg, type);
      setParams({}, { replace: true });
      refreshUser().catch(() => {});
    }
  }, [params, setParams, toast, refreshUser]);

  useEffect(() => {
    api.get('/googlefit/status').then(setFit).catch(() => setFit({ configured: false, connected: false }));
  }, [user.googleConnected]);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await api.get('/googlefit/auth-url');
      window.location.assign(url);
    } catch (err) {
      toast(err.message, 'info');
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Google Fit? Your synced history stays, but new steps will stop syncing.')) return;
    setBusy(true);
    try {
      await api.post('/googlefit/disconnect');
      await refreshUser();
      toast('Google Fit disconnected', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({ name, dailyGoal: Number(goal) });
      toast('Profile saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <div className="profile-head card">
        <Avatar name={user.name} color={user.avatarColor} size={72} />
        <div>
          <h1>{user.name}</h1>
          <p className="muted">{user.email}</p>
          <small className="muted">Walking with V-Run since {new Date(String(user.createdAt).replace(' ', 'T')).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</small>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Google Fit</h3>
          <span className={`pill ${user.googleConnected ? 'pill-ok' : 'pill-warn'}`}>
            {user.googleConnected ? '🟢 Connected' : '⚪ Not connected'}
          </span>
        </div>
        <p className="muted">
          {user.googleConnected
            ? `Steps sync automatically when you open V-Run. Last sync ${timeAgo(user.lastSyncedAt)}.`
            : 'Connect your Google account to sync the steps your phone already counts. We only ask for read access to your activity.'}
        </p>
        {fit && !fit.configured && (
          <div className="alert alert-info small">
            Google Fit sign-in isn’t configured on this server, so V-Run is running on a sample month of demo data.
            Google has also closed new Google Fit API sign-ups and is retiring the API in 2026.
          </div>
        )}
        <div className="row gap-sm">
          {user.googleConnected ? (
            <button className="btn btn-danger" onClick={disconnect} disabled={busy}>Disconnect</button>
          ) : (
            <button className="btn btn-google" onClick={connect} disabled={busy || (fit && !fit.configured)}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Connect Google Fit
            </button>
          )}
        </div>
      </section>

      <form className="card" onSubmit={save}>
        <h3>Your goal</h3>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required />
        </label>
        <label className="field">
          <span>Daily step goal: <strong className="ink">{fmt(goal)}</strong></span>
          <input type="range" min={2000} max={30000} step={500} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <p className="muted small">10,000 is the classic target. Streaks, plants and rewards all follow your goal.</p>
        <button className="btn btn-primary" disabled={busy}>Save changes</button>
      </form>

      <button className="btn btn-ghost full" onClick={logout}>Log out</button>
    </div>
  );
}
