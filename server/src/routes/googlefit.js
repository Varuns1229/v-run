import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config, googleFitConfigured } from '../config.js';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildAuthUrl, disconnect, exchangeCode, getTokens, saveTokens } from '../services/googleFit.js';
import { syncUser } from '../services/sync.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

router.get(
  '/status',
  requireAuth,
  ah(async (req, res) => {
    res.json({ configured: googleFitConfigured(), connected: Boolean(await getTokens(req.user.id)) });
  })
);

router.get(
  '/auth-url',
  requireAuth,
  ah(async (req, res) => {
    if (!googleFitConfigured()) {
      throw new HttpError(
        503,
        'Google Fit is not configured on this server yet. Your dashboard is running on demo data in the meantime.'
      );
    }
    // Short-lived signed state ties the OAuth callback back to this user and blocks CSRF.
    const state = jwt.sign({ sub: req.user.id, purpose: 'gfit' }, config.jwtSecret, { expiresIn: '10m' });
    res.json({ url: buildAuthUrl(state) });
  })
);

router.get('/callback', async (req, res) => {
  const back = (status, msg) => {
    const params = new URLSearchParams({ fit: status });
    if (msg) params.set('msg', msg.slice(0, 200));
    res.redirect(`${config.clientUrl}/profile?${params}`);
  };

  try {
    if (req.query.error) return back('error', `Google said: ${req.query.error}`);
    const { code, state } = req.query;
    if (typeof code !== 'string' || typeof state !== 'string') return back('error', 'Missing authorization code');

    let payload;
    try {
      payload = jwt.verify(state, config.jwtSecret);
    } catch {
      return back('error', 'The connection link expired, please try again');
    }
    if (payload.purpose !== 'gfit') return back('error', 'Invalid connection request');

    const tokens = await exchangeCode(code);
    await saveTokens(payload.sub, tokens);
    const result = await syncUser(payload.sub);
    return back(result.fallback ? 'fallback' : 'connected', result.fallback ? result.reason : null);
  } catch (err) {
    console.error('[googlefit] callback failed:', err.message);
    return back('error', 'Could not connect Google Fit. Demo data is still available.');
  }
});

router.post(
  '/disconnect',
  requireAuth,
  ah(async (req, res) => {
    await disconnect(req.user.id);
    await query(
      `UPDATE users SET data_source = IF(EXISTS(SELECT 1 FROM daily_steps WHERE user_id = ?), 'demo', 'none') WHERE id = ?`,
      [req.user.id, req.user.id]
    );
    res.json({ ok: true });
  })
);

export default router;
