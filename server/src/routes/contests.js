import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { query, withTx } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { addDays, ah, cleanString, diffDays, HttpError, isValidDateStr, today } from '../utils.js';

const router = Router();
router.use(requireAuth);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function inviteCode() {
  const bytes = crypto.randomBytes(6);
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

function contestStatus(c, t = today()) {
  if (t < c.start_date) return 'upcoming';
  if (t > c.end_date) return 'completed';
  return 'active';
}

/** The date range that counts toward rankings right now. */
function scoringWindow(c, t = today()) {
  return { from: c.start_date, to: t < c.end_date ? t : c.end_date };
}

function shapeContest(c, t = today()) {
  const status = contestStatus(c, t);
  const totalDays = diffDays(c.start_date, c.end_date) + 1;
  const dayNumber = status === 'active' ? diffDays(c.start_date, t) + 1 : status === 'completed' ? totalDays : 0;
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    startDate: c.start_date,
    endDate: c.end_date,
    maxTeamSize: c.max_team_size,
    createdBy: c.created_by,
    status,
    totalDays,
    dayNumber,
    daysLeft: status === 'completed' ? 0 : diffDays(t, c.end_date) + 1,
    startsIn: status === 'upcoming' ? diffDays(t, c.start_date) : 0,
  };
}

async function loadContest(id) {
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) throw new HttpError(400, 'Invalid contest id');
  const [c] = await query('SELECT * FROM contests WHERE id = ?', [cid]);
  if (!c) throw new HttpError(404, 'Contest not found');
  return c;
}

async function getParticipation(contestId, userId) {
  const [p] = await query('SELECT * FROM contest_participants WHERE contest_id = ? AND user_id = ?', [contestId, userId]);
  return p || null;
}

function assertOpen(c) {
  if (contestStatus(c) === 'completed') throw new HttpError(400, 'This contest has already finished');
}

/** Remove a user from their team; hand over captaincy or delete the empty team. Runs inside a tx. */
async function leaveTeamTx(conn, contestId, userId) {
  const [p] = await conn.q(
    'SELECT team_id FROM contest_participants WHERE contest_id = ? AND user_id = ? FOR UPDATE',
    [contestId, userId]
  );
  if (!p || !p.team_id) return;
  const teamId = p.team_id;
  await conn.q('UPDATE contest_participants SET team_id = NULL WHERE contest_id = ? AND user_id = ?', [contestId, userId]);

  const remaining = await conn.q(
    'SELECT user_id FROM contest_participants WHERE team_id = ? ORDER BY joined_at ASC, user_id ASC',
    [teamId]
  );
  if (!remaining.length) {
    await conn.q('DELETE FROM teams WHERE id = ?', [teamId]);
  } else {
    await conn.q('UPDATE teams SET captain_id = ? WHERE id = ? AND (captain_id = ? OR captain_id IS NULL)', [
      remaining[0].user_id,
      teamId,
      userId,
    ]);
  }
}

// ---------- Contests ----------

