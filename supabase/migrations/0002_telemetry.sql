-- ShooterCoaster real-player telemetry (#373). Run once in the Supabase SQL editor (docs/TELEMETRY.md).
-- One row per page load that played a level or hit an error. Only the server-side secret key (service_role)
-- reads, writes or prunes it, through api/telemetry.ts. No ids, no IPs: `ip_hash` is an HMAC of the IP under a
-- salt that changes every UTC day, used only for the rate limit.

create table if not exists public.telemetry_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  client_version text not null check (char_length(client_version) <= 40),
  touch boolean not null,
  cores smallint check (cores between 1 and 256),
  gpu text check (char_length(gpu) <= 120),
  context_lost smallint not null default 0 check (context_lost between 0 and 100),
  errors jsonb not null default '[]' check (jsonb_typeof(errors) = 'array'),
  levels jsonb not null default '[]' check (jsonb_typeof(levels) = 'array'),
  ip_hash text not null
);

-- The 24-hour summary and the 30-day prune.
create index if not exists telemetry_reports_created_idx on public.telemetry_reports (created_at);
-- The rate limit: one IP's reports in the last 10 minutes.
create index if not exists telemetry_reports_ip_recent_idx on public.telemetry_reports (ip_hash, created_at);

-- RLS on with no policies: anon and authenticated get nothing; service_role bypasses RLS.
alter table public.telemetry_reports enable row level security;

revoke all on public.telemetry_reports from anon, authenticated;
grant select, insert, delete on public.telemetry_reports to service_role;
grant usage, select on sequence public.telemetry_reports_id_seq to service_role;
