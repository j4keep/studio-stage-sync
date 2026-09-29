-- YAJ Radio live-state heartbeat and stale-broadcast cleanup.
-- Keeps public station cards truthful even when a host closes the app/tab before
-- the normal room cleanup request finishes.

alter table public.radio_stations
  add column if not exists live_heartbeat_at timestamptz;

create index if not exists radio_stations_live_heartbeat_idx
  on public.radio_stations (is_live, live_heartbeat_at);

create or replace function public.cleanup_stale_radio_broadcasts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned integer := 0;
begin
  with stale as (
    select id, live_session_id
    from public.radio_stations
    where is_live = true
      and (
        coalesce(live_heartbeat_at, live_started_at) is null
        or coalesce(live_heartbeat_at, live_started_at) < now() - interval '20 seconds'
      )
  ),
  ended_shows as (
    update public.radio_station_shows shows
    set status = 'ended'
    from stale
    where shows.station_id = stale.id
      and shows.live_session_id = stale.live_session_id
      and shows.status = 'live'
    returning shows.id
  ),
  cleared as (
    update public.radio_stations stations
    set
      is_live = false,
      live_title = null,
      live_started_at = null,
      live_heartbeat_at = null,
      live_session_id = null,
      updated_at = now()
    from stale
    where stations.id = stale.id
    returning stations.id
  )
  select count(*)::integer into cleaned from cleared;

  return cleaned;
end;
$$;

revoke all on function public.cleanup_stale_radio_broadcasts() from public;
grant execute on function public.cleanup_stale_radio_broadcasts() to authenticated;

notify pgrst, 'reload schema';
