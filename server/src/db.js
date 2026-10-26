import mysql from 'mysql2/promise';
import { config } from './config.js';
import { addDays, today } from './utils.js';

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...config.db,
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true, // DATE columns come back as 'YYYY-MM-DD'
      charset: 'utf8mb4',
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/** Run `fn(conn)` inside a transaction; conn.q(sql, params) returns rows. */
export async function withTx(fn) {
  const conn = await getPool().getConnection();
  conn.q = async (sql, params = []) => (await conn.query(sql, params))[0];
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    daily_goal INT UNSIGNED NOT NULL DEFAULT 10000,
    avatar_color VARCHAR(16) NOT NULL DEFAULT '#22c55e',
    data_source ENUM('none','google_fit','demo') NOT NULL DEFAULT 'none',
    last_synced_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS google_tokens (
    user_id INT UNSIGNED PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS daily_steps (
    user_id INT UNSIGNED NOT NULL,
    step_date DATE NOT NULL,
    steps INT UNSIGNED NOT NULL DEFAULT 0,
    source ENUM('google_fit','demo') NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, step_date),
    KEY idx_date (step_date),
    CONSTRAINT fk_ds_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS contests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    max_team_size INT UNSIGNED NOT NULL DEFAULT 10,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_c_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS teams (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    contest_id INT UNSIGNED NOT NULL,
    name VARCHAR(60) NOT NULL,
    invite_code VARCHAR(12) NOT NULL UNIQUE,
    captain_id INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_team_name (contest_id, name),
    CONSTRAINT fk_t_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
    CONSTRAINT fk_t_captain FOREIGN KEY (captain_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS contest_participants (
    contest_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    team_id INT UNSIGNED NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contest_id, user_id),
    KEY idx_team (team_id),
    CONSTRAINT fk_cp_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
    CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cp_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

/** Create the database (if missing), tables, and a default contest. Idempotent. */
export async function migrate() {
  const { database, ...conn } = config.db;
  const admin = await mysql.createConnection(conn);
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();

  for (const stmt of SCHEMA) await query(stmt);

  const [{ n }] = await query('SELECT COUNT(*) AS n FROM contests');
  if (n === 0) {
    // Kick things off with an active 60-day season that started two weeks ago.
    const start = addDays(today(), -14);
    await query(
      'INSERT INTO contests (name, description, start_date, end_date, max_team_size) VALUES (?, ?, ?, ?, ?)',
      [
        'V-Run 60 Day Challenge',
        'Walk 10,000 steps a day for 60 days. Build a team, climb the leaderboard and grow your garden.',
        start,
        addDays(start, config.contestDays - 1),
        config.maxTeamSize,
      ]
    );
  }
}
