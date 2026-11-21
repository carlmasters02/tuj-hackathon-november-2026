-- Writing genres for the tutor (research papers, argumentative essays, poetry) and certificate
-- kinds so art (drawing studio) and music (composer) can carry provenance certificates too.
alter table public.documents add column if not exists genre text not null default 'free'
  check (genre in ('free', 'research-paper', 'argumentative', 'poetry'));
alter table public.certificates add column if not exists kind text not null default 'writing'
  check (kind in ('writing', 'art', 'music'));
create index if not exists documents_owner_genre_idx on public.documents (owner_id, genre, updated_at desc);
-- the new columns are covered by the existing table-level SELECT grants
