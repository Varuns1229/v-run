import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Loader, { ErrorState } from '../components/Loader.jsx';
import RankList, { Podium } from '../components/RankList.jsx';
import { fmt } from '../lib.js';

const PERIODS = [
  { key: '7', label: 'This week' },
  { key: '30', label: '30 days' },
  { key: 'all', label: 'All time' },
];

export default function Leaderboard() {
  const [period, setPeriod] = useState('7');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.get(`/leaderboard?period=${period}`));
    } catch (err) {
      setError(err.message);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Global ranking</h1>
          <p className="muted">Every V-Run walker, ranked by steps.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.key} role="tab" aria-selected={period === p.key} className={period === p.key ? 'on' : ''} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!data || data.period !== period ? (
        <Loader />
      ) : (
        <>
          {data.me && (
            <div className="card my-rank-banner">
              <span>Your rank</span>
              <strong>#{data.me.rank}</strong>
              <span className="muted">of {data.totalUsers} · {fmt(data.me.total)} steps</span>
              {data.me.rank > 1 && data.items[data.me.rank - 2] && (
                <span className="pill">
                  {fmt(data.items[data.me.rank - 2].total - data.me.total + 1)} steps to pass {data.items[data.me.rank - 2].name.split(' ')[0]}
                </span>
              )}
            </div>
          )}
          <section className="card">
            <Podium items={data.items} />
            <RankList items={data.items} />
          </section>
        </>
      )}
    </div>
  );
}
