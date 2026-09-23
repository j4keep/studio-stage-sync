-- Keep all Drive racers on the same championship course and only complete after course 5.

create or replace function public.drive_finish_racer(
  p_game_id uuid,
  p_place integer,
  p_course integer
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game public.games;
  v_total integer;
  v_done integer;
begin
  if not exists (
    select 1 from public.game_players
    where game_id=p_game_id and user_id=v_user_id
  ) then
    raise exception 'Not a racer in this game';
  end if;

  update public.games
  set game_state = jsonb_set(
        coalesce(game_state,'{}'::jsonb),
        array['driveFinished', v_user_id::text],
        jsonb_build_object(
          'place', greatest(1, least(4,p_place)),
          'course', greatest(1,least(5,p_course)),
          'at', now()
        ),
        true
      ),
      updated_at = now()
  where id=p_game_id and game_type='driving'
  returning * into v_game;

  select count(*) into v_total
  from public.game_players
  where game_id=p_game_id and user_id is not null;

  select count(*) into v_done
  from jsonb_object_keys(coalesce(v_game.game_state->'driveFinished','{}'::jsonb));

  if p_course >= 5 and v_done >= v_total then
    update public.games
    set status='completed',
        finished_at=now(),
        is_live=false,
        live_ended_at=now()
    where id=p_game_id
    returning * into v_game;
  end if;

  return v_game;
end;
$$;

create or replace function public.drive_advance_course(
  p_game_id uuid,
  p_next_course integer
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game public.games;
  v_next integer := greatest(1, least(5, p_next_course));
begin
  select * into v_game
  from public.games
  where id=p_game_id and game_type='driving' and host_user_id=v_user_id
  for update;

  if v_game.id is null then
    raise exception 'Only the race host can advance the course';
  end if;

  update public.games
  set game_state = coalesce(game_state,'{}'::jsonb)
      || jsonb_build_object(
        'driveCourse', v_next,
        'driveFinished', '{}'::jsonb
      ),
      status='active',
      finished_at=null,
      updated_at=now()
  where id=p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

revoke all on function public.drive_advance_course(uuid,integer) from public, anon;
grant execute on function public.drive_advance_course(uuid,integer) to authenticated, service_role;

notify pgrst, 'reload schema';
