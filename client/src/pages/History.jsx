import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import StepsChart from '../components/StepsChart.jsx';
import Heatmap from '../components/Heatmap.jsx';
import Loader, { ErrorState } from '../components/Loader.jsx';
import { dateLabel, dayLabel, fmt } from '../lib.js';

const RANGES = [7, 30, 60, 90];

export default function History() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('chart');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.get(`/steps/history?days=${days}`));
    } catch (err) {
      setError(err.message);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Step history</h1>
          <p className="muted">Every step counts. Here’s the proof.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} role="tab" aria-selected={days === r} className={days === r ? 'on' : ''} onClick={() => setDays(r)}>
              {r}D
            </button>
          ))}
        </div>
      </div>

      {!data || data.days !== days ? (
        <Loader />
      ) : (
        <>
          <div className="grid-4">
            <div className="card stat">
              <span className="stat-icon" aria-hidden="true">👣</span>
              <div><strong>{fmt(data.stats.total)}</strong><small>total steps</small></div>
            </div>
            <div className="card stat">
              <span className="stat-icon" aria-hidden="true">📈</span>
              <div><strong>{fmt(data.stats.average)}</strong><small>daily average</small></div>
            </div>
            <div className="card stat">
              <span className="stat-icon" aria-hidden="true">✅</span>
              <div><strong>{data.stats.goalDays}/{data.days}</strong><small>goal days</small></div>
            </div>
            <div className="card stat">
              <span className="stat-icon" aria-hidden="true">⭐</span>
              <div><strong>{fmt(data.stats.best)}</strong><small>best day</small></div>
            </div>
          </div>

          <section className="card">
            <div className="card-head">
              <h3>Daily steps</h3>
              <div className="segmented small" role="tablist" aria-label="View">
                <button role="tab" aria-selected={view === 'chart'} className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}>Chart</button>
                <button role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button>
              </div>
            </div>
            {view === 'chart' ? (
              <StepsChart items={data.items} goal={data.goal} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Day</th><th className="num">Steps</th><th>Goal</th></tr>
                  </thead>
                  <tbody>
                    {[...data.items].reverse().map((d) => (
                      <tr key={d.date}>
                        <td>{dateLabel(d.date)}</td>
                        <td>{dayLabel(d.date)}</td>
                        <td className="num">{fmt(d.steps)}</td>
                        <td>{d.steps >= data.goal ? '✅ Met' : <span className="muted">{fmt(data.goal - d.steps)} short</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Calendar</h3>
              <span className="muted small">Darker green = more steps · ringed = goal met</span>
            </div>
            <Heatmap items={data.items} goal={data.goal} />
          </section>
        </>
      )}
    </div>
  );
}
