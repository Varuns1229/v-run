import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="auth center-page">
      <div className="card empty">
        <div className="empty-icon" aria-hidden="true">🧭</div>
        <h1>Off the trail</h1>
        <p className="muted">This page wandered off. Let’s get you back on track.</p>
        <Link to="/" className="btn btn-primary">Go home</Link>
      </div>
    </div>
  );
}
