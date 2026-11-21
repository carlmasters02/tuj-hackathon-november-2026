-- Artwork comments (idea and UI by dasbristy997-ux, persisted + secured here).
-- Visible to anyone who can see the work; written only as yourself; deletable by the comment's
-- author or the work's owner.

create table public.comments (
  id bigint generated always as identity primary key,
  work_id uuid not null references public.gallery_works (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_work_idx on public.comments (work_id, created_at);
create index comments_author_idx on public.comments (author_id);
alter table public.comments enable row level security;

-- read: the work must be visible to you (published, or yours)
create policy "comments: readable where the work is" on public.comments for select using (
  exists (select 1 from public.gallery_works w
          where w.id = work_id and (w.published or w.owner_id = (select auth.uid())))
);
-- write: only as yourself, only on works you can see
create policy "comments: post as self on visible works" on public.comments for insert with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.gallery_works w
              where w.id = work_id and (w.published or w.owner_id = (select auth.uid())))
);
-- delete: the author, or the owner of the work (moderation)
create policy "comments: author or work owner deletes" on public.comments for delete using (
  author_id = (select auth.uid())
  or exists (select 1 from public.gallery_works w where w.id = work_id and w.owner_id = (select auth.uid()))
);
-- no update policy: comments can't be edited after posting

grant select, delete on public.comments to authenticated;
grant insert (work_id, author_id, body) on public.comments to authenticated;
grant all on public.comments to service_role;
grant usage, select on sequence public.comments_id_seq to service_role;
