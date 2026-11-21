-- Humagination — initial schema.
-- Principles: RLS on every table, deny by default. Tamper-sensitive tables (provenance batches,
-- certificates, points, tracker data, tutor/code progress) have NO insert/update/delete policies
-- for clients: only Next.js route handlers using the service-role key write them.

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 50),
  bio text check (char_length(bio) <= 280),
  is_public boolean not null default true,
  leaderboard_opt_in boolean not null default false,
  flagged_bulk boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: public or own are readable" on public.profiles
  for select using (is_public or id = (select auth.uid()));
create policy "profiles: owner updates" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- clients may only change these columns (username / flags are server-controlled)
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, is_public, leaderboard_opt_in) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if uname !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid username';
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, left(coalesce(new.raw_user_meta_data ->> 'display_name', uname), 50));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── social ─────────────────────────
create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);
alter table public.follows enable row level security;
create policy "follows: readable" on public.follows for select using (true);
create policy "follows: own insert" on public.follows for insert with check (follower_id = (select auth.uid()));
create policy "follows: own delete" on public.follows for delete using (follower_id = (select auth.uid()));

create table public.friends (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friends_friend_idx on public.friends (friend_id);
alter table public.friends enable row level security;
create policy "friends: parties read" on public.friends for select using ((select auth.uid()) in (user_id, friend_id));
create policy "friends: invite as self" on public.friends for insert with check (user_id = (select auth.uid()) and status = 'pending');
create policy "friends: invitee accepts" on public.friends for update using (friend_id = (select auth.uid())) with check (friend_id = (select auth.uid()) and status = 'accepted');
create policy "friends: either removes" on public.friends for delete using ((select auth.uid()) in (user_id, friend_id));

-- ───────────────────────── extension tokens ─────────────────────────
create table public.extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,      -- SHA-256(pepper || token); the token itself is never stored
  label text not null default 'Chrome extension' check (char_length(label) <= 40),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index extension_tokens_user_idx on public.extension_tokens (user_id);
alter table public.extension_tokens enable row level security;
create policy "extension_tokens: owner reads" on public.extension_tokens for select using (user_id = (select auth.uid()));
revoke select on public.extension_tokens from authenticated, anon;
grant select (id, user_id, label, created_at, last_used_at, revoked_at) on public.extension_tokens to authenticated;

-- ───────────────────────── tutor (math + code) ─────────────────────────
create table public.tutor_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id text not null,
  failed_attempts int not null default 0,
  hint_tier int not null default 1,      -- highest hint tier revealed
  hints_used int not null default 0,     -- tiers ≥2 revealed
  active_seconds int not null default 0,
  last_check_at timestamptz,
  solved_at timestamptz,
  primary key (user_id, problem_id)
);
alter table public.tutor_progress enable row level security;
create policy "tutor_progress: owner reads" on public.tutor_progress for select using (user_id = (select auth.uid()));

create table public.tutor_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id text not null,
  kind text not null default 'math' check (kind in ('math', 'code')),
  lines_or_code text not null check (char_length(lines_or_code) <= 20000),
  passed boolean not null,
  hints_used int not null default 0,
  active_seconds int not null default 0,
  created_at timestamptz not null default now()
);
create index tutor_attempts_user_idx on public.tutor_attempts (user_id, created_at desc);
alter table public.tutor_attempts enable row level security;
create policy "tutor_attempts: owner reads" on public.tutor_attempts for select using (user_id = (select auth.uid()));

create table public.code_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  lang text not null check (lang in ('python', 'c', 'java')),
  concept text not null,
  failed_submissions int not null default 0,
  hints_revealed int not null default 0,
  active_seconds int not null default 0,
  last_submit_at timestamptz,
  solved_at timestamptz,
  solution_enc text,                     -- the student's own passing code (AES-GCM), for Rosetta view
  primary key (user_id, exercise_id)
);
alter table public.code_progress enable row level security;
create policy "code_progress: owner reads" on public.code_progress for select using (user_id = (select auth.uid()));

create table public.code_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  lang text not null,
  source_hash text not null,
  passed boolean not null,
  tests_passed int not null,
  tests_total int not null,
  hints_used int not null default 0,
  active_seconds int not null default 0,
  created_at timestamptz not null default now()
);
create index code_attempts_user_idx on public.code_attempts (user_id, created_at desc);
alter table public.code_attempts enable row level security;
create policy "code_attempts: owner reads" on public.code_attempts for select using (user_id = (select auth.uid()));

-- ───────────────────────── tracker & points ─────────────────────────
create table public.tracker_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  domain text not null check (char_length(domain) <= 253),
  seconds int not null check (seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  primary key (user_id, date, domain)
);
alter table public.tracker_daily enable row level security;
create policy "tracker_daily: owner reads" on public.tracker_daily for select using (user_id = (select auth.uid()));

create table public.think_first_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  redirected int not null default 0 check (redirected >= 0),
  bypassed int not null default 0 check (bypassed >= 0),
  primary key (user_id, date)
);
alter table public.think_first_daily enable row level security;
create policy "think_first_daily: owner reads" on public.think_first_daily for select using (user_id = (select auth.uid()));

