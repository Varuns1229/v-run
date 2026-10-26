// A plant that grows through 6 stages as today's steps approach the goal.
const LEAVES = [
  // [y, side, size] relative to the stem; revealed progressively by stage
  [0.78, -1, 1],
  [0.66, 1, 1],
  [0.52, -1, 1.15],
  [0.4, 1, 1.15],
  [0.28, -1, 1.25],
  [0.18, 1, 1.25],
];
const LEAVES_BY_STAGE = [0, 2, 3, 4, 6, 6];
const STEM_BY_STAGE = [0, 0.28, 0.45, 0.62, 0.8, 0.92];

function Leaf({ x, y, side, size, delay }) {
  const w = 26 * size;
  const h = 13 * size;
  const d = side < 0 ? `M0 0 C ${-w * 0.4} ${-h} ${-w} ${-h * 0.6} ${-w} 0 C ${-w * 0.6} ${h * 0.6} ${-w * 0.3} ${h * 0.5} 0 0Z` : `M0 0 C ${w * 0.4} ${-h} ${w} ${-h * 0.6} ${w} 0 C ${w * 0.6} ${h * 0.6} ${w * 0.3} ${h * 0.5} 0 0Z`;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="leaf" d={d} fill="url(#leafGrad)" style={{ animationDelay: `${delay}s` }} />
    </g>
  );
}

export default function Plant({ stage = 0, size = 220 }) {
  const W = 200;
  const H = 240;
  const groundY = 178;
  const stemTop = groundY - 150 * STEM_BY_STAGE[stage];
  const stemLen = groundY - stemTop;
  const leaves = LEAVES.slice(0, LEAVES_BY_STAGE[stage]);

  return (
    <svg
      className={`plant stage-${stage}`}
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={(size * H) / W}
      role="img"
      aria-label={`Plant at growth stage ${stage} of 5`}
    >
      <defs>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="1" stopColor="#c2410c" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde047" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
      </defs>

      {stage === 5 && <circle className="plant-glow" cx={W / 2} cy={stemTop + 4} r="62" fill="url(#glow)" />}

      <g className="plant-sway" style={{ transformOrigin: `${W / 2}px ${groundY}px` }}>
        {stage === 0 ? (
          <ellipse cx={W / 2} cy={groundY - 4} rx="9" ry="6" fill="#a16207" />
        ) : (
          <>
            <path
              d={`M${W / 2} ${groundY} C ${W / 2 - 6} ${groundY - stemLen * 0.4} ${W / 2 + 6} ${groundY - stemLen * 0.7} ${W / 2} ${stemTop}`}
              stroke="#16a34a"
              strokeWidth={stage >= 4 ? 7 : 5}
              strokeLinecap="round"
              fill="none"
            />
            {leaves.map(([fy, side, s], i) => (
              <Leaf key={i} x={W / 2} y={groundY - stemLen * (1 - fy) - 2} side={side} size={s} delay={i * 0.12} />
            ))}
            {stage >= 1 && stage < 5 && (
              <ellipse cx={W / 2} cy={stemTop - 4} rx={4 + stage} ry={6 + stage} fill="#4ade80" />
            )}
            {stage === 5 && (
              <g className="flower" transform={`translate(${W / 2} ${stemTop - 6})`}>
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <ellipse key={a} cx="0" cy="-13" rx="8" ry="13" fill="#f472b6" transform={`rotate(${a})`} />
                ))}
                <circle r="8" fill="#fde047" />
              </g>
            )}
          </>
        )}
      </g>

      <path d={`M48 ${groundY - 6} H152 L140 232 H60 Z`} fill="url(#potGrad)" />
      <rect x="42" y={groundY - 14} width="116" height="14" rx="5" fill="#ea580c" />
      <ellipse cx={W / 2} cy={groundY - 13} rx="54" ry="5" fill="#713f12" />
    </svg>
  );
}

/** Small icon for the 30-day garden grid. */
export function MiniTree({ met, partial }) {
  if (met) {
    return (
      <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
        <rect x="14.5" y="18" width="3" height="10" rx="1.5" fill="#a16207" />
        <circle cx="16" cy="13" r="9" fill="#22c55e" />
        <circle cx="12" cy="11" r="3" fill="#4ade80" />
      </svg>
    );
  }
  if (partial) {
    return (
      <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
        <path d="M16 28 V17" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 20 C 11 19 9 15 10 13 C 14 13 16 16 16 20Z" fill="#4ade80" />
        <path d="M16 18 C 21 17 23 13 22 11 C 18 11 16 14 16 18Z" fill="#22c55e" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="16" cy="25" rx="8" ry="3" fill="#3f2d1a" />
      <circle cx="16" cy="23" r="1.8" fill="#78350f" />
    </svg>
  );
}
