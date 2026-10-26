import { fmt } from '../lib.js';

export default function ProgressRing({ steps, goal, size = 240 }) {
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, steps / goal);
  const over = steps >= goal;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${fmt(steps)} of ${fmt(goal)} steps`}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-emoji" aria-hidden="true">{over ? '🏆' : '👟'}</span>
        <strong className="ring-steps">{fmt(steps)}</strong>
        <span className="ring-goal">of {fmt(goal)} steps</span>
        <span className={`ring-pct${over ? ' done' : ''}`}>{Math.round((steps / goal) * 100)}%</span>
      </div>
    </div>
  );
}