router.get(
  '/',
  ah(async (req, res) => {
    const rows = await query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM contest_participants cp WHERE cp.contest_id = c.id) AS participants,
              (SELECT COUNT(*) FROM teams t WHERE t.contest_id = c.id) AS team_count,
              me.user_id AS joined, me.team_id AS my_team_id, mt.name AS my_team_name
       FROM contests c
       LEFT JOIN contest_participants me ON me.contest_id = c.id AND me.user_id = ?
       LEFT JOIN teams mt ON mt.id = me.team_id
       ORDER BY c.end_date < CURDATE() ASC, c.start_date DESC`,
      [req.user.id]
    );
    const t = today();
    res.json({
      items: rows.map((c) => ({
        ...shapeContest(c, t),
        participants: Number(c.participants),
        teamCount: Number(c.team_count),
        joined: Boolean(c.joined),
        myTeam: c.my_team_id ? { id: c.my_team_id, name: c.my_team_name } : null,
      })),
    });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const name = cleanString(req.body?.name, 100);
    const description = cleanString(req.body?.description, 500);
    const startDate = req.body?.startDate || today();
    const t = today();

    if (name.length < 3) throw new HttpError(400, 'Contest name must be at least 3 characters');
    if (!isValidDateStr(startDate)) throw new HttpError(400, 'Start date must be a valid date (YYYY-MM-DD)');
    const offset = diffDays(t, startDate);
    // Allow one day back so a user in a timezone behind/ahead of the server isn't rejected around midnight.
    if (offset < -1 || offset > 90) throw new HttpError(400, 'Start date must be between today and 90 days from now');

    const endDate = addDays(startDate, config.contestDays - 1);
    const id = await withTx(async (conn) => {
      const r = await conn.q(
        'INSERT INTO contests (name, description, start_date, end_date, max_team_size, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description, startDate, endDate, config.maxTeamSize, req.user.id]
      );
      await conn.q('INSERT INTO contest_participants (contest_id, user_id) VALUES (?, ?)', [r.insertId, req.user.id]);
      return r.insertId;
    });
    const c = await loadContest(id);
    res.status(201).json({ contest: shapeContest(c) });
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    const p = await getParticipation(c.id, req.user.id);
    let myTeam = null;
    if (p?.team_id) {
      const [team] = await query('SELECT id, name, invite_code, captain_id FROM teams WHERE id = ?', [p.team_id]);
      if (team) {
        myTeam = { id: team.id, name: team.name, inviteCode: team.invite_code, isCaptain: team.captain_id === req.user.id };
      }
    }
    const [{ participants }] = await query('SELECT COUNT(*) AS participants FROM contest_participants WHERE contest_id = ?', [
      c.id,
    ]);
    res.json({ contest: { ...shapeContest(c), participants: Number(participants) }, joined: Boolean(p), myTeam });
  })
);

router.post(
  '/:id/join',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    assertOpen(c);
    await query('INSERT IGNORE INTO contest_participants (contest_id, user_id) VALUES (?, ?)', [c.id, req.user.id]);
    res.json({ ok: true });
  })
);

router.post(
  '/:id/leave',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    assertOpen(c);
    await withTx(async (conn) => {
      await leaveTeamTx(conn, c.id, req.user.id);
      await conn.q('DELETE FROM contest_participants WHERE contest_id = ? AND user_id = ?', [c.id, req.user.id]);
    });
    res.json({ ok: true });
  })
);

// ---------- Leaderboards ----------

router.get(
  '/:id/leaderboard/individual',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    const { from, to } = scoringWindow(c);
    const rows = await query(
      `SELECT u.id, u.name, u.avatar_color, t.id AS team_id, t.name AS team_name,
              COALESCE(SUM(ds.steps), 0) AS total,
              COALESCE(SUM(ds.steps >= u.daily_goal), 0) AS goal_days
       FROM contest_participants cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN teams t ON t.id = cp.team_id
       LEFT JOIN daily_steps ds ON ds.user_id = cp.user_id AND ds.step_date BETWEEN ? AND ?
       WHERE cp.contest_id = ?
       GROUP BY u.id, u.name, u.avatar_color, t.id, t.name
       ORDER BY total DESC, goal_days DESC, u.name ASC`,
      [from, to, c.id]
    );
    const items = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.id,
      name: r.name,
      avatarColor: r.avatar_color,
      team: r.team_id ? { id: r.team_id, name: r.team_name } : null,
      total: Number(r.total),
      goalDays: Number(r.goal_days),
      isMe: r.id === req.user.id,
    }));
    res.json({ items, me: items.find((i) => i.isMe) || null });
  })
);

router.get(
  '/:id/leaderboard/teams',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    const { from, to } = scoringWindow(c);
    const p = await getParticipation(c.id, req.user.id);
    const rows = await query(
      `SELECT t.id, t.name, t.captain_id, cu.name AS captain_name,
              COUNT(cp.user_id) AS members,
              COALESCE(SUM(x.total), 0) AS total
       FROM teams t
       JOIN contest_participants cp ON cp.team_id = t.id
       LEFT JOIN users cu ON cu.id = t.captain_id
       LEFT JOIN (
         SELECT user_id, SUM(steps) AS total FROM daily_steps WHERE step_date BETWEEN ? AND ? GROUP BY user_id
       ) x ON x.user_id = cp.user_id
       WHERE t.contest_id = ?
       GROUP BY t.id, t.name, t.captain_id, cu.name`,
      [from, to, c.id]
    );
    // Teams are ranked by average steps per member so small teams can compete with big ones.
    const items = rows
      .map((r) => {
        const members = Number(r.members);
        const total = Number(r.total);
        return {
          teamId: r.id,
          name: r.name,
          captainName: r.captain_name,
          members,
          total,
          average: members ? Math.round(total / members) : 0,
          isMine: p?.team_id === r.id,
          isFull: members >= c.max_team_size,
        };
      })
      .sort((a, b) => b.average - a.average || b.total - a.total || a.name.localeCompare(b.name))
      .map((r, i) => ({ rank: i + 1, ...r }));
    res.json({ items, maxTeamSize: c.max_team_size });
  })
);

// ---------- Teams ----------

router.get(
  '/:id/teams/:teamId',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    const teamId = Number(req.params.teamId);
    const [team] = await query('SELECT * FROM teams WHERE id = ? AND contest_id = ?', [teamId, c.id]);
    if (!team) throw new HttpError(404, 'Team not found');
    const { from, to } = scoringWindow(c);
    const members = await query(
      `SELECT u.id, u.name, u.avatar_color, COALESCE(SUM(ds.steps), 0) AS total,
              COALESCE(SUM(ds.steps >= u.daily_goal), 0) AS goal_days
       FROM contest_participants cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN daily_steps ds ON ds.user_id = u.id AND ds.step_date BETWEEN ? AND ?
       WHERE cp.team_id = ?
       GROUP BY u.id, u.name, u.avatar_color
       ORDER BY total DESC`,
      [from, to, team.id]
    );
    const isMember = members.some((m) => m.id === req.user.id);
    res.json({
      team: {
        id: team.id,
        name: team.name,
        captainId: team.captain_id,
        inviteCode: isMember ? team.invite_code : null,
        isMember,
      },
      members: members.map((m) => ({
        userId: m.id,
        name: m.name,
        avatarColor: m.avatar_color,
        total: Number(m.total),
        goalDays: Number(m.goal_days),
        isCaptain: m.id === team.captain_id,
      })),
    });
  })
);

router.post(
  '/:id/teams',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    assertOpen(c);
    const name = cleanString(req.body?.name, 60);
    if (name.length < 3) throw new HttpError(400, 'Team name must be at least 3 characters');

    const team = await withTx(async (conn) => {
      await conn.q('INSERT IGNORE INTO contest_participants (contest_id, user_id) VALUES (?, ?)', [c.id, req.user.id]);
      const [p] = await conn.q(
        'SELECT team_id FROM contest_participants WHERE contest_id = ? AND user_id = ? FOR UPDATE',
        [c.id, req.user.id]
      );
      if (p.team_id) throw new HttpError(409, 'You are already in a team for this contest. Leave it first.');

      const [dupe] = await conn.q('SELECT id FROM teams WHERE contest_id = ? AND name = ?', [c.id, name]);
      if (dupe) throw new HttpError(409, 'A team with that name already exists in this contest');

      let code;
      for (let i = 0; i < 5; i += 1) {
        code = inviteCode();
        const [taken] = await conn.q('SELECT id FROM teams WHERE invite_code = ?', [code]);
        if (!taken) break;
      }
      const r = await conn.q('INSERT INTO teams (contest_id, name, invite_code, captain_id) VALUES (?, ?, ?, ?)', [
        c.id,
        name,
        code,
        req.user.id,
      ]);
      await conn.q('UPDATE contest_participants SET team_id = ? WHERE contest_id = ? AND user_id = ?', [
        r.insertId,
        c.id,
        req.user.id,
      ]);
      return { id: r.insertId, name, inviteCode: code };
    });
    res.status(201).json({ team });
  })
);

router.post(
  '/:id/teams/join',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    assertOpen(c);
    const code = cleanString(req.body?.code, 12).toUpperCase();
    const teamId = Number(req.body?.teamId);
    if (!code && !Number.isInteger(teamId)) throw new HttpError(400, 'Provide an invite code or pick a team');

    const team = await withTx(async (conn) => {
      const [t] = code
        ? await conn.q('SELECT * FROM teams WHERE invite_code = ? FOR UPDATE', [code])
        : await conn.q('SELECT * FROM teams WHERE id = ? FOR UPDATE', [teamId]);
      if (!t || t.contest_id !== c.id) throw new HttpError(404, 'No team found in this contest with that code');

      await conn.q('INSERT IGNORE INTO contest_participants (contest_id, user_id) VALUES (?, ?)', [c.id, req.user.id]);
      const [p] = await conn.q(
        'SELECT team_id FROM contest_participants WHERE contest_id = ? AND user_id = ? FOR UPDATE',
        [c.id, req.user.id]
      );
      if (p.team_id === t.id) throw new HttpError(409, 'You are already in this team');
      if (p.team_id) throw new HttpError(409, 'You are already in a team for this contest. Leave it first.');

      const [{ n }] = await conn.q('SELECT COUNT(*) AS n FROM contest_participants WHERE team_id = ?', [t.id]);
      if (n >= c.max_team_size) throw new HttpError(409, `This team is full (${c.max_team_size} members max)`);

      await conn.q('UPDATE contest_participants SET team_id = ? WHERE contest_id = ? AND user_id = ?', [
        t.id,
        c.id,
        req.user.id,
      ]);
      return { id: t.id, name: t.name };
    });
    res.json({ team });
  })
);

router.post(
  '/:id/teams/leave',
  ah(async (req, res) => {
    const c = await loadContest(req.params.id);
    assertOpen(c);
    await withTx((conn) => leaveTeamTx(conn, c.id, req.user.id));
    res.json({ ok: true });
  })
);

export default router;
