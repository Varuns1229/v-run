# V-Run: App Flow

The full visual version (user journey, sync/fallback flow, screens, contest flow, architecture, data model, API) is in **[flow.html](flow.html)**.

## Short version

1. **Landing → Sign up / Log in** (email + password, JWT)
2. **Dashboard** auto-syncs steps:
   - Google Fit connected and configured → pull 30 days from the Fitness API
   - Otherwise, or on any error → load `server/data/fallback-steps.json` (sample month re-dated to the last 30 days)
3. **Today**: progress ring to 10K, growing plant, streak, V-Coins, week chart, 30-day garden
4. **Contests**: join the 60-day challenge → create a team or join with an invite code → team ranking (average per member) and individual ranking (total steps)
5. **Ranks**: global leaderboard (week / 30 days / all time)
6. **Rewards**: streak reward chart (3, 7, 14, 21, 30, 45, 60 days), step badges, coins
7. **History**: 7–90 day chart, table, calendar heatmap
8. **Profile**: connect or disconnect Google Fit, daily goal, name
