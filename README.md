# V-Run 🏃‍♂️🌱

Walk 10,000 steps a day, keep your streak, grow your garden, and win 60-day team contests. Free.

- **Step sync**: Google Fit (OAuth, read-only). Falls back automatically to a built-in sample month (`server/data/fallback-steps.json`).
- **Streaks**: tracks your current and longest runs of 10K days, and warns you when today's streak is at risk.
- **Plant growth**: today's plant grows through 6 stages and blooms at your goal. Each goal day plants a tree in your 30-day garden.
- **60-day contests**: create or join contests, build teams of up to 10 with invite codes, and see team and individual rankings.
- **Global leaderboard**: week, 30 days, or all time.
- **Rewards**: a streak reward chart (3 to 60 days), step badges, and V-Coins.
- **History**: 7/30/60/90-day bar chart with a goal line, a table view, and a calendar heatmap.

App flow, architecture, data model and API are documented in **[flow.html](flow.html)** (open it in a browser).

## Stack

React 18 + Vite · Node.js 22 + Express 4 · MySQL 8 · JWT auth.

## Quick start

```bash
npm run install:all          # installs root, server and client
# edit server/.env (copy from server/.env.example): DB_USER / DB_PASSWORD
npm run seed                 # optional: 12 demo walkers + 3 teams
npm run dev                  # web http://localhost:5173 · API http://localhost:5050
```

The API creates the `vrun` database and its tables on first start.
Demo login after seeding: `aarav@demo.vrun` / `walker123`.

## Google Fit (optional)

> Google stopped new Google Fit API sign-ups in May 2024 and is retiring the API in 2026.
> If you don't have existing access, V-Run runs on the fallback demo month, and every feature still works.

1. In Google Cloud Console, enable the **Fitness API** and create an OAuth client (Web application).
2. Add the redirect URI `http://localhost:5050/api/googlefit/callback`.
3. Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` in `server/.env`, then restart.
4. In the app, go to **Profile → Connect Google Fit**.

## Production

```bash
npm run build                # builds client/dist
NODE_ENV=production JWT_SECRET=<32+ random chars> CLIENT_URL=https://your.domain npm start
```

Express serves both the API and the built SPA on `PORT`. Run it behind HTTPS.
