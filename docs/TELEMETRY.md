# Player telemetry

How the game runs for real players (#373): errors, WebGL context losses and frame times per level, read by the
studio. First-party only: the game talks to its own `/api/telemetry`, which stores reports in the leaderboard's
Supabase project (docs/LEADERBOARD.md). The decision and its privacy limits are in the decision log (#373).

## What is sent

One beacon per page load (`navigator.sendBeacon`), when the tab is first hidden or closed, and only if the visit
played a level for at least 60 frames, hit an error, or lost its WebGL context (`src/telemetry/`):

- `version` (`<package version>+<commit>`), `touch` (coarse pointer), `cores` (`hardwareConcurrency`), `gpu`
  (the WebGL renderer string, 120 chars max);
- `contextLost`: how many `webglcontextlost` events;
- `errors`: up to 5 distinct uncaught errors / unhandled rejections from the game's own scripts, each its message
  (200 chars) and first stack frame (160 chars), URLs cut to their path, with a count;
- `levels`: per level played, its frames, median and p95 frame time (game play only: not the countdown or a
  pause), and the graphics quality and dpr in effect.

No ids, cookies or IPs. Same gate as Web Analytics: only scoaster.com's Vercel build, never dev, `vite preview`,
CI, the smoke (`?e2e=1`), Alex's browsers (`?internal=1`) or the portal build.

## The API

`api/telemetry.ts` (checks and summary in `api/_lib/telemetryRules.ts`):

- `POST /api/telemetry` → 204. A malformed report is dropped whole (400); over 6 KB, 413; over 10 reports from one
  IP in 10 minutes, 429 (keyed by an HMAC of the IP under a daily salt). Now and then it deletes rows older than 30 days.
- `GET /api/telemetry` → the last 24 h aggregated, CDN-cached 5 minutes: `sessions`, `errors` (per message + frame:
  `key`, sessions, count, first / last seen, versions), `contextLost` (sessions, top GPUs), `frames` (per level ×
  `touch` / `desktop`: sessions, median of the sessions' p50 and p95, the worst p95). No stored row is returned.
- No env vars, a paused project or any database error: `503 { "error": "unavailable" }`.

## Who reads it

`scripts/playerTelemetry.cjs`: the status page's "📡 Players (last 24 h)" section (`studio-status.cjs`), and the
studio-health watchdog (`studio-health.cjs`, every 2 h), which files one issue per error seen in 3+ sessions
(`player-error:<key>`) and one per level whose phone p95 is over `budgets.json` `playerFrameMs.touchP95` from 3+
sessions (`player-perf:<level>`).

## Setup (Alex, once)

The leaderboard's setup already gave the function its env vars. Open the Supabase project's SQL editor, paste
`supabase/migrations/0002_telemetry.sql` and run it once. Check: `https://scoaster.com/api/telemetry` answers
`{"sessions":0,…}` (200) instead of a 503. When the free project pauses, both the leaderboard and telemetry answer
503 until it is restored (docs/LEADERBOARD.md).
