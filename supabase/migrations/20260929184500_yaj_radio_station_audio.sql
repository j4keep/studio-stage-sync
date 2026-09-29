-- Station-owned audio for YAJ Radio music stations.
-- These uploads are intentionally separate from the shared YAJ Radio songs pool.
create table if not exists public.radio_station_audio (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.radio_stations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  audio_url text not null,
  position integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists radio_station_audio_station_position_idx
  on public.radio_station_audio(station_id, position, created_at);

alter table public.radio_station_audio enable row level security;

drop policy if exists "Station audio is readable" on public.radio_station_audio;
create policy "Station audio is readable"
on public.radio_station_audio for select
using (
  exists (
    select 1
    from public.radio_stations s
    where s.id = station_id
      and (s.is_public or s.owner_user_id = auth.uid())
  )
);

drop policy if exists "Owners manage station audio" on public.radio_station_audio;
create policy "Owners manage station audio"
on public.radio_station_audio for all
using (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.radio_stations s
    where s.id = station_id
      and s.owner_user_id = auth.uid()
  )
)
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.radio_stations s
    where s.id = station_id
      and s.owner_user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
