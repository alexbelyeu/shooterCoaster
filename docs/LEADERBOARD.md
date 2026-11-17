# Online leaderboard

The campaign's top 10 per level, shared by everyone who plays on scoaster.com (#365). The
game runs fine without it: until it is set up, and whenever it is down, the results screen
shows this device's board as before.

## How it fits together

- **Database:** a dedicated Supabase project on Alex's free plan, one table `scores`
  (`supabase/migrations/0001_leaderboard.sql`). RLS is on with no policies, and only
  `service_role` has grants, so the publishable/anon key can do nothing with it.
- **API:** `api/leaderboard.ts`, a Vercel Function in this repo, is the only thing that
  talks to Supabase, with the server-side secret key from the Vercel env vars.
  - `GET /api/leaderboard?level=level1` → `{ top: [{ initials, score, at }] }`, cached by
    Vercel's CDN for 30 s (`s-maxage=30, stale-while-revalidate=300`).
  - `POST /api/leaderboard` `{ level, initials, score, seed, kills, accuracy, version }` →
    `{ rank, top }` (`rank` 1-10, or null off the board). Rejected with 400 unless the level
    is a campaign level, the initials are three letters A-Z and the score is possible for
    that level and kill count (`src/levels/scoreLimits.ts`); 429 after 5 accepted
    submissions from one IP in 10 minutes (keyed by an HMAC of the IP; no raw IP is stored).
  - No env vars, a paused project or any database error: `503 { "error": "unavailable" }`.
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
  portal build (itch.io etc.). The Daily Run has no online board yet.

## Setup (Alex, once)

1. **Supabase project** (dedicated, never Story Pitcher's), created with these settings so
   the setup can be reproduced:
   - region East US (N. Virginia);
   - Data API **on**;
   - "Automatically expose new tables" **off** (the migration grants what it needs);
   - automatic RLS **on** (the migration enables RLS on `scores` anyway).
2. **Table:** open the project's SQL editor, paste
   `supabase/migrations/0001_leaderboard.sql` and run it once.
3. **Vercel env vars** on the `shooter-coaster` project, environment **Production** only
   (names also in `.env.example`):
   - `SUPABASE_URL`: Project Settings → Data API → Project URL (`https://<ref>.supabase.co`);
   - `SUPABASE_SECRET_KEY`: Project Settings → API Keys → a **secret** key (`sb_secret_…`).
     Never the publishable/anon key, which RLS shuts out.
4. **Redeploy** production (env vars apply to new deployments): push to `main` or redeploy
   the latest deployment in Vercel.
5. **Check:** `https://scoaster.com/api/leaderboard?level=level1` should answer
   `{"top":[]}` (200). A 503 means a variable is missing or wrong, or the table isn't there.
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
