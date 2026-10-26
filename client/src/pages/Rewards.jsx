import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Loader, { ErrorState } from '../components/Loader.jsx';
import { fmt } from '../lib.js';

export default function Rewards() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.get('/steps/rewards'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loader />;

  const { summary, milestones, next, badges } = data;
  const unlockedCount = milestones.filter((m) => m.unlocked).length + badges.filter((b) => b.unlocked).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Rewards</h1>
          <p className="muted">Streaks unlock milestones. Milestones pay out V-Coins. All free, always.</p>
        </div>
      </div>

      <div className="grid-3">
        <div className="card stat big-stat">
          <span className="stat-icon flame" aria-hidden="true">🔥</span>
          <div><strong>{summary.streak.current} day{summary.streak.current === 1 ? '' : 's'}</strong><small>current streak</small></div>
        </div>
        <div className="card stat big-stat">
          <span className="stat-icon" aria-hidden="true">🪙</span>
          <div><strong>{fmt(summary.coins)}</strong><small>V-Coins</small></div>
        </div>
        <div className="card stat big-stat">
          <span className="stat-icon" aria-hidden="true">🎖️</span>
          <div><strong>{unlockedCount}/{milestones.length + badges.length}</strong><small>rewards unlocked</small></div>
        </div>
      </div>

      {next && (
        <section className="card next-reward">
          <span className="next-emoji" aria-hidden="true">{next.emoji}</span>
          <div className="grow">
            <small className="muted">NEXT MILESTONE</small>
            <h3>{next.title} · {next.days}-day streak</h3>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${next.progress * 100}%` }} />
            </div>
            <p className="muted small">
              {summary.streak.current}/{next.days} days · {Math.max(0, next.days - summary.streak.current)} more 10K days for +{next.coins} V-Coins
            </p>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3>Streak reward chart</h3>
          <span className="muted small">Best streak: {summary.streak.longest} days</span>
        </div>
        <ol className="ladder">
          {milestones.map((m) => (
            <li key={m.key} className={`rung${m.unlocked ? ' unlocked' : ''}`}>
              <span className="rung-day">{m.days}d</span>
              <span className="rung-medal" aria-hidden="true">{m.unlocked ? m.emoji : '🔒'}</span>
              <div className="rung-body">
                <strong>{m.title}</strong>
                <small className="muted">{m.desc}</small>
                <div className="bar-track thin">
                  <div className="bar-fill" style={{ width: `${m.progress * 100}%` }} />
                </div>
              </div>
              <span className="rung-coins">{m.unlocked ? '✅' : ''} +{m.coins} 🪙</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Step badges</h3>
        </div>
        <div className="badges">
          {badges.map((b) => (
            <div key={b.key} className={`badge${b.unlocked ? ' unlocked' : ''}`}>
              <span className="badge-emoji" aria-hidden="true">{b.unlocked ? b.emoji : '🔒'}</span>
              <strong>{b.title}</strong>
              <small className="muted">{b.desc}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>How V-Coins work</h3>
        <ul className="how">
          <li>🪙 <strong>1 coin</strong> for every 1,000 steps (up to 25 a day)</li>
          <li>✅ <strong>+10 coins</strong> each day you hit your goal</li>
          <li>🔥 <strong>Milestone bonuses</strong> from +30 (3 days) to +1,000 (60 days)</li>
        </ul>
      </section>
    </div>
  );
}
