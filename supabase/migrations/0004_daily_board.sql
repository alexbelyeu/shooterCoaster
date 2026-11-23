-- The Daily Run's World board (#854): a daily run's UTC day (`dailyKey`, YYYY-MM-DD); null on every campaign row.
-- Run once in the Supabase SQL editor (docs/LEADERBOARD.md). Until it runs, /api/leaderboard answers daily calls
-- with 503 and the campaign board works as before.
alter table public.scores add column if not exists day date;
create index if not exists scores_day_level_score_idx on public.scores (day, level_id, score desc, created_at) where day is not null;
