import { initials } from '../lib.js';

export default function Avatar({ name, color = '#22c55e', size = 40 }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
