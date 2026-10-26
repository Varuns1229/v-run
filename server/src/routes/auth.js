import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { ah, cleanString, HttpError } from '../utils.js';

const router = Router();

const AVATAR_COLORS = ['#22c55e', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#f97316'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in a few minutes' },
});

export async function publicUser(u) {
  const tokens = await query('SELECT 1 FROM google_tokens WHERE user_id = ?', [u.id]);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    dailyGoal: u.daily_goal,
    avatarColor: u.avatar_color,
    dataSource: u.data_source,
    lastSyncedAt: u.last_synced_at,
    createdAt: u.created_at,
    googleConnected: tokens.length > 0,
  };
}

router.post(
  '/signup',
  authLimiter,
  ah(async (req, res) => {
    const name = cleanString(req.body?.name, 80);
    const email = cleanString(req.body?.email, 190).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2) throw new HttpError(400, 'Please enter your name (at least 2 characters)');
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address');
    if (password.length < 8 || password.length > 72) {
      throw new HttpError(400, 'Password must be 8 to 72 characters long');
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) throw new HttpError(409, 'An account with this email already exists');

    const hash = await bcrypt.hash(password, 10);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const result = await query('INSERT INTO users (name, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)', [
      name,
      email,
      hash,
      color,
    ]);
    const [user] = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ token: signToken(user.id), user: await publicUser(user) });
  })
);

router.post(
  '/login',
  authLimiter,
  ah(async (req, res) => {
    const email = cleanString(req.body?.email, 190).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) throw new HttpError(400, 'Email and password are required');

    const [user] = await query('SELECT * FROM users WHERE email = ?', [email]);
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) throw new HttpError(401, 'Incorrect email or password');

    res.json({ token: signToken(user.id), user: await publicUser(user) });
  })
);

router.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    res.json({ user: await publicUser(req.user) });
  })
);

router.patch(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const updates = [];
    const params = [];

    if (req.body?.name !== undefined) {
      const name = cleanString(req.body.name, 80);
      if (name.length < 2) throw new HttpError(400, 'Name must be at least 2 characters');
      updates.push('name = ?');
      params.push(name);
    }
    if (req.body?.dailyGoal !== undefined) {
      const goal = Number(req.body.dailyGoal);
      if (!Number.isInteger(goal) || goal < 2000 || goal > 50000) {
        throw new HttpError(400, 'Daily goal must be a whole number between 2,000 and 50,000');
      }
      updates.push('daily_goal = ?');
      params.push(goal);
    }
    if (!updates.length) throw new HttpError(400, 'Nothing to update');

    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...params, req.user.id]);
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: await publicUser(user) });
  })
);

export default router;
