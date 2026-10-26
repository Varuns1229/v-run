import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import Plant, { MiniTree } from '../components/Plant.jsx';
import StepsChart from '../components/StepsChart.jsx';
import Loader, { ErrorState } from '../components/Loader.jsx';
import {
  PLANT_STAGES,
  dateLabel,
  fmt,
  greeting,
  plantStage,
  progressMessage,
  quoteOfTheDay,
  timeAgo,
} from '../lib.js';

const AUTO_SYNC_MS = 10 * 60 * 1000;

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 7) * 0.12}s`,
            background: ['#22c55e', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5],
          }}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [contest, setContest] = useState(null);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const didAutoSync = useRef(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [summary, contests] = await Promise.all([api.get('/steps/summary'), api.get('/contests')]);
      setData(summary);
      const active = contests.items.find((c) => c.status === 'active' && c.joined) || contests.items.find((c) => c.status === 'active');
      setContest(active || null);

      const key = `vrun_celebrated_${new Date().toDateString()}`;
      if (summary.today >= summary.goal && !localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 3500);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const sync = useCallback(
    async (silent = false) => {
      setSyncing(true);
      try {
        const r = await api.post('/steps/sync');
        if (!silent) toast(r.fallback ? `${r.message}. ${r.reason || ''}` : r.message, r.fallback ? 'info' : 'success');
        await Promise.all([load(), refreshUser()]);
      } catch (err) {
        if (!silent) toast(err.message, 'error');
        await load();
      } finally {
        setSyncing(false);
      }
    },
    [load, refreshUser, toast]
  );

  useEffect(() => {
    if (didAutoSync.current) return;
    didAutoSync.current = true;
    const last = user.lastSyncedAt ? new Date(String(user.lastSyncedAt).replace(' ', 'T')).getTime() : 0;
    if (!last || Date.now() - last > AUTO_SYNC_MS) sync(true);
    else load();
  }, [user.lastSyncedAt, sync, load]);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loader label="Syncing your steps…" />;

  const stage = plantStage(data.today, data.goal);
  const msg = progressMessage(data.today, data.goal);
  const left = Math.max(0, data.goal - data.today);
  const gardenTrees = data.garden.filter((d) => d.met).length;
  const isDemo = data.dataSource !== 'google_fit';

  return (
    <div className="page">
      {celebrate && <Confetti />}

      <div className="page-head">
        <div>
          <h1>
            {greeting()}, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="muted quote">“{quoteOfTheDay()}”</p>
        </div>
        <div className="row gap-sm">
          <span className={`pill ${isDemo ? 'pill-warn' : 'pill-ok'}`}>
            {isDemo ? '🧪 Demo data' : '🟢 Google Fit'} · synced {timeAgo(data.lastSyncedAt)}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => sync(false)} disabled={syncing}>
            {syncing ? 'Syncing…' : '↻ Sync'}
          </button>
        </div>
      </div>

      {isDemo && (
        <div className="alert alert-info">
          You’re seeing demo steps from our sample month. <Link to="/profile">Connect Google Fit</Link> to track your real walks.
        </div>
      )}

      <div className="grid-hero">
        <section className="card today-card">
          <ProgressRing steps={data.today} goal={data.goal} />
          <div className="today-text">
            <h2>{msg.title}</h2>
            <p className="muted">{msg.text}</p>
            <div className="today-chips">
              <span className="chip">📏 {data.todayDistanceKm} km</span>
              <span className="chip">🔥 {fmt(data.todayCalories)} kcal</span>
              <span className="chip">{left ? `⏱️ ~${Math.ceil(left / 100)} min to go` : '✅ Goal done'}</span>
            </div>
          </div>
        </section>

        <section className="card plant-card">
          <div className="card-head">
            <h3>Today’s plant</h3>
            <span className="pill">{PLANT_STAGES[stage]}</span>
          </div>
          <Plant stage={stage} size={190} />
          <div className="stage-track" aria-label={`Growth stage ${stage} of 5`}>
            {PLANT_STAGES.map((s, i) => (
              <span key={s} className={i <= stage ? 'on' : ''} title={s} />
            ))}
          </div>
          <p className="muted center small">
            {stage === 5 ? 'In full bloom! A new tree joins your garden.' : `Grows every 2,500 steps. Blooms at ${fmt(data.goal)}.`}
          </p>
        </section>
      </div>

      <div className="grid-4">
        <div className="card stat streak-stat">
          <span className="stat-icon flame" aria-hidden="true">🔥</span>
          <div>
            <strong>{data.streak.current}</strong>
            <small>day streak</small>
          </div>
        </div>
        <div className="card stat">
          <span className="stat-icon" aria-hidden="true">🏅</span>
          <div>
            <strong>{data.streak.longest}</strong>
            <small>longest streak</small>
          </div>
        </div>
        <div className="card stat">
          <span className="stat-icon" aria-hidden="true">🪙</span>
          <div>
            <strong>{fmt(data.coins)}</strong>
            <small>V-Coins earned</small>
          </div>
        </div>
        <div className="card stat">
          <span className="stat-icon" aria-hidden="true">🌳</span>
          <div>
            <strong>{data.streak.goalDays}</strong>
            <small>10K days total</small>
          </div>
        </div>
      </div>

      {!data.streak.todayMet && data.streak.current > 0 && (
        <div className="alert alert-warn">
          🔥 Your {data.streak.current}-day streak is on the line. {fmt(left)} more steps today keeps it alive!
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h3>This week</h3>
            <Link to="/history" className="link">Full history →</Link>
          </div>
          <StepsChart items={data.week} goal={data.goal} height={220} />
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Your garden</h3>
            <span className="muted small">{gardenTrees} trees in 30 days</span>
          </div>
          <div className="garden" role="list">
            {data.garden.map((d) => (
              <div
                key={d.date}
                role="listitem"
                className={`garden-plot${d.met ? ' grown' : ''}`}
                title={`${dateLabel(d.date)}: ${fmt(d.steps)} steps`}
              >
                <MiniTree met={d.met} partial={!d.met && d.steps >= data.goal * 0.5} />
              </div>
            ))}
          </div>
          <p className="muted small">🌳 10K day · 🌱 halfway there · 🟫 resting soil</p>
        </section>
      </div>

      {contest && (
        <Link to={`/contests/${contest.id}`} className="card contest-banner">
          <div>
            <span className="pill pill-ok">Day {contest.dayNumber} of {contest.totalDays}</span>
            <h3>{contest.name}</h3>
            <p className="muted">
              {contest.joined
                ? contest.myTeam
                  ? `You’re walking with team ${contest.myTeam.name}. Check the standings.`
                  : 'You’re in! Create or join a team to compete together.'
                : `${contest.participants} walkers are competing. Join them, it’s free.`}
            </p>
          </div>
          <div className="contest-progress">
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(contest.dayNumber / contest.totalDays) * 100}%` }} />
            </div>
            <span className="btn btn-primary btn-sm">{contest.joined ? 'View contest' : 'Join now'} →</span>
          </div>
        </Link>
      )}
    </div>
  );
}
