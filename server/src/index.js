import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { config, googleFitConfigured } from './config.js';
import { migrate, getPool } from './db.js';
import authRoutes from './routes/auth.js';
import stepsRoutes from './routes/steps.js';
import googleFitRoutes from './routes/googlefit.js';
import leaderboardRoutes from './routes/leaderboard.js';
import contestRoutes from './routes/contests.js';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: false }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (req, res) => {
  try {
    await getPool().query('SELECT 1');
    res.json({ ok: true, db: 'up', googleFit: googleFitConfigured() ? 'configured' : 'fallback-demo' });
  } catch {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/steps', stepsRoutes);
app.use('/api/googlefit', googleFitRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/contests', contestRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// In production the API also serves the built React app.
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message });
});

async function start() {
  try {
    await migrate();
  } catch (err) {
    console.error(`\n[db] Could not connect to MySQL at ${config.db.host}:${config.db.port} as "${config.db.user}".`);
    console.error('[db] Check DB_* values in server/.env and that MySQL is running.\n', err.message);
    process.exit(1);
  }
  const server = app.listen(config.port, () => {
    console.log(`V-Run API listening on http://localhost:${config.port}`);
    console.log(`Google Fit: ${googleFitConfigured() ? 'configured' : 'not configured, using fallback demo data'}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[server] Port ${config.port} is already in use. Set a different PORT in server/.env.\n`);
    } else {
      console.error('[server]', err);
    }
    process.exit(1);
  });

  const shutdown = () => {
    server.close(async () => {
      await getPool().end().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
