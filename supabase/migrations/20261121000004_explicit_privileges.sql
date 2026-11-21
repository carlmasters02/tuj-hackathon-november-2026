-- Explicit, least-privilege table grants for the Data API roles.
--
-- The project is created with "Grant API access to new tables automatically" OFF, so `anon` and
-- `authenticated` start with no table privileges. This migration is the single source of truth for
-- what each role may do; Row Level Security then decides *which rows*. It first revokes everything,
-- so it is also correct on projects where automatic grants were left ON.
--
--   service_role  → full access (server-side route handlers only; bypasses RLS)
--   anon          → read public data only (profiles, social counts, certificates, published works,
--                   opted-in leaderboard)
--   authenticated → read own data; write only where an RLS policy allows it (likes, follows,
--                   friends, reports, a few profile columns). Tamper-sensitive tables are read-only.
-- Server-only bookkeeping (login_attempts, rate_limits) gets nothing.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- profiles: public columns only (flagged_bulk stays private); owners may edit four columns
grant select (id, username, display_name, bio, is_public, leaderboard_opt_in, username_chosen, created_at) on public.profiles to anon, authenticated;
grant update (display_name, bio, is_public, leaderboard_opt_in) on public.profiles to authenticated;

-- social
grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
grant select, insert, delete on public.friends to authenticated;
grant update (status) on public.friends to authenticated;
grant select on public.likes to anon, authenticated;
grant insert, delete on public.likes to authenticated;
grant select, insert on public.reports to authenticated;

-- own data, read-only for clients (writes happen in route handlers via service_role)
grant select (id, user_id, label, created_at, last_used_at, revoked_at) on public.extension_tokens to authenticated;
grant select on public.tutor_progress, public.tutor_attempts, public.code_progress, public.code_attempts to authenticated;
grant select on public.tracker_daily, public.think_first_daily, public.human_time_daily, public.points_ledger to authenticated;
grant select on public.documents, public.doc_event_batches to authenticated;

-- public artefacts
grant select on public.certificates to anon, authenticated;
grant select on public.leaderboard_weekly to anon, authenticated;
-- gallery: metadata only; storage paths and hashes stay server-side
grant select (id, owner_id, kind, title, description, mime, width, height, cert_id, published, created_at) on public.gallery_works to anon, authenticated;

-- server-only bookkeeping: login_attempts, rate_limits → no grants at all

-- Future tables start closed even if someone re-enables automatic grants.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
