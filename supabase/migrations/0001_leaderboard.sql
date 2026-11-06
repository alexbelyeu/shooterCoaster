-- ShooterCoaster online leaderboard (#365). Run once in the Supabase SQL editor (docs/LEADERBOARD.md).
-- Only the server-side secret key (service_role) reads or writes, through api/leaderboard.ts.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  level_id text not null check (char_length(level_id) <= 32),
  initials char(3) not null check (initials ~ '^[A-Z]{3}$'),
  score int not null check (score > 0),
  run_seed bigint not null check (run_seed >= 0),
  kills int not null check (kills >= 0),
  accuracy real not null check (accuracy >= 0 and accuracy <= 1),
  client_version text not null check (char_length(client_version) <= 40),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

-- The top 10 per level, and the rank count.
create index if not exists scores_level_score_idx on public.scores (level_id, score desc, created_at);
-- The rate limit: one IP's submissions in the last 10 minutes.
create index if not exists scores_ip_recent_idx on public.scores (ip_hash, created_at);

-- RLS on with no policies: anon and authenticated get nothing; service_role bypasses RLS.
alter table public.scores enable row level security;

-- The project doesn't expose new tables automatically, so grant the secret key's role explicitly, and nobody else.
revoke all on public.scores from anon, authenticated;
grant select, insert on public.scores to service_role;
grant usage, select on sequence public.scores_id_seq to service_role;
