-- Add per-track trim metadata to YAJ Radio station playlists.
-- This runs after the station-audio table migration.
alter table public.radio_station_audio
  add column if not exists trim_start_seconds numeric not null default 0,
  add column if not exists trim_end_seconds numeric;

alter table public.radio_station_audio
  drop constraint if exists radio_station_audio_trim_start_nonnegative;
alter table public.radio_station_audio
  add constraint radio_station_audio_trim_start_nonnegative
  check (trim_start_seconds >= 0);

alter table public.radio_station_audio
  drop constraint if exists radio_station_audio_trim_end_valid;
alter table public.radio_station_audio
  add constraint radio_station_audio_trim_end_valid
  check (trim_end_seconds is null or trim_end_seconds > trim_start_seconds);

notify pgrst, 'reload schema';
