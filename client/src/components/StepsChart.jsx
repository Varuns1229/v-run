import { useEffect, useRef, useState } from 'react';
import { dateLabel, dayLabel, fmt, shortNum } from '../lib.js';

/**
 * Single-series daily bar chart with a dashed goal reference line.
 * Goal days use the full accent; other days use a dimmer step of the same hue.
 */
export default function StepsChart({ items, goal, height = 260, compact = false }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const [W, setW] = useState(720);

  // Size the SVG to its container so text stays at real pixel sizes on every screen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = height;
  const pad = { top: 18, right: 60, bottom: compact ? 24 : 30, left: compact ? 8 : 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const max = Math.max(goal * 1.2, ...items.map((d) => d.steps));
  const niceMax = Math.ceil(max / 5000) * 5000;
  const y = (v) => pad.top + innerH - (v / niceMax) * innerH;
  const slot = innerW / items.length;
  const gap = items.length > 45 ? 1 : 2;
  const barW = Math.max(2, slot - gap * 2);
  const ticks = [0, niceMax / 2, niceMax];
  const maxLabels = Math.max(3, Math.floor(innerW / 56));
  const labelEvery = items.length <= 7 && maxLabels >= 7 ? 1 : Math.max(1, Math.ceil(items.length / maxLabels));

  const hovered = hover != null ? items[hover] : null;

  return (
    <div className="chart" ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Daily steps for the last ${items.length} days`}>
        {!compact &&
          ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="grid-line" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="axis-text">
                {shortNum(t)}
              </text>
            </g>
          ))}

        {items.map((d, i) => {
          const x = pad.left + i * slot + gap;
          const h = Math.max(d.steps > 0 ? 3 : 0, pad.top + innerH - y(d.steps));
          const top = pad.top + innerH - h;
          const r = Math.min(4, barW / 2, h);
          const met = d.steps >= goal;
          // Rounded top, square base anchored to the baseline.
          const path =
            h > 0
              ? `M${x} ${top + h} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + barW - r} Q${x + barW} ${top} ${x + barW} ${top + r} V${top + h} Z`
              : '';
          return (
            <g key={d.date}>
              {path && (
                <path d={path} className={`bar${met ? ' bar-met' : ''}${hover === i ? ' bar-hover' : ''}`} />
              )}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
              {(i % labelEvery === 0 || i === items.length - 1) &&
                !(i !== items.length - 1 && items.length - 1 - i < labelEvery) && (
                  <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="axis-text">
                    {items.length <= 7 ? dayLabel(d.date) : dateLabel(d.date)}
                  </text>
                )}
            </g>
          );
        })}

        <line x1={pad.left} x2={W - pad.right} y1={y(goal)} y2={y(goal)} className="goal-line" />
        <text x={W - pad.right + 8} y={y(goal) + 4} textAnchor="start" className="goal-text">
          Goal {shortNum(goal)}
        </text>
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} className="base-line" />
      </svg>

      {hovered && (
        <div
          className="chart-tip"
          style={{
            left: `${((pad.left + hover * slot + slot / 2) / W) * 100}%`,
            top: `${(y(hovered.steps) / H) * 100}%`,
          }}
        >
          <small>{dateLabel(hovered.date)} · {dayLabel(hovered.date)}</small>
          <strong>{fmt(hovered.steps)} steps</strong>
          <small>{hovered.steps >= goal ? '✅ Goal met' : `${fmt(goal - hovered.steps)} short of goal`}</small>
        </div>
      )}
    </div>
  );
}
