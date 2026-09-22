-- YAJ Books library, creator management, and operator content moderation.

-- Reader library: supports manual saves now and real purchases later.
create table if not exists public.book_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  acquisition text not null default 'saved' check (acquisition in ('saved','purchased')),
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.book_library enable row level security;

drop policy if exists "book library self read" on public.book_library;
create policy "book library self read"
on public.book_library for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "book library self insert saved" on public.book_library;
create policy "book library self insert saved"
on public.book_library for insert to authenticated
with check (auth.uid() = user_id and acquisition = 'saved');

drop policy if exists "book library self delete saved" on public.book_library;
create policy "book library self delete saved"
on public.book_library for delete to authenticated
using (auth.uid() = user_id and acquisition = 'saved');

create index if not exists book_library_book_idx on public.book_library(book_id);
create index if not exists book_library_user_created_idx on public.book_library(user_id, created_at desc);

-- Admins can inspect all creator books, including drafts/archived rows, and remove policy-violating books.
drop policy if exists "creator books admin read" on public.creator_books;
create policy "creator books admin read"
on public.creator_books for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "creator books admin delete" on public.creator_books;
create policy "creator books admin delete"
on public.creator_books for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- YAJ.TV creator rows already have creator ownership policies.
-- Add operator removal/read authority so Trust & Safety can act on reported TV content.
drop policy if exists "tv posts admin read" on public.tv_posts;
create policy "tv posts admin read"
on public.tv_posts for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "tv posts admin delete" on public.tv_posts;
create policy "tv posts admin delete"
on public.tv_posts for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Audit trail for operator removals.
create table if not exists public.admin_content_removals (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  content_type text not null check (content_type in ('book','tv')),
  content_id text not null,
  creator_user_id uuid,
  title text,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_content_removals enable row level security;

drop policy if exists "admins read content removals" on public.admin_content_removals;
create policy "admins read content removals"
on public.admin_content_removals for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins insert content removals" on public.admin_content_removals;
create policy "admins insert content removals"
on public.admin_content_removals for insert to authenticated
with check (public.has_role(auth.uid(), 'admin') and admin_user_id = auth.uid());

notify pgrst, 'reload schema';