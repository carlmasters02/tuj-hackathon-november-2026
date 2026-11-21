-- 1) OAuth (Google) sign-ups arrive without a username. Instead of rejecting them, generate a
--    temporary one from the email and make the user pick a real one once (/welcome).
-- 2) Rate limits shared by every serverless instance (Vercel runs many), stored in Postgres.

alter table public.profiles add column if not exists username_chosen boolean not null default true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  base text;
  candidate text;
  chosen boolean := true;
  tries int := 0;
begin
  if wanted ~ '^[a-z0-9_]{3,20}$' then
    candidate := wanted; -- uniqueness is enforced by the constraint (signup API checks first)
  else
    chosen := false;
    base := left(regexp_replace(lower(split_part(coalesce(new.email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g'), 14);
    if length(base) < 3 then base := 'user'; end if;
    candidate := base;
    while exists (select 1 from public.profiles p where p.username = candidate) loop
      candidate := base || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
      tries := tries + 1;
      exit when tries > 25;
    end loop;
  end if;

  insert into public.profiles (id, username, display_name, username_chosen)
  values (
    new.id,
    candidate,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', candidate), 50),
    chosen
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── shared token-bucket rate limiter ──────────────────────────────────────────
create table if not exists public.rate_limits (
  key text primary key,              -- sha256(rule | subject): no raw IPs or emails stored
  tokens double precision not null,
  updated_at timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
-- (no policies: only the service role can touch it)

-- Takes one token. Returns 0 when allowed, otherwise milliseconds until a token is available.
create or replace function public.hm_take_token(p_key text, p_capacity int, p_window_seconds double precision)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ts timestamptz := clock_timestamp();
  rate double precision := p_capacity / p_window_seconds; -- tokens per second
  cur record;
  avail double precision;
begin
  insert into public.rate_limits (key, tokens, updated_at) values (p_key, p_capacity, now_ts)
  on conflict (key) do nothing;
  select tokens, updated_at into cur from public.rate_limits where key = p_key for update;
  avail := least(p_capacity::double precision, cur.tokens + extract(epoch from (now_ts - cur.updated_at)) * rate);
  if avail >= 1 then
    update public.rate_limits set tokens = avail - 1, updated_at = now_ts where key = p_key;
    -- occasional cleanup of idle buckets (they'd be full anyway)
    if random() < 0.002 then
      delete from public.rate_limits where updated_at < now_ts - interval '1 day';
    end if;
    return 0;
  end if;
  update public.rate_limits set tokens = avail, updated_at = now_ts where key = p_key;
  return ceil((1 - avail) / rate * 1000)::int;
end;
$$;
revoke execute on function public.hm_take_token(text, int, double precision) from public, anon, authenticated;
grant execute on function public.hm_take_token(text, int, double precision) to service_role;
