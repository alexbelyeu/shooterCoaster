-- The rate limit as one database operation (#384): `RATE_LIMIT` (api/_lib/rules.ts) counted under a per-IP lock,
-- so parallel POSTs from one IP can't all pass the handler's count. Run once in the Supabase SQL editor (docs/LEADERBOARD.md).
create or replace function public.scores_rate_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.ip_hash, 0));
  if (select count(*) from public.scores where ip_hash = new.ip_hash and created_at >= now() - interval '10 minutes') >= 5 then
    raise exception 'too many submissions' using errcode = 'PT429';
  end if;
  return new;
end
$$;

drop trigger if exists scores_rate_limit on public.scores;
create trigger scores_rate_limit before insert on public.scores for each row execute function public.scores_rate_limit();
