create table if not exists public.creator_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text not null,
  audience text not null check (audience in ('regular','kids')),
  category text not null,
  listing_type text not null check (listing_type in ('free','donation','sale')),
  price numeric(10,2),
  blurb text not null default '',
  cover_url text,
  cover_key text,
  pages jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_books_status_created_idx
  on public.creator_books(status, created_at desc);
create index if not exists creator_books_user_idx
  on public.creator_books(user_id, created_at desc);
create index if not exists creator_books_category_idx
  on public.creator_books(category, created_at desc);

grant select, insert, update, delete on public.creator_books to authenticated;
grant all on public.creator_books to service_role;

alter table public.creator_books enable row level security;

drop policy if exists "creator books readable when published" on public.creator_books;
create policy "creator books readable when published"
on public.creator_books for select
to authenticated
using (status = 'published' or user_id = auth.uid());

drop policy if exists "creator books insert own" on public.creator_books;
create policy "creator books insert own"
on public.creator_books for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "creator books update own" on public.creator_books;
create policy "creator books update own"
on public.creator_books for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "creator books delete own" on public.creator_books;
create policy "creator books delete own"
on public.creator_books for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.set_creator_books_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_books_updated_at on public.creator_books;
create trigger creator_books_updated_at
before update on public.creator_books
for each row execute function public.set_creator_books_updated_at();