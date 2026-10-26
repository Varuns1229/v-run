import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import Loader, { ErrorState } from '../components/Loader.jsx';
import { dateLabel } from '../lib.js';

const STATUS_LABEL = { active: '🟢 Live', upcoming: '⏳ Upcoming', completed: '🏁 Finished' };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Contests() {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', startDate: todayStr() });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems((await api.get('/contests')).items);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function join(id) {
    try {
      await api.post(`/contests/${id}/join`);
      toast('You’re in! Now build or join a team.', 'success');
      navigate(`/contests/${id}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { contest } = await api.post('/contests', form);
      toast('Contest created. Invite your friends!', 'success');
      navigate(`/contests/${contest.id}`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <Loader />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>60-day contests</h1>
          <p className="muted">Sixty days. Ten thousand steps a day. Bring your team.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : '+ New contest'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={create}>
          <h3>Start a new 60-day contest</h3>
          <div className="form-grid">
            <label className="field">
              <span>Contest name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={3} maxLength={100} placeholder="Office Step-Off 2026" />
            </label>
            <label className="field">
              <span>Start date</span>
              <input type="date" value={form.startDate} min={todayStr()} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </label>
          </div>
          <label className="field">
            <span>Description (optional)</span>
            <textarea rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What’s at stake? Bragging rights, obviously." />
          </label>
          <p className="muted small">Runs for 60 days from the start date. Teams of up to 10.</p>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create contest'}</button>
        </form>
      )}

      {!items.length ? (
        <div className="card empty">
          <div className="empty-icon" aria-hidden="true">🏁</div>
          <p>No contests yet. Start the first one!</p>
        </div>
      ) : (
        <div className="contest-list">
          {items.map((c) => (
            <article key={c.id} className={`card contest-card status-${c.status}`}>
              <div className="row between">
                <span className="pill">{STATUS_LABEL[c.status]}</span>
                {c.joined && <span className="pill pill-ok">Joined</span>}
              </div>
              <h3>{c.name}</h3>
              {c.description && <p className="muted small">{c.description}</p>}
              <div className="contest-meta">
                <span>📅 {dateLabel(c.startDate)} → {dateLabel(c.endDate)}</span>
                <span>👥 {c.participants} walkers</span>
                <span>🛡️ {c.teamCount} teams</span>
              </div>
              {c.status === 'active' && (
                <>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(c.dayNumber / c.totalDays) * 100}%` }} />
                  </div>
                  <small className="muted">Day {c.dayNumber} of {c.totalDays} · {c.daysLeft} days left</small>
                </>
              )}
              {c.status === 'upcoming' && <small className="muted">Starts in {c.startsIn} day{c.startsIn === 1 ? '' : 's'}</small>}
              {c.myTeam && <small>🛡️ Your team: <strong>{c.myTeam.name}</strong></small>}
              <div className="row gap-sm">
                <Link to={`/contests/${c.id}`} className="btn btn-ghost btn-sm">View standings</Link>
                {!c.joined && c.status !== 'completed' && (
                  <button className="btn btn-primary btn-sm" onClick={() => join(c.id)}>Join free</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
