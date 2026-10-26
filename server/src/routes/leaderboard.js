import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { addDays, ah, today } from '../utils.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  ah(async (req, res) => {
    const period = ['7', '30', 'all'].includes(String(req.query.period)) ? String(req.query.period) : '7';
    const t = today();
    const from = period === 'all' ? '1970-01-01' : addDays(t, -(Number(period) - 1));

    const rows = await query(
      `SELECT u.id, u.name, u.avatar_color,
              COALESCE(SUM(ds.steps), 0) AS total,
              COALESCE(SUM(ds.steps >= u.daily_goal), 0) AS goal_days
       FROM users u
       LEFT JOIN daily_steps ds ON ds.user_id = u.id AND ds.step_date BETWEEN ? AND ?
       GROUP BY u.id, u.name, u.avatar_color
       ORDER BY total DESC, goal_days DESC, u.name ASC`,
      [from, t]
    );

    const ranked = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.id,
      name: r.name,
      avatarColor: r.avatar_color,
      total: Number(r.total),
      goalDays: Number(r.goal_days),
      isMe: r.id === req.user.id,
    }));

    res.json({ period, items: ranked.slice(0, 100), me: ranked.find((r) => r.isMe) || null, totalUsers: ranked.length });
  })
);

export default router;
