export const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

export const shortNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return String(v);
};

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const dayLabel = (s) => parseDate(s).toLocaleDateString('en-IN', { weekday: 'short' });
export const dateLabel = (s) => parseDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const longDate = (s) =>
  parseDate(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

export function timeAgo(iso) {
  if (!iso) return 'never';
  const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (Number.isNaN(mins)) return 'recently';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** A nudge that changes with how far along today's goal the user is. */
export function progressMessage(steps, goal) {
  const left = Math.max(0, goal - steps);
  const pct = steps / goal;
  const mins = Math.ceil(left / 100); // ~100 steps per minute of brisk walking
  if (pct >= 1.5) return { title: 'Absolute legend! 🌟', text: `${fmt(steps)} steps. Your garden is thriving.` };
  if (pct >= 1) return { title: 'Goal crushed! 🎉', text: 'Your plant is in full bloom. Streak secured for today.' };
  if (pct >= 0.75) return { title: 'Almost there! 🔥', text: `Just ${fmt(left)} steps. A ${mins}-minute walk seals it.` };
  if (pct >= 0.5) return { title: 'Halfway hero 💪', text: `${fmt(left)} to go. Take the stairs, walk your calls.` };
  if (pct >= 0.2) return { title: 'Good start 🌱', text: `Your sprout needs ${fmt(left)} more steps to bloom.` };
  return { title: 'Let’s get moving 👟', text: `Every step waters your plant. ${fmt(left)} steps to bloom today.` };
}

const QUOTES = [
  'The journey of a thousand miles begins with a single step.',
  'Walking is man’s best medicine.',
  'You don’t have to go fast. You just have to go.',
  'Small steps every day add up to big results.',
  'Your only competition is who you were yesterday.',
  'Motivation gets you started. Habit keeps you going.',
  'A walk a day keeps the doctor away.',
  'Discipline is choosing what you want most over what you want now.',
  'Don’t break the chain.',
  'Strong legs, clear mind, happy heart.',
];

export function quoteOfTheDay() {
  const d = new Date();
  const idx = (d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % QUOTES.length;
  return QUOTES[idx];
}

/** Plant stage 0-5 from today's progress. */
export function plantStage(steps, goal) {
  const p = steps / goal;
  if (p >= 1) return 5;
  if (p >= 0.75) return 4;
  if (p >= 0.5) return 3;
  if (p >= 0.25) return 2;
  if (p >= 0.05) return 1;
  return 0;
}

export const PLANT_STAGES = ['Seed', 'Sprout', 'Seedling', 'Sapling', 'Young tree', 'In bloom'];
