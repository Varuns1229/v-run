import { Link } from 'react-router-dom';
import { Logo } from '../components/Layout.jsx';
import Plant from '../components/Plant.jsx';

const FEATURES = [
  { icon: '🔥', title: 'Daily streaks', text: 'Hit 10,000 steps, keep the chain alive, and unlock milestone badges from 3 to 60 days.' },
  { icon: '🌱', title: 'Grow your garden', text: 'Your plant grows with every step and blooms at 10K. Each goal day plants a tree in your garden.' },
  { icon: '🏁', title: '60-day contests', text: 'Join a season-long challenge, build a team with friends and climb the rankings together.' },
  { icon: '🏆', title: 'Leaderboards', text: 'Individual and team rankings, updated as your steps sync from Google Fit.' },
  { icon: '🎁', title: 'Rewards & V-Coins', text: 'Earn coins for every 1,000 steps and big bonuses for streak milestones.' },
  { icon: '📊', title: 'Step history', text: 'Charts and a calendar heatmap show your progress over 7, 30, 60 and 90 days.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <div className="row gap-sm">
          <Link to="/login" className="btn btn-ghost">Log in</Link>
          <Link to="/signup" className="btn btn-primary">Start free</Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <span className="pill">100% free · No ads · Google Fit sync</span>
          <h1>
            Walk <span className="grad">10,000 steps</span>.<br />
            Keep the streak.<br />
            Watch your garden grow.
          </h1>
          <p className="lead">
            V-Run turns your daily walk into a game. Sync steps from Google Fit, build streaks, team up for 60-day
            contests and earn rewards for every step.
          </p>
          <div className="row gap-sm wrap">
            <Link to="/signup" className="btn btn-primary btn-lg">Create free account</Link>
            <Link to="/login" className="btn btn-ghost btn-lg">I already walk with V-Run</Link>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-plant">
            <Plant stage={5} size={260} />
          </div>
          <div className="float-card fc-1"><strong>🔥 21</strong><small>day streak</small></div>
          <div className="float-card fc-2"><strong>10,482</strong><small>steps today</small></div>
          <div className="float-card fc-3"><strong>#3</strong><small>team rank</small></div>
        </div>
      </section>

      <section className="features">
        {FEATURES.map((f) => (
          <div key={f.title} className="card feature">
            <span className="feature-icon" aria-hidden="true">{f.icon}</span>
            <h3>{f.title}</h3>
            <p className="muted">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="card cta">
        <h2>Your first step is the hardest. We’ll handle the rest.</h2>
        <Link to="/signup" className="btn btn-primary btn-lg">Join V-Run free</Link>
      </section>

      <footer className="landing-foot muted">© {new Date().getFullYear()} V-Run · Walk. Streak. Grow.</footer>
    </div>
  );
}
