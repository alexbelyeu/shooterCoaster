## 2026-11-06 — Online leaderboard: Supabase behind Vercel Functions (Builder, #365)

**Context:** Alex decided on 4 Nov 2026 (#365) to add an online leaderboard. This supersedes the
2026-10-19 decision "No online backend until Alex decides". He owns the account side: a dedicated
Supabase project on his free plan, its env vars in Vercel, and running the migration.

**Decision:**
- The browser only ever calls same-origin `/api/leaderboard`; `api/leaderboard.ts` (Vercel Function,
  Node runtime) is the only code with the Supabase secret key. It talks to PostgREST with plain fetch,
  no supabase-js. `check:bundle` fails if Supabase's URL, key names or REST path reach the browser.
- Only the production build calls it (`__BUILT_ON_VERCEL__`, not `?e2e=1`); dev, preview, CI, the
  smoke (stubbed with `page.route`) and the portal build never do. Every failure (no env vars, a
  paused project, timeout after 3 s) falls back silently to the local board; the API answers 503,
  never a 500 or details.
- Score ceiling = every kill at the top 5× combo multiplier, golden balloons included
  (`src/levels/scoreLimits.ts`), not the level's `maxScore`: `maxScore` is the no-combo score, so real
  runs pass it. api/ can't import `src/` at runtime (Vercel builds functions without the `@/` alias),
  so `scripts/gen-level-limits.mjs` generates `api/_lib/levelLimits.ts` and a unit test fails when it
  is stale.
- Rate limit (5 accepted POSTs per IP per 10 min) is a count over the `scores` table by `ip_hash`, an
  HMAC-SHA256 of the IP keyed by the secret key: no extra table, no raw IP stored.
- Only runs that place on the local board go online, once, after initials entry (or as the results
  screen closes). A run that misses the local board fetches and shows the World board.

**Consequences:** The game has one backend dependency, optional by design. New levels or score
changes need `node scripts/gen-level-limits.mjs`. Schema changes need Alex to run SQL by hand.
Scores are only plausibility-checked (no replay validation): a determined cheater can still post a
high but possible score; Alex can delete rows (docs/LEADERBOARD.md).
