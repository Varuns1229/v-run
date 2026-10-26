import { config } from '../config.js';
import { query } from '../db.js';
import { addDays, toDateStr, today } from '../utils.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const AGGREGATE_URL = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';
const SCOPE = 'https://www.googleapis.com/auth/fitness.activity.read';
const DAY_MS = 86400000;
const TIMEOUT_MS = 15000;

async function fetchJson(url, options) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error_description || body?.error || `HTTP ${res.status}`;
    const err = new Error(`Google API error: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code) {
  return fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
}

export async function saveTokens(userId, tokens) {
  const expiresAt = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
  // Google only returns a refresh_token on first consent; keep the old one otherwise.
  await query(
    `INSERT INTO google_tokens (user_id, access_token, refresh_token, expires_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE access_token = VALUES(access_token),
       refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
       expires_at = VALUES(expires_at)`,
    [userId, tokens.access_token, tokens.refresh_token || null, expiresAt]
  );
}

export async function getTokens(userId) {
  const rows = await query('SELECT * FROM google_tokens WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

async function getValidAccessToken(userId) {
  const row = await getTokens(userId);
  if (!row) throw new Error('Google Fit is not connected');
  if (Number(row.expires_at) - 60000 > Date.now()) return row.access_token;
  if (!row.refresh_token) throw new Error('Google session expired, please reconnect Google Fit');

  const refreshed = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  await saveTokens(userId, refreshed);
  return refreshed.access_token;
}

function aggregateBody(startMs, endMs, withSource) {
  const by = { dataTypeName: 'com.google.step_count.delta' };
  // estimated_steps matches the number shown in the Google Fit app.
  if (withSource) by.dataSourceId = 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps';
  return JSON.stringify({
    aggregateBy: [by],
    bucketByTime: { durationMillis: DAY_MS },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  });
}

/** Fetch daily step totals for the last `days` days (including today). */
export async function fetchDailySteps(userId, days = 30) {
  const accessToken = await getValidAccessToken(userId);
  const [y, m, d] = addDays(today(), -(days - 1)).split('-').map(Number);
  const startMs = new Date(y, m - 1, d).getTime();
  const endMs = Date.now();
  const opts = (withSource) => ({
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: aggregateBody(startMs, endMs, withSource),
  });

  let data;
  try {
    data = await fetchJson(AGGREGATE_URL, opts(true));
  } catch (err) {
    // Some accounts don't expose the estimated_steps source; retry with the merged type.
    if (err.status && err.status >= 400 && err.status < 500 && err.status !== 401) {
      data = await fetchJson(AGGREGATE_URL, opts(false));
    } else {
      throw err;
    }
  }

  const result = [];
  for (const bucket of data?.bucket || []) {
    const date = toDateStr(new Date(Number(bucket.startTimeMillis)));
    let steps = 0;
    for (const ds of bucket.dataset || []) {
      for (const p of ds.point || []) steps += Number(p.value?.[0]?.intVal) || 0;
    }
    result.push({ date, steps });
  }
  return result;
}

export async function disconnect(userId) {
  const row = await getTokens(userId);
  if (row) {
    const token = row.refresh_token || row.access_token;
    try {
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Revocation is best effort; we still forget the tokens locally.
    }
  }
  await query('DELETE FROM google_tokens WHERE user_id = ?', [userId]);
}
