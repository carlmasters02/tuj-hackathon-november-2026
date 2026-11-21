-- Supabase's "Enable RLS on new tables automatically" option installs public.rls_auto_enable()
-- (SECURITY DEFINER, used by an event trigger). It doesn't need to be callable through the Data
-- API, so remove EXECUTE from API roles; the event trigger still fires (triggers don't check
-- EXECUTE at fire time). Guarded so this migration also works on projects without the option.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
