-- Atomic counters used by route handlers. SECURITY DEFINER + execute revoked from client roles:
-- only the service role (server) can call them.

create or replace function public.hm_add_human_time(p_user uuid, p_date date, p_tutor int, p_writing int)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.human_time_daily (user_id, date, tutor_seconds, writing_seconds)
  values (p_user, p_date, greatest(p_tutor, 0), greatest(p_writing, 0))
  on conflict (user_id, date) do update
    set tutor_seconds = public.human_time_daily.tutor_seconds + greatest(excluded.tutor_seconds, 0),
        writing_seconds = public.human_time_daily.writing_seconds + greatest(excluded.writing_seconds, 0);
$$;

create or replace function public.hm_add_think_first(p_user uuid, p_date date, p_redirected int, p_bypassed int)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.think_first_daily (user_id, date, redirected, bypassed)
  values (p_user, p_date, greatest(p_redirected, 0), greatest(p_bypassed, 0))
  on conflict (user_id, date) do update
    set redirected = greatest(public.think_first_daily.redirected, excluded.redirected),
        bypassed = greatest(public.think_first_daily.bypassed, excluded.bypassed);
$$;

revoke execute on function public.hm_add_human_time(uuid, date, int, int) from public, anon, authenticated;
revoke execute on function public.hm_add_think_first(uuid, date, int, int) from public, anon, authenticated;
grant execute on function public.hm_add_human_time(uuid, date, int, int) to service_role;
grant execute on function public.hm_add_think_first(uuid, date, int, int) to service_role;
