import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Logo } from '../components/Layout.jsx';
import Plant from '../components/Plant.jsx';

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (isSignup && form.password.length < 8) return setError('Password must be at least 8 characters');
    setBusy(true);
    try {
      if (isSignup) await signup(form.name, form.email, form.password);
      else await login(form.email, form.password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-art">
        <Logo />
        <Plant stage={isSignup ? 2 : 4} size={220} />
        <h2>{isSignup ? 'Plant your first seed.' : 'Your garden missed you.'}</h2>
        <p className="muted">
          {isSignup
            ? 'Every step you take helps it grow. 10,000 steps and it blooms.'
            : 'Log in to sync today’s steps and keep that streak alive.'}
        </p>
      </div>

      <form className="card auth-card" onSubmit={onSubmit} noValidate>
        <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{isSignup ? 'Free forever. Takes 20 seconds.' : 'Good to see you again.'}</p>

        {isSignup && (
          <label className="field">
            <span>Your name</span>
            <input value={form.name} onChange={set('name')} autoComplete="name" required minLength={2} maxLength={80} placeholder="e.g. Varun" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required placeholder="you@example.com" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={isSignup ? 8 : 1}
            maxLength={72}
            placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
          />
        </label>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <button className="btn btn-primary btn-lg full" disabled={busy}>
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
        </button>

        <p className="muted center">
          {isSignup ? 'Already have an account? ' : 'New to V-Run? '}
          <Link to={isSignup ? '/login' : '/signup'} state={location.state}>
            {isSignup ? 'Log in' : 'Create a free account'}
          </Link>
        </p>
        {isSignup && (
          <p className="tiny muted center">After signing up, connect Google Fit from your profile to sync real steps.</p>
        )}
      </form>
    </div>
  );
}
