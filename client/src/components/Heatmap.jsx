import { useState } from 'react';
import { dateLabel, fmt, parseDate } from '../lib.js';

// Sequential single-hue ramp (light → dark green reads as more steps on the dark surface).
const LEVELS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];

function level(steps, goal) {
  if (steps <= 0) return 0;
  const p = steps / goal;
  if (p < 0.5) return 1;
  if (p < 1) return 2;
  if (p < 1.4) return 3;
  return 4;
}

/** GitHub-style calendar: one column per week, Monday at the top. */
export default function Heatmap({ items, goal }) {
  const [hover, setHover] = useState(null);
  if (!items.length) return null;

  const firstDow = (parseDate(items[0].date).getDay() + 6) % 7; // Mon = 0
  const cells = [...Array(firstDow).fill(null), ...items];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="grid" aria-label="Daily steps calendar">
        <div className="heat-days" aria-hidden="true">
          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        {weeks.map((w, wi) => (
          <div key={wi} className="heat-col" role="row">
            {w.map((d, di) =>
              d ? (
                <span
                  key={d.date}
                  role="gridcell"
                  tabIndex={0}
                  className={`heat-cell${d.steps >= goal ? ' heat-met' : ''}`}
                  style={{ background: LEVELS[level(d.steps, goal)] }}
                  aria-label={`${dateLabel(d.date)}: ${fmt(d.steps)} steps`}
                  onMouseEnter={() => setHover(d)}
                  onFocus={() => setHover(d)}
                  onMouseLeave={() => setHover(null)}
                />
              ) : (
                <span key={`e${di}`} className="heat-cell heat-empty" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="heat-foot">
        <span className="muted">
          {hover ? (
            <>
              <strong className="ink">{dateLabel(hover.date)}</strong>: {fmt(hover.steps)} steps
              {hover.steps >= goal ? ' ✅' : ''}
            </>
          ) : (
            'Hover a day for details'
          )}
        </span>
        <span className="heat-legend">
          Less
          {LEVELS.map((c, i) => (
            <span key={i} className="heat-cell" style={{ background: c }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
