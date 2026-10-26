import { query } from '../db.js';
import { addDays, diffDays, today } from '../utils.js';

// Rough conversions used for the "distance" and "calories" stat tiles.
const KM_PER_STEP = 0.000762;
const KCAL_PER_STEP = 0.04;

export const STREAK_MILESTONES = [
  { days: 3, key: 'spark', title: 'Spark', emoji: '✨', coins: 30, desc: '3-day streak. The habit is lit.' },
  { days: 7, key: 'week', title: 'Week Warrior', emoji: '🔥', coins: 75, desc: 'A full week of 10K days.' },
  { days: 14, key: 'fortnight', title: 'Fortnight Force', emoji: '⚡', coins: 150, desc: 'Two straight weeks.' },
  { days: 21, key: 'habit', title: 'Habit Hero', emoji: '🦸', coins: 250, desc: '21 days: it is a habit now.' },
  { days: 30, key: 'month', title: 'Monthly Master', emoji: '🏅', coins: 400, desc: 'A whole month without a miss.' },
  { days: 45, key: 'unstoppable', title: 'Unstoppable', emoji: '🚀', coins: 600, desc: '45 days of pure grit.' },
  { days: 60, key: 'legend', title: 'V-Run Legend', emoji: '👑', coins: 1000, desc: 'The full 60-day challenge, unbroken.' },
];

export const STEP_BADGES = [
  { key: 'first10k', title: 'First 10K', emoji: '👟', desc: 'Hit 10,000 steps in a single day.', test: (s) => s.bestDay >= 10000 },
  { key: 'day15k', title: 'Power Walker', emoji: '💪', desc: '15,000 steps in a single day.', test: (s) => s.bestDay >= 15000 },
  { key: 'day20k', title: 'Marathoner', emoji: '🏃', desc: '20,000 steps in a single day.', test: (s) => s.bestDay >= 20000 },
  { key: 'total100k', title: '100K Club', emoji: '💯', desc: '100,000 lifetime steps.', test: (s) => s.totalSteps >= 100000 },
  { key: 'total250k', title: 'Quarter Million', emoji: '🌍', desc: '250,000 lifetime steps.', test: (s) => s.totalSteps >= 250000 },
  { key: 'total500k', title: 'Half-Million Hiker', emoji: '⛰️', desc: '500,000 lifetime steps.', test: (s) => s.totalSteps >= 500000 },
  { key: 'total1m', title: 'Millionaire', emoji: '💎', desc: '1,000,000 lifetime steps.', test: (s) => s.totalSteps >= 1000000 },
];

/**
 * Compute streaks from a list of {step_date, steps}.
 * The current streak stays alive through today while today is still in progress:
 * if today's goal is not met yet, the streak counts back from yesterday.
 */
export function computeStreaks(rows, goal, todayStr = today()) {
  const met = new Set(rows.filter((r) => r.steps >= goal).map((r) => r.step_date));

  let current = 0;
  let cursor = met.has(todayStr) ? todayStr : addDays(todayStr, -1);
  while (met.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...met].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest, todayMet: met.has(todayStr), goalDays: met.size };
}

/** V-Coins: 1 coin per 1,000 steps (capped at 25/day) + 10 for each goal day + milestone bonuses. */
export function computeCoins(rows, goal, longestStreak) {
  let coins = 0;
  for (const r of rows) {
    coins += Math.min(Math.floor(r.steps / 1000), 25);
    if (r.steps >= goal) coins += 10;
  }
  for (const m of STREAK_MILESTONES) if (longestStreak >= m.days) coins += m.coins;
  return coins;
}

export async function getUserSteps(userId, fromDate = null) {
  const params = [userId];
  let sql = 'SELECT step_date, steps, source FROM daily_steps WHERE user_id = ?';
  if (fromDate) {
    sql += ' AND step_date >= ?';
    params.push(fromDate);
  }
  sql += ' ORDER BY step_date ASC';
  return query(sql, params);
}

export function summarize(rows, goal) {
  const t = today();
  const totalSteps = rows.reduce((a, r) => a + r.steps, 0);
  const activeDays = rows.filter((r) => r.steps > 0).length;
  const bestRow = rows.reduce((best, r) => (!best || r.steps > best.steps ? r : best), null);
  const todayRow = rows.find((r) => r.step_date === t);
  const streak = computeStreaks(rows, goal, t);
  return {
    today: todayRow ? todayRow.steps : 0,
    goal,
    totalSteps,
    activeDays,
    averageSteps: activeDays ? Math.round(totalSteps / activeDays) : 0,
    bestDay: bestRow ? bestRow.steps : 0,
    bestDate: bestRow ? bestRow.step_date : null,
    distanceKm: +(totalSteps * KM_PER_STEP).toFixed(1),
    calories: Math.round(totalSteps * KCAL_PER_STEP),
    todayDistanceKm: +((todayRow ? todayRow.steps : 0) * KM_PER_STEP).toFixed(2),
    todayCalories: Math.round((todayRow ? todayRow.steps : 0) * KCAL_PER_STEP),
    streak,
    coins: computeCoins(rows, goal, streak.longest),
  };
}

export function buildRewards(summary) {
  const longest = summary.streak.longest;
  const milestones = STREAK_MILESTONES.map((m) => ({
    ...m,
    unlocked: longest >= m.days,
    progress: longest >= m.days ? 1 : Math.min(1, summary.streak.current / m.days),
  }));
  const next = milestones.find((m) => !m.unlocked) || null;
  const badges = STEP_BADGES.map(({ test, ...b }) => ({ ...b, unlocked: test(summary) }));
  return { milestones, next, badges };
}
