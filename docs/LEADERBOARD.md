# Online leaderboard

The campaign's top 10 per level, shared by everyone who plays on scoaster.com (#365), and
the Daily Run's top 10 of each UTC day (#854). The game runs fine without it: until it is set up, and whenever it is down, the results screen
shows this device's board (a daily, its local record) as before.

## How it fits together

- **Database:** a dedicated Supabase project on Alex's free plan, one table `scores`
  (`supabase/migrations/0001_leaderboard.sql`; `0004_daily_board.sql` adds `day`, a daily
  run's UTC day, null on every campaign row; `0005_rate_limit.sql` adds the rate limit's trigger;
  `0006_daily_ghost.sql` adds `ghost`, a daily run's ghost, #1042). RLS is on with no policies, and only
  `service_role` has grants, so the publishable/anon key can do nothing with it.
- **API:** `api/leaderboard.ts`, a Vercel Function in this repo, is the only thing that
  talks to Supabase, with the server-side secret key from the Vercel env vars.
  - `GET /api/leaderboard?level=level1` → `{ top: [{ initials, score, at }] }`, cached by
    Vercel's CDN for 30 s (`s-maxage=30, stale-while-revalidate=30`: a copy is never more than
    about a minute old, so a score shows in another browser within ~30-60 s, #384). Campaign rows only
    (`day is null`).
  - `GET /api/leaderboard?daily=2026-11-23` → that day's Daily Run top 10, same shape and cache
    (the level is the day's `dailyLevel`); 400 unless the day is a real `YYYY-MM-DD` date.
  - `GET /api/leaderboard?daily=2026-11-23&ghost=1` → `{ ghost }`, the ghost of that day's best
    run that carries one (`src/combat/ghost.ts`' `1;stepMs;base64`), or `null`; same cache (#1042).
    The day's #1 posted by a build from before the ghost leaves the best run that has one.
  - `POST /api/leaderboard` `{ level, initials, score, seed, kills, accuracy, version }` →
    `{ rank, top }` (`rank` 1-10, or null off the board). Rejected with 400 unless the level
    is a campaign level, the initials are three letters A-Z and the score is possible for
    that level and kill count (`src/levels/scoreLimits.ts`); 429 after 5 accepted
    submissions from one IP in 10 minutes (keyed by an HMAC of the IP; no raw IP is stored).
    The handler counts the IP's recent rows first, which turns most repeats away but lets parallel
    POSTs through together; `0005_rate_limit.sql`'s `before insert` trigger counts again under a
    per-IP lock and raises `PT429`, which the handler answers with the same 429 (#384). Until that
    migration runs the count alone limits, as before.
    With `daily: 'YYYY-MM-DD'` the run goes on that day's board, and its rank counts that day
    only. Also 400 unless the day is today or yesterday on the server's clock (UTC; yesterday
    so a run started before midnight still counts) and the level is that day's `dailyLevel`
    (`api/_lib/daily.ts`, which mirrors `src/levels/daily.ts`; `daily.test.ts` checks they agree).
    A daily run may carry its `ghost` (the body may then be up to 12 KB; a campaign POST stays at
    2 KB and never stores one). `checkGhost` in `api/_lib/rules.ts` takes only what the game's
    `decodeGhost` reads (version 1, a step under 60 s, whole samples, at most 2400, 9608
    characters); any other ghost is dropped and the score stored without it.
  - No env vars, a paused project or any database error: `503 { "error": "unavailable" }`.
    So is every daily call until `0004_daily_board.sql` has run. The campaign board works
    without it: its `day is null` filter retries without the column (`api/_lib/scoresDb.ts`).
    Until `0006_daily_ghost.sql` has run, a daily POST's ghost is dropped (the insert retries
    without it on PostgREST's `PGRST204`) and `?ghost=1` answers `{ "ghost": null }`.
  - **Only 60 s runs are on the board** (#458). Runs were 75–120 s long before #452 (merged
    2026-11-09 in #473). Both the board and the `rank` count only rows with `score <=` the
    level's `maxScore` in `api/_lib/levelLimits.ts`. A long run over that limit stays in the table
    but drops off the board as soon as the new build deploys. An old run under it stays, because a
    60 s run can still beat it. Nothing has to be deleted.
- **Local board:** the same rule on each player's device. New entries are saved with
  `ruleset: '60s'`. On load, the persist `merge` (`sanitizeLeaderboards` in `src/store/leaderboard.ts`)
  drops an entry without that field when its score is over the level's limit. Saved
  stars, best scores and unlocks (`savedScores`), the initials and the Daily record are left as they are.
- **Game:** after a campaign run that places on the local board, the results screen sends it
  once (when the initials are confirmed, or as the screen closes) and shows the World board
  it gets back. A run that misses the local board just shows the World board. Calls time out
  after 3 s and fall back to the local board silently. Only the production build on Vercel
  calls the API: never dev, `vite preview`, CI, the smoke (`?e2e=1`, which stubs it) or the
  portal build (itch.io etc.). That is `isLiveSite` in `src/app/analyticsGate.ts`, the rule
  analytics and telemetry share. An internal browser (`?internal=1`, Alex's) still posts and
  reads the World board: the board is part of the game, not tracking, and his runs are real
  runs (#385). The rules are the pure `onlinePlan` in `src/app/onlineLeaderboard.ts`.
  After a Daily Run there is no initials entry. A new best of the day is sent at once,
  under the player's last initials (from their last campaign board entry, `AAA` before
  one). The results screen then shows the day's World board it gets back ("The world's top
  10 today"). Any other daily run just fetches that board. The new best goes up with its
  ghost, and every daily run fetches the day's ghost as it starts (`src/app/dailyGhost.ts`)
  and draws it as the ghost crosshair, if Settings' "Ghost of your best run" is on. On any failure the screen shows
  the local Daily record alone, as before.

## Setup (Alex, once)

1. **Supabase project** (dedicated, never Story Pitcher's), created with these settings so
   the setup can be reproduced:
   - region East US (N. Virginia);
   - Data API **on**;
   - "Automatically expose new tables" **off** (the migration grants what it needs);
   - automatic RLS **on** (the migration enables RLS on `scores` anyway).
2. **Table:** open the project's SQL editor, paste
   `supabase/migrations/0001_leaderboard.sql` and run it once, then
   `0004_daily_board.sql` (the Daily Run's board, #854), `0005_rate_limit.sql` (the
   rate limit's trigger, #384) and `0006_daily_ghost.sql` (the Daily Run's ghost, #1042) the same way.
3. **Vercel env vars** on the `shooter-coaster` project, environment **Production** only
   (names also in `.env.example`):
   - `SUPABASE_URL`: Project Settings → Data API → Project URL (`https://<ref>.supabase.co`);
   - `SUPABASE_SECRET_KEY`: Project Settings → API Keys → a **secret** key (`sb_secret_…`).
     Never the publishable/anon key, which RLS shuts out.
4. **Redeploy** production (env vars apply to new deployments): push to `main` or redeploy
   the latest deployment in Vercel.
5. **Check:** `https://scoaster.com/api/leaderboard?level=level1` should answer
   `{"top":[]}` (200), and so should `?daily=<today, YYYY-MM-DD>` once `0004` has run. A 503 means a variable is missing or wrong, or the table isn't there.
   The post-deploy health check (`npm run prod-check`) accepts either, and fails on a 500.

Rotating the secret key: create a new secret key in Supabase, update the Vercel env var,
redeploy, then delete the old key. The rate limit's IP hashes are keyed by the secret key, so
they reset; nothing else changes.

## When the free project pauses

Supabase pauses a free project after a week without traffic. The API then answers 503 and the
game shows each player's local board; nothing breaks. To bring it back:

1. Open the project in the Supabase dashboard and press **Restore project** (takes a few minutes).
2. Check `https://scoaster.com/api/leaderboard?level=level1` answers 200. No redeploy is
   needed; the data is kept.

## Moderation

Initials are three letters, so there is no free text to moderate. To remove a score, delete
its row in the Supabase table editor (or `delete from public.scores where id = …;` in the SQL
editor). The CDN serves the old top 10 for at most ~30 s more.

## Clearing the long runs for good (optional)

Nothing needs doing: the API already leaves them off the board. To delete every row from before
the 60 s rules anyway (which also removes old runs under the limit), run this once in the
Supabase SQL editor:

```sql
delete from public.scores where created_at < '2026-11-09T20:38:43Z';
```

## For agents

- Agents never create the project, keys or env vars, and never handle a secret (CLAUDE.md
  hard rule 4).
- Adding or rebalancing a level changes its score limits: run
  `node scripts/gen-level-limits.mjs` and commit `api/_lib/levelLimits.ts`
  (`api/_lib/levelLimits.test.ts` fails until you do). The same `maxScore` is the cut-off for both
  boards. If it goes down, World rows above the new limit drop off the board, and so do local
  entries from before the 60 s rules. Local `'60s'` entries always stay.
- A schema change is a new numbered file in `supabase/migrations/` plus a note in the PR for
  Alex to run it; the code must keep working (503 → local board) until he has.