create table public.human_time_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  tutor_seconds int not null default 0,
  writing_seconds int not null default 0,
  primary key (user_id, date)
);
alter table public.human_time_daily enable row level security;
create policy "human_time_daily: owner reads" on public.human_time_daily for select using (user_id = (select auth.uid()));

create table public.points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('math', 'code', 'document', 'think_first')),
  ref text not null,                     -- what earned it (problem id, doc id, date) — unique per reason
  points int not null check (points >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
alter table public.points_ledger enable row level security;
create policy "points_ledger: owner reads" on public.points_ledger for select using (user_id = (select auth.uid()));

create table public.leaderboard_weekly (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  username text not null,
  reliance_score int not null,
  streak int not null,
  points int not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table public.leaderboard_weekly enable row level security;
create policy "leaderboard: opted-in rows are public" on public.leaderboard_weekly for select using (
  exists (select 1 from public.profiles p where p.id = user_id and p.leaderboard_opt_in)
  or user_id = (select auth.uid())
);

-- ───────────────────────── authentic editor ─────────────────────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title_enc text not null,               -- AES-256-GCM (app-level, HM_MASTER_KEY)
  content_enc text not null,             -- TipTap JSON, encrypted
  text_enc text not null,                -- plain-text projection the server has replayed so far, encrypted
  credited_seconds int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  first_session_id uuid,
  head_hash text,
  last_seq int not null default -1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_owner_idx on public.documents (owner_id, updated_at desc);
alter table public.documents enable row level security;
create policy "documents: owner reads" on public.documents for select using (owner_id = (select auth.uid()));

create table public.doc_event_batches (
  id bigint generated always as identity primary key,
  doc_id uuid not null references public.documents (id) on delete cascade,
  session_id uuid not null,
  seq_start int not null,
  seq_end int not null,
  events_json jsonb not null,
  head_hash text not null,
  received_at timestamptz not null default now(),
  unique (doc_id, seq_start)
);
alter table public.doc_event_batches enable row level security;
create policy "doc_event_batches: owner reads" on public.doc_event_batches for select using (
  exists (select 1 from public.documents d where d.id = doc_id and d.owner_id = (select auth.uid()))
);

create table public.certificates (
  id uuid primary key,
  doc_id uuid references public.documents (id) on delete set null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  verdict text not null check (verdict in ('human_verified', 'mostly_human', 'unverified')),
  payload jsonb not null,
  signature text not null,
  public_key text not null,
  events_json jsonb not null,            -- snapshot of the log, for the public replay player
  created_at timestamptz not null default now()
);
create index certificates_doc_idx on public.certificates (doc_id);
create index certificates_owner_idx on public.certificates (owner_id);
alter table public.certificates enable row level security;
create policy "certificates: public" on public.certificates for select using (true);

-- ───────────────────────── gallery ─────────────────────────
create table public.gallery_works (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('art', 'writing', 'music')),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  sha256 text,
  dhash text,
  storage_key_enc text,                  -- encrypted path of the encrypted original
  preview_key text,
  mime text,
  width int,
  height int,
  cert_id uuid references public.certificates (id) on delete cascade,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index gallery_works_owner_idx on public.gallery_works (owner_id);
create index gallery_works_cert_idx on public.gallery_works (cert_id);
create index gallery_works_published_idx on public.gallery_works (kind, created_at desc) where published;
create index gallery_works_dhash_idx on public.gallery_works (dhash);
alter table public.gallery_works enable row level security;
create policy "gallery_works: published or own" on public.gallery_works for select using (published or owner_id = (select auth.uid()));

create table public.likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  work_id uuid not null references public.gallery_works (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id)
);
create index likes_work_idx on public.likes (work_id);
alter table public.likes enable row level security;
create policy "likes: readable" on public.likes for select using (true);
create policy "likes: own insert" on public.likes for insert with check (user_id = (select auth.uid()));
create policy "likes: own delete" on public.likes for delete using (user_id = (select auth.uid()));

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  work_id uuid not null references public.gallery_works (id) on delete cascade,
  reason text not null check (reason in ('stolen', 'ai_generated', 'offensive', 'spam', 'other')),
  details text check (char_length(details) <= 1000),
  created_at timestamptz not null default now()
);
create index reports_work_idx on public.reports (work_id);
create index reports_reporter_idx on public.reports (reporter_id);
alter table public.reports enable row level security;
create policy "reports: own insert" on public.reports for insert with check (reporter_id = (select auth.uid()));
create policy "reports: own read" on public.reports for select using (reporter_id = (select auth.uid()));

-- ───────────────────────── server-only bookkeeping ─────────────────────────
create table public.login_attempts (
  key text primary key,                  -- sha256(lowercased email)
  failures int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.login_attempts enable row level security;
-- (no policies: service role only)

-- ───────────────────────── storage (private buckets only) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('art-originals', 'art-originals', false, 20971520),
  ('art-previews', 'art-previews', false, 20971520),
  ('audio', 'audio', false, 31457280),
  ('audio-previews', 'audio-previews', false, 31457280)
on conflict (id) do update set public = false;
-- No storage.objects policies are created: only the service role can read or write these buckets.
