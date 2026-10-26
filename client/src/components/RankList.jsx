import Avatar from './Avatar.jsx';
import { fmt } from '../lib.js';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function Podium({ items }) {
  if (items.length < 3) return null;
  const order = [items[1], items[0], items[2]];
  return (
    <div className="podium">
      {order.map((p) => (
        <div key={p.userId} className={`podium-spot place-${p.rank}`}>
          <Avatar name={p.name} color={p.avatarColor} size={p.rank === 1 ? 64 : 52} />
          <strong className="ellipsis">{p.name}</strong>
          <small className="muted">{fmt(p.total)} steps</small>
          <div className="podium-block">{MEDALS[p.rank]}</div>
        </div>
      ))}
    </div>
  );
}

export default function RankList({ items, showTeam = false }) {
  if (!items.length) {
    return (
      <div className="empty">
        <div className="empty-icon" aria-hidden="true">👟</div>
        <p className="muted">No walkers here yet.</p>
      </div>
    );
  }
  return (
    <ol className="rank-list">
      {items.map((r) => (
        <li key={r.userId} className={`rank-row${r.isMe ? ' me' : ''}`}>
          <span className="rank-num">{MEDALS[r.rank] || r.rank}</span>
          <Avatar name={r.name} color={r.avatarColor} size={36} />
          <div className="rank-name">
            <strong className="ellipsis">
              {r.name} {r.isMe && <span className="pill pill-ok tiny-pill">You</span>}
            </strong>
            <small className="muted">
              {r.goalDays} goal day{r.goalDays === 1 ? '' : 's'}
              {showTeam && r.team ? ` · 🛡️ ${r.team.name}` : ''}
            </small>
          </div>
          <span className="rank-value">{fmt(r.total)}</span>
        </li>
      ))}
    </ol>
  );
}
