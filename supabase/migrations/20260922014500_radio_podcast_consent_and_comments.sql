-- YAJ Radio: explicit podcast consent + persistent timestamped comments.

alter table public.podcasts
  add column if not exists on_radio boolean not null default false;

create index if not exists podcasts_on_radio_created_idx
  on public.podcasts (on_radio, created_at desc)
  where is_video = false;

create table if not exists public.radio_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_type text not null check (track_type in ('song','podcast')),
  track_id uuid not null,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  playback_seconds integer not null default 0 check (playback_seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists radio_comments_track_idx
  on public.radio_comments (track_type, track_id, created_at);

alter table public.radio_comments enable row level security;

drop policy if exists "radio comments public read" on public.radio_comments;
create policy "radio comments public read"
on public.radio_comments for select
using (true);

drop policy if exists "radio comments authenticated insert" on public.radio_comments;
create policy "radio comments authenticated insert"
on public.radio_comments for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "radio comments owner delete" on public.radio_comments;
create policy "radio comments owner delete"
on public.radio_comments for delete to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

grant select on public.radio_comments to anon, authenticated;
grant insert, delete on public.radio_comments to authenticated;

notify pgrst, 'reload schema';
