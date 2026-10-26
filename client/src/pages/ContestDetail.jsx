import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import Loader, { ErrorState } from '../components/Loader.jsx';
import RankList, { Podium } from '../components/RankList.jsx';
import Avatar from '../components/Avatar.jsx';
import { dateLabel, fmt } from '../lib.js';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function TeamPanel({ contestId, myTeam, contest, onChange }) {
  const toast = useToast();
  const [team, setTeam] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const closed = contest.status === 'completed';

  useEffect(() => {
    if (!myTeam) return setTeam(null);
    api
      .get(`/contests/${contestId}/teams/${myTeam.id}`)
      .then(setTeam)
      .catch((err) => toast(err.message, 'error'));
  }, [contestId, myTeam, toast]);

  async function run(fn, success) {
    setBusy(true);
    try {
      await fn();
      if (success) toast(success, 'success');
      await onChange();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(myTeam.inviteCode);
      toast('Invite code copied. Share it with your crew!', 'success');
    } catch {
      toast(`Your invite code is ${myTeam.inviteCode}`, 'info');
    }
  }

  if (myTeam) {
    return (
      <section className="card">
        <div className="card-head">
          <h3>🛡️ {myTeam.name}</h3>
          {myTeam.isCaptain && <span className="pill">👑 Captain</span>}
        </div>
        <div className="invite">
          <div>
            <small className="muted">INVITE CODE</small>
            <strong className="code">{myTeam.inviteCode}</strong>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={copyCode}>Copy</button>
        </div>
        {!team ? (
          <Loader />
        ) : (
          <ol className="rank-list">
            {team.members.map((m, i) => (
              <li key={m.userId} className="rank-row">
                <span className="rank-num">{i + 1}</span>
                <Avatar name={m.name} color={m.avatarColor} size={34} />
                <div className="rank-name">
                  <strong className="ellipsis">{m.name} {m.isCaptain && '👑'}</strong>
                  <small className="muted">{m.goalDays} goal days</small>
                </div>
                <span className="rank-value">{fmt(m.total)}</span>
              </li>
            ))}
          </ol>
        )}
        {!closed && (
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Leave ${myTeam.name}?`)) run(() => api.post(`/contests/${contestId}/teams/leave`), 'You left the team');
            }}
          >
            Leave team
          </button>
        )}
      </section>
    );
  }

  if (closed) return null;

  return (
    <section className="card">
      <h3>Walk together 🤝</h3>
      <p className="muted small">Teams are ranked by average steps per member, so every walker matters.</p>
      <div className="team-forms">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.post(`/contests/${contestId}/teams`, { name: teamName }), 'Team created! Share your invite code.');
          }}
        >
          <label className="field">
            <span>Create a team</span>
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="The Sole Mates" minLength={3} maxLength={60} required />
          </label>
          <button className="btn btn-primary btn-sm" disabled={busy}>Create team</button>
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.post(`/contests/${contestId}/teams/join`, { code }), 'Welcome to the team!');
          }}
        >
          <label className="field">
            <span>Have an invite code?</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={12} required className="mono" />
          </label>
          <button className="btn btn-ghost btn-sm" disabled={busy}>Join with code</button>
        </form>
      </div>
    </section>
  );
}

export default function ContestDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [individual, setIndividual] = useState(null);
  const [teams, setTeams] = useState(null);
  const [tab, setTab] = useState('teams');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [i, ind, t] = await Promise.all([
        api.get(`/contests/${id}`),
        api.get(`/contests/${id}/leaderboard/individual`),
        api.get(`/contests/${id}/leaderboard/teams`),
      ]);
      setInfo(i);
      setIndividual(ind);
      setTeams(t);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(path, msg) {
    try {
      await api.post(path);
      toast(msg, 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function joinTeam(teamId, name) {
    try {
      await api.post(`/contests/${id}/teams/join`, { teamId });
      toast(`Welcome to ${name}!`, 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!info || !individual || !teams) return <Loader />;

  const { contest, joined, myTeam } = info;
  const open = contest.status !== 'completed';

  return (
    <div className="page">
      <Link to="/contests" className="link small">← All contests</Link>

      <section className="card contest-hero">
        <div className="grow">
          <span className="pill">
            {contest.status === 'active' ? `🟢 Day ${contest.dayNumber} of ${contest.totalDays}` : contest.status === 'upcoming' ? `⏳ Starts in ${contest.startsIn} days` : '🏁 Finished'}
          </span>
          <h1>{contest.name}</h1>
          {contest.description && <p className="muted">{contest.description}</p>}
          <div className="contest-meta">
            <span>📅 {dateLabel(contest.startDate)} → {dateLabel(contest.endDate)}</span>
            <span>👥 {contest.participants} walkers</span>
            <span>🛡️ {teams.items.length} teams</span>
          </div>
          {contest.status === 'active' && (
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(contest.dayNumber / contest.totalDays) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="contest-actions">
          {joined && individual.me && (
            <div className="my-rank">
              <small className="muted">YOUR RANK</small>
              <strong>#{individual.me.rank}</strong>
              <small>{fmt(individual.me.total)} steps</small>
            </div>
          )}
          {!joined && open && (
            <button className="btn btn-primary btn-lg" onClick={() => act(`/contests/${id}/join`, 'You joined the contest!')}>
              Join contest free
            </button>
          )}
          {joined && open && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (window.confirm('Leave this contest? You will also leave your team.')) act(`/contests/${id}/leave`, 'You left the contest');
              }}
            >
              Leave contest
            </button>
          )}
        </div>
      </section>

      <div className="grid-2 contest-grid">
        <div className="stack">
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={tab === 'teams'} className={tab === 'teams' ? 'on' : ''} onClick={() => setTab('teams')}>Team ranking</button>
            <button role="tab" aria-selected={tab === 'individual'} className={tab === 'individual' ? 'on' : ''} onClick={() => setTab('individual')}>Individual ranking</button>
          </div>

          {tab === 'individual' ? (
            <section className="card">
              <Podium items={individual.items} />
              <RankList items={individual.items} showTeam />
            </section>
          ) : (
            <section className="card">
              {!teams.items.length ? (
                <div className="empty">
                  <div className="empty-icon" aria-hidden="true">🛡️</div>
                  <p className="muted">No teams yet. Be the first to start one!</p>
                </div>
              ) : (
                <ol className="rank-list">
                  {teams.items.map((t) => (
                    <li key={t.teamId} className={`rank-row${t.isMine ? ' me' : ''}`}>
                      <span className="rank-num">{MEDALS[t.rank] || t.rank}</span>
                      <span className="team-badge" aria-hidden="true">🛡️</span>
                      <div className="rank-name">
                        <strong className="ellipsis">
                          {t.name} {t.isMine && <span className="pill pill-ok tiny-pill">Your team</span>}
                        </strong>
                        <small className="muted">
                          {t.members}/{teams.maxTeamSize} members · {fmt(t.total)} total · captain {t.captainName || '—'}
                        </small>
                      </div>
                      <div className="rank-right">
                        <span className="rank-value">{fmt(t.average)}</span>
                        <small className="muted">avg / member</small>
                        {open && !myTeam && !t.isFull && (
                          <button className="btn btn-ghost btn-xs" onClick={() => joinTeam(t.teamId, t.name)}>Join</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>

        <div className="stack">
          {joined || !open ? (
            <TeamPanel contestId={id} myTeam={myTeam} contest={contest} onChange={load} />
          ) : (
            <section className="card">
              <h3>Why join?</h3>
              <ul className="how">
                <li>🏆 Climb the individual and team rankings</li>
                <li>🤝 Walk with friends, family or colleagues</li>
                <li>🔥 60 days is enough to make 10K a lifelong habit</li>
                <li>💸 Completely free</li>
              </ul>
            </section>
          )}
          <section className="card">
            <h3>Rules</h3>
            <ul className="how small">
              <li>Steps between the start date and today count toward rankings.</li>
              <li>Individuals rank by total steps; ties break on goal days.</li>
              <li>Teams rank by average steps per member (max {teams.maxTeamSize} members).</li>
              <li>One team per walker per contest. Captaincy passes on if the captain leaves.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
