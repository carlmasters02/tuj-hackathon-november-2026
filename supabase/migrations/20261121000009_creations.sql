-- Drawing studio (art) and composer (music) drafts and their hash-chained event logs.
-- Owners can read their own; all writes go through route handlers with the service role.
create table public.creations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('art', 'music')),
  title text not null default 'Untitled' check (char_length(title) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  first_session_id uuid,
  head_hash text,
  last_seq int not null default -1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creations_owner_idx on public.creations (owner_id, kind, updated_at desc);
alter table public.creations enable row level security;
create policy "creations: owner reads" on public.creations for select using (owner_id = (select auth.uid()));

create table public.creation_event_batches (
  id bigint generated always as identity primary key,
  creation_id uuid not null references public.creations (id) on delete cascade,
  session_id uuid not null,
  seq_start int not null,
  seq_end int not null,
  events_json jsonb not null,
  head_hash text not null,
  received_at timestamptz not null default now(),
  unique (creation_id, seq_start)
);
alter table public.creation_event_batches enable row level security;
create policy "creation_event_batches: owner reads" on public.creation_event_batches for select using (
  exists (select 1 from public.creations c where c.id = creation_id and c.owner_id = (select auth.uid()))
);

grant select on public.creations, public.creation_event_batches to authenticated;
grant all on public.creations, public.creation_event_batches to service_role;
grant usage, select on sequence public.creation_event_batches_id_seq to service_role;
