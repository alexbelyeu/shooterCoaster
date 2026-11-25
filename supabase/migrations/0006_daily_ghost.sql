-- The Daily Run ghost (#1042): a daily run's aim and shots, `src/combat/ghost.ts`' `1;stepMs;base64` (9608 characters
-- at most, `api/_lib/rules.ts` checkGhost); null on campaign rows and on daily rows posted without one.
-- Run once in the Supabase SQL editor (docs/LEADERBOARD.md). Until it runs, daily scores post without their ghost
-- and `GET /api/leaderboard?daily=<day>&ghost=1` answers no ghost.
alter table public.scores add column if not exists ghost text;
alter table public.scores drop constraint if exists scores_ghost_length;
alter table public.scores add constraint scores_ghost_length check (ghost is null or length(ghost) <= 12000);
