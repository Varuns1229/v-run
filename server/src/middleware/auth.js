import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

export function signToken(userId) {
  return jwt.sign({ sub: userId, purpose: 'session' }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in to continue' });

    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.purpose !== 'session') return res.status(401).json({ error: 'Invalid session' });

    const rows = await query('SELECT * FROM users WHERE id = ?', [payload.sub]);
    if (!rows.length) return res.status(401).json({ error: 'Account no longer exists' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Your session has expired, please log in again' });
    }
    next(err);
  }
}
