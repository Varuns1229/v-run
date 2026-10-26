// Seeds demo walkers and teams into the active contest so leaderboards look alive.
// Safe to run more than once: existing demo users are skipped.
// All demo accounts use the password: walker123
import bcrypt from 'bcryptjs';
import { getPool, migrate, query } from './db.js';
import { addDays, today } from './utils.js';

const WALKERS = [
  ['Aarav Sharma', 1.25], ['Priya Patel', 1.15], ['Rohan Mehta', 0.95], ['Ananya Iyer', 1.3],
  ['Kabir Singh', 0.85], ['Isha Reddy', 1.05], ['Vihaan Gupta', 0.75], ['Meera Nair', 1.2],
  ['Arjun Das', 1.0], ['Sara Khan', 0.9], ['Dev Joshi', 1.1], ['Nisha Verma', 0.8],
];
const TEAMS = [
  { name: 'Sole Survivors', code: 'SOLE01', members: [0, 1, 2, 3] },
  { name: 'Step Brothers', code: 'STEP02', members: [4, 5, 6, 7] },
  { name: 'Walkie Talkies', code: 'WALK03', members: [8, 9, 10] },
];
const COLORS = ['#22c55e', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#f97316'];

// Deterministic pseudo-random so reseeding gives stable leaderboards.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

async function run() {
  await migrate();
  const hash = await bcrypt.hash('walker123', 10);
  const t = today();
  const ids = [];

  for (let i = 0; i < WALKERS.length; i += 1) {
    const [name, level] = WALKERS[i];
    const email = `${name.split(' ')[0].toLowerCase()}@demo.vrun`;
    const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
    let id = existing?.id;
    if (!id) {
      const r = await query(
        "INSERT INTO users (name, email, password_hash, avatar_color, data_source) VALUES (?, ?, ?, ?, 'demo')",
        [name, email, hash, COLORS[i % COLORS.length]]
      );
      id = r.insertId;
    }
    ids.push(id);

    const rand = rng(1000 + i * 37);
    const rows = [];
    for (let d = 59; d >= 0; d -= 1) {
      const date = addDays(t, -d);
      let steps = Math.round((6500 + rand() * 7500) * level);
      if (rand() < 0.08) steps = Math.round(steps * 0.4); // the odd lazy day
      if (d === 0) steps = Math.round(steps * 0.6); // today is still in progress
      rows.push([id, date, steps, 'demo']);
    }
    await query(
      `INSERT INTO daily_steps (user_id, step_date, steps, source) VALUES ?
       ON DUPLICATE KEY UPDATE steps = IF(source = 'google_fit', steps, VALUES(steps))`,
      [rows]
    );
    await query('UPDATE users SET last_synced_at = NOW() WHERE id = ?', [id]);
  }

  const [contest] = await query(
    'SELECT id FROM contests WHERE start_date <= ? AND end_date >= ? ORDER BY start_date ASC LIMIT 1',
    [t, t]
  );
  if (contest) {
    for (const id of ids) {
      await query('INSERT IGNORE INTO contest_participants (contest_id, user_id) VALUES (?, ?)', [contest.id, id]);
    }
    for (const team of TEAMS) {
      const captain = ids[team.members[0]];
      await query(
        'INSERT IGNORE INTO teams (contest_id, name, invite_code, captain_id) VALUES (?, ?, ?, ?)',
        [contest.id, team.name, team.code, captain]
      );
      const [row] = await query('SELECT id FROM teams WHERE invite_code = ?', [team.code]);
      if (!row) continue;
      for (const m of team.members) {
        await query(
          'UPDATE contest_participants SET team_id = ? WHERE contest_id = ? AND user_id = ? AND team_id IS NULL',
          [row.id, contest.id, ids[m]]
        );
      }
    }
  }

  console.log(`Seeded ${ids.length} demo walkers${contest ? ` and ${TEAMS.length} teams in contest #${contest.id}` : ''}.`);
  console.log('Demo login: aarav@demo.vrun / walker123');
  await getPool().end();
}

run().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await getPool().end().catch(() => {});
  process.exit(1);
});
