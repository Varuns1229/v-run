import fs from 'node:fs/promises';
import { config, googleFitConfigured } from '../config.js';
import { query } from '../db.js';
import { addDays, today } from '../utils.js';
import { fetchDailySteps, getTokens } from './googleFit.js';

let fallbackCache = null;

async function loadFallback() {
  if (!fallbackCache) {
    const raw = JSON.parse(await fs.readFile(config.fallbackFile, 'utf8'));
    fallbackCache = (raw.days || []).map((d) => Math.max(0, Math.round(Number(d.steps) || 0)));
  }
  return fallbackCache;
}

/**
 * Map the hardcoded month onto the last N days ending today.
 * A small per-user multiplier (0-12%) keeps leaderboards from being one big tie,
 * and today's number is scaled by how much of the day has passed.
 */
export async function buildFallbackDays(userId) {
  const values = await loadFallback();
  const t = today();
  const factor = 1 + ((userId * 7919) % 13) / 100;
  const now = new Date();
  const dayFraction = (now.getHours() * 60 + now.getMinutes()) / 1440;
  const todayScale = Math.min(1, Math.max(0.08, dayFraction * 1.15));

  return values.map((v, i) => {
    const date = addDays(t, i - (values.length - 1));
    let steps = Math.round(v * factor);
    if (date === t) steps = Math.round(steps * todayScale);
    return { date, steps };
  });
}

async function upsert(userId, days, source) {
  if (!days.length) return;
  const rows = days.map((d) => [userId, d.date, d.steps, source]);
  if (source === 'google_fit') {
    await query(
      `INSERT INTO daily_steps (user_id, step_date, steps, source) VALUES ?
       ON DUPLICATE KEY UPDATE steps = VALUES(steps), source = VALUES(source)`,
      [rows]
    );
  } else {
    // Demo data never overwrites real Google Fit data.
    await query(
      `INSERT INTO daily_steps (user_id, step_date, steps, source) VALUES ?
       ON DUPLICATE KEY UPDATE
         steps = IF(source = 'google_fit', steps, VALUES(steps)),
         source = IF(source = 'google_fit', source, VALUES(source))`,
      [rows]
    );
  }
}

/** Pull steps for a user: Google Fit when connected, otherwise (or on failure) the fallback month. */
export async function syncUser(userId) {
  const tokens = await getTokens(userId);
  let reason = null;

  if (tokens && googleFitConfigured()) {
    try {
      const days = await fetchDailySteps(userId, 30);
      await upsert(userId, days, 'google_fit');
      await query("UPDATE users SET data_source = 'google_fit', last_synced_at = NOW() WHERE id = ?", [userId]);
      return { source: 'google_fit', fallback: false, days: days.length, message: 'Synced from Google Fit' };
    } catch (err) {
      console.warn(`[sync] Google Fit sync failed for user ${userId}: ${err.message}`);
      reason = err.message;
    }
  } else if (tokens && !googleFitConfigured()) {
    reason = 'Google Fit credentials are not configured on the server';
  } else {
    reason = googleFitConfigured() ? 'Google Fit is not connected yet' : 'Google Fit is not configured';
  }

  const days = await buildFallbackDays(userId);
  await upsert(userId, days, 'demo');
  await query(
    `UPDATE users SET data_source = IF(data_source = 'google_fit', 'google_fit', 'demo'), last_synced_at = NOW() WHERE id = ?`,
    [userId]
  );
  return {
    source: 'demo',
    fallback: true,
    days: days.length,
    reason,
    message: 'Showing demo data from the fallback month',
  };
}
