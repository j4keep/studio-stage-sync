-- Persist Circle Home posts in Supabase so every approved member/device sees the same posts.
-- Older app builds could silently fall back to localStorage because circle_contents was not present.

create extension if not exists pgcrypto;

create table if not exists public.circle_contents (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  author_id uuid not null,
  kind text not null default 'post',
  activity_type text not null default 'photo',
  title text,
  body text,
  media_urls text[] not null default '{}',
  media_type text not null default 'none',
  visibility text not null default 'circle_members',
  donations_enabled boolean not null default true,
  like_count integer not null default 0,
  view_count integer not null default 0,
  comment_count integer not null default 0,
  event_at timestamptz,
  event_end_at timestamptz,
  event_location text,
  event_online_url text,
  event_capacity integer,
  event_ticket_cents integer,
  event_reminders boolean not null default false,
  community_subtype text,
  poll_options text[] not null default '{}',
  tags text[] not null default '{}',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.circle_contents add column if not exists activity_type text not null default 'photo';
alter table public.circle_contents add column if not exists media_urls text[] not null default '{}';
alter table public.circle_contents add column if not exists media_type text not null default 'none';
alter table public.circle_contents add column if not exists visibility text not null default 'circle_members';
alter table public.circle_contents add column if not exists donations_enabled boolean not null default true;
alter table public.circle_contents add column if not exists like_count integer not null default 0;
alter table public.circle_contents add column if not exists view_count integer not null default 0;
alter table public.circle_contents add column if not exists comment_count integer not null default 0;
alter table public.circle_contents add column if not exists event_at timestamptz;
alter table public.circle_contents add column if not exists event_end_at timestamptz;
alter table public.circle_contents add column if not exists event_location text;
alter table public.circle_contents add column if not exists event_online_url text;
alter table public.circle_contents add column if not exists event_capacity integer;
alter table public.circle_contents add column if not exists event_ticket_cents integer;
alter table public.circle_contents add column if not exists event_reminders boolean not null default false;
alter table public.circle_contents add column if not exists community_subtype text;
alter table public.circle_contents add column if not exists poll_options text[] not null default '{}';
alter table public.circle_contents add column if not exists tags text[] not null default '{}';
alter table public.circle_contents add column if not exists is_pinned boolean not null default false;
alter table public.circle_contents add column if not exists updated_at timestamptz not null default now();

create index if not exists circle_contents_circle_created_idx
  on public.circle_contents(circle_id, created_at desc);
create index if not exists circle_contents_author_idx
  on public.circle_contents(author_id);

alter table public.circle_contents enable row level security;

drop policy if exists "circle contents read" on public.circle_contents;
create policy "circle contents read"
on public.circle_contents
for select
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1
    from public.circles c
    where c.id = circle_contents.circle_id
      and (
        c.owner_id = auth.uid()
        or c.is_private = false
        or exists (
          select 1
          from public.circle_members cm
          where cm.circle_id = c.id
            and cm.user_id = auth.uid()
            and cm.status = 'approved'
        )
      )
  )
);

drop policy if exists "circle contents insert" on public.circle_contents;
create policy "circle contents insert"
on public.circle_contents
for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.circles c
    where c.id = circle_contents.circle_id
      and (
        c.owner_id = auth.uid()
        or (
          c.member_posting_allowed = true
          and exists (
            select 1
            from public.circle_members cm
            where cm.circle_id = c.id
              and cm.user_id = auth.uid()
              and cm.status = 'approved'
          )
        )
      )
  )
);

drop policy if exists "circle contents update" on public.circle_contents;
create policy "circle contents update"
on public.circle_contents
for update
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.circles c
    where c.id = circle_contents.circle_id and c.owner_id = auth.uid()
  )
)
with check (
  author_id = auth.uid()
  or exists (
    select 1 from public.circles c
    where c.id = circle_contents.circle_id and c.owner_id = auth.uid()
  )
);

drop policy if exists "circle contents delete" on public.circle_contents;
create policy "circle contents delete"
on public.circle_contents
for delete
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.circles c
    where c.id = circle_contents.circle_id and c.owner_id = auth.uid()
  )
);

-- Approved members should see the same regular Circle Home posts regardless of device.
create or replace function public.yaj_circle_home_contents(p_circle_id uuid)
returns setof public.circle_contents
language sql
security definer
set search_path = public
stable
as $$
  select cc.*
  from public.circle_contents cc
  join public.circles c on c.id = cc.circle_id
  where cc.circle_id = p_circle_id
    and coalesce(cc.activity_type, 'photo') <> 'exclusive'
    and (
      c.owner_id = auth.uid()
      or c.is_private = false
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
      )
    )
    and (
      cc.visibility <> 'only_me'
      or cc.author_id = auth.uid()
    )
    and (
      cc.visibility <> 'paid_members'
      or c.owner_id = auth.uid()
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
          and cm.role in ('paid_member', 'admin', 'owner')
      )
    )
  order by cc.is_pinned desc, cc.created_at desc;
$$;

grant execute on function public.yaj_circle_home_contents(uuid) to authenticated;

create or replace function public.yaj_my_circle_home_contents()
returns setof public.circle_contents
language sql
security definer
set search_path = public
stable
as $$
  select cc.*
  from public.circle_contents cc
  join public.circles c on c.id = cc.circle_id
  where coalesce(cc.activity_type, 'photo') <> 'exclusive'
    and (
      c.owner_id = auth.uid()
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
      )
    )
    and (
      cc.visibility <> 'only_me'
      or cc.author_id = auth.uid()
    )
    and (
      cc.visibility <> 'paid_members'
      or c.owner_id = auth.uid()
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = c.id
          and cm.user_id = auth.uid()
          and cm.status = 'approved'
          and cm.role in ('paid_member', 'admin', 'owner')
      )
    )
  order by cc.created_at desc
  limit 150;
$$;

grant execute on function public.yaj_my_circle_home_contents() to authenticated;
