import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';

const NAV = [
  { to: '/dashboard', label: 'Today', icon: '🏠' },
  { to: '/history', label: 'History', icon: '📊' },
  { to: '/contests', label: 'Contests', icon: '🏁' },
  { to: '/leaderboard', label: 'Ranks', icon: '🏆' },
  { to: '/rewards', label: 'Rewards', icon: '🎁' },
];

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="V-Run home">
      <svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#131b31" />
        <path d="M14 16h10l8 22 8-22h10L37 50h-10z" fill="url(#lg)" />
      </svg>
      <span>
        V<span className="logo-dash">-</span>Run
      </span>
    </Link>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav className="side-nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
              <span className="side-icon" aria-hidden="true">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <NavLink to="/profile" className={({ isActive }) => `side-user${isActive ? ' active' : ''}`}>
            <Avatar name={user.name} color={user.avatarColor} size={36} />
            <div className="side-user-text">
              <strong>{user.name}</strong>
              <small>{user.googleConnected ? 'Google Fit linked' : 'Demo data'}</small>
            </div>
          </NavLink>
          <button className="btn btn-ghost btn-sm full" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Logo />
        <Link to="/profile" aria-label="Profile">
          <Avatar name={user.name} color={user.avatarColor} size={34} />
        </Link>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}>
            <span aria-hidden="true">{n.icon}</span>
            <small>{n.label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
