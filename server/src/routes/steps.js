import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { buildRewards, getUserSteps, summarize } from '../services/stats.js';
import { syncUser } from '../services/sync.js';
import { addDays, ah, today } from '../utils.js';

const router = Router();
router.use(requireAuth);

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `sync:${req.user.id}`,
  message: { error: 'Syncing too often, give it a minute' },
});

/** Fill gaps so the UI always gets one row per day. */
function fillDays(rows, days) {
  const byDate = new Map(rows.map((r) => [r.step_date, r]));
  const t = today();
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(t, -i);
    const r = byDate.get(date);
    out.push({ date, steps: r ? r.steps : 0, source: r ? r.source : null });
  }
  return out;
}

router.post(
  '/sync',
  syncLimiter,
  ah(async (req, res) => {
    res.json(await syncUser(req.user.id));
  })
);

router.get(
  '/summary',
  ah(async (req, res) => {
    const goal = req.user.daily_goal;
    const rows = await getUserSteps(req.user.id);
    const summary = summarize(rows, goal);
    const garden = fillDays(rows, 30).map((d) => ({ ...d, met: d.steps >= goal }));
    const week = fillDays(rows, 7);
    res.json({ ...summary, garden, week, dataSource: req.user.data_source, lastSyncedAt: req.user.last_synced_at });
  })
);

router.get(
  '/history',
  ah(async (req, res) => {
    const days = [7, 30, 60, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const rows = await getUserSteps(req.user.id, addDays(today(), -(days - 1)));
    const filled = fillDays(rows, days);
    const goal = req.user.daily_goal;
    const total = filled.reduce((a, d) => a + d.steps, 0);
    res.json({
      days,
      goal,
      items: filled,
      stats: {
        total,
        average: Math.round(total / days),
        goalDays: filled.filter((d) => d.steps >= goal).length,
        best: filled.reduce((m, d) => Math.max(m, d.steps), 0),
      },
    });
  })
);

router.get(
  '/rewards',
  ah(async (req, res) => {
    const rows = await getUserSteps(req.user.id);
    const summary = summarize(rows, req.user.daily_goal);
    res.json({ summary, ...buildRewards(summary) });
  })
);

export default router;
