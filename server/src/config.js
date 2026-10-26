import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a string of at least 32 characters in production.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5050,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'vrun-dev-only-secret-do-not-use-in-production',
  jwtExpiresIn: '7d',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vrun',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5050/api/googlefit/callback',
  },
  dailyGoal: Number(process.env.DAILY_GOAL) || 10000,
  contestDays: 60,
  maxTeamSize: 10,
  clientDist: path.resolve(__dirname, '../../client/dist'),
  fallbackFile: path.resolve(__dirname, '../data/fallback-steps.json'),
};

export const googleFitConfigured = () =>
  Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri);
