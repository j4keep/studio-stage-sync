-- YAJ Radio Stations: creator-owned stations/networks, schedules and music programming.
create table if not exists public.radio_stations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  tagline text,
  description text,
  genre text,
  logo_url text,
  banner_url text,
  network_name text,
  programming_mode text not null default 'mixed'
    check (programming_mode in ('live','music','podcast','mixed')),
  is_public boolean not null default true,
  is_live boolean not null default false,
  live_title text,
  live_started_at timestamptz,
  live_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists radio_stations_owner_idx on public.radio_stations(owner_user_id);
create index if not exists radio_stations_live_idx on public.radio_stations(is_live, is_public);

create table if not exists public.radio_station_shows (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.radio_stations(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  show_type text not null default 'talk'
    check (show_type in ('talk','podcast','music','interview','mix')),
  scheduled_at timestamptz,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 720),
  recurring_label text,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','ended','cancelled')),
  live_session_id text,
  created_at timestamptz not null default now()
);

create index if not exists radio_station_shows_station_idx
  on public.radio_station_shows(station_id, scheduled_at);

create table if not exists public.radio_station_programming (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.radio_stations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('song','podcast')),
  source_id uuid not null,
  position integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(station_id, source_type, source_id)
);

alter table public.radio_stations enable row level security;
alter table public.radio_station_shows enable row level security;
alter table public.radio_station_programming enable row level security;

drop policy if exists "Public radio stations are readable" on public.radio_stations;
create policy "Public radio stations are readable"
on public.radio_stations for select
using (is_public or owner_user_id = auth.uid());

drop policy if exists "Owners manage radio stations" on public.radio_stations;
create policy "Owners manage radio stations"
on public.radio_stations for all
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "Public station shows are readable" on public.radio_station_shows;
create policy "Public station shows are readable"
on public.radio_station_shows for select
using (
  exists (
    select 1 from public.radio_stations s
    where s.id = station_id and (s.is_public or s.owner_user_id = auth.uid())
  )
);

drop policy if exists "Station owners manage shows" on public.radio_station_shows;
create policy "Station owners manage shows"
on public.radio_station_shows for all
using (
  exists (
    select 1 from public.radio_stations s
    where s.id = station_id and s.owner_user_id = auth.uid()
  )
)
with check (
  host_user_id = auth.uid()
  and exists (
    select 1 from public.radio_stations s
    where s.id = station_id and s.owner_user_id = auth.uid()
  )
);

drop policy if exists "Station programming readable" on public.radio_station_programming;
create policy "Station programming readable"
on public.radio_station_programming for select
using (
  exists (
    select 1 from public.radio_stations s
    where s.id = station_id and (s.is_public or s.owner_user_id = auth.uid())
  )
);

drop policy if exists "Owners manage station programming" on public.radio_station_programming;
create policy "Owners manage station programming"
on public.radio_station_programming for all
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.radio_stations s
    where s.id = station_id and s.owner_user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
