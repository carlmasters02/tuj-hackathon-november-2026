-- Server-only account status lookup, used to explain login/signup failures precisely
-- (only when HM_DETAILED_AUTH_ERRORS=true). Callable by the service role only.
create or replace function public.hm_auth_status(p_email text)
returns table (account_exists boolean, email_confirmed boolean, has_password boolean, providers text[], banned boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    true,
    u.email_confirmed_at is not null,
    coalesce(u.encrypted_password, '') <> '',
    coalesce(array(select jsonb_array_elements_text(u.raw_app_meta_data -> 'providers')), array[]::text[]),
    u.banned_until is not null and u.banned_until > now()
  from auth.users u
  where lower(u.email) = lower(p_email) and u.deleted_at is null
  limit 1
$$;
revoke execute on function public.hm_auth_status(text) from public, anon, authenticated;
grant execute on function public.hm_auth_status(text) to service_role;
