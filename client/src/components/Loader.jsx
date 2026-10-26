export default function Loader({ full = false, label = 'Loading…' }) {
  return (
    <div className={full ? 'loader loader-full' : 'loader'} role="status">
      <span className="loader-dot" />
      <span className="loader-dot" />
      <span className="loader-dot" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card empty">
      <div className="empty-icon" aria-hidden="true">😵</div>
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
