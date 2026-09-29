alter table public.radio_stations
  add column if not exists call_in_enabled boolean not null default false;

comment on column public.radio_stations.call_in_enabled is
  'Whether listeners may request an audio-only call-in during the current YAJ Radio live session.';
