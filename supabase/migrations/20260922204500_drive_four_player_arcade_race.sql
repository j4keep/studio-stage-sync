-- Drive: up to four human racers, per-player car selection, shared course.
create or replace function public.create_drive_race_game(
  p_course integer,
  p_car_id text,
  p_invitee_ids uuid[]
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game public.games;
  v_invitees uuid[];
  v_invitee uuid;
  v_seat integer := 2;
  v_course integer := greatest(1, least(5, coalesce(p_course, 1)));
begin
  if v_user_id is null then
    raise exception 'Sign in required';
  end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[])
  into v_invitees
  from unnest(coalesce(p_invitee_ids, '{}'::uuid[])) as x
  where x is not null and x <> v_user_id;

  if coalesce(array_length(v_invitees, 1), 0) > 3 then
    raise exception 'Drive supports up to 4 racers total';
  end if;

  insert into public.games (
    game_type, host_user_id, mode, status, current_turn_user_id, game_state
  ) values (
    'driving',
    v_user_id,
    case when coalesce(array_length(v_invitees, 1), 0) = 0 then 'solo' else 'multiplayer' end,
    case when coalesce(array_length(v_invitees, 1), 0) = 0 then 'active' else 'waiting' end,
    v_user_id,
    jsonb_build_object(
      'driveRaceMode', true,
      'driveCourse', v_course,
      'driveCars', jsonb_build_object(v_user_id::text, coalesce(nullif(p_car_id,''), 'gt')),
      'driveFinished', '{}'::jsonb
    )
  )
  returning * into v_game;

  insert into public.game_players (game_id, user_id, is_computer, seat, symbol)
  values (v_game.id, v_user_id, false, 1, 'RACER');

  foreach v_invitee in array v_invitees loop
    insert into public.game_players (game_id, user_id, is_computer, seat, symbol)
    values (v_game.id, v_invitee, false, v_seat, 'RACER');

    insert into public.game_invites (game_id, game_type, from_user_id, to_user_id)
    values (v_game.id, 'driving', v_user_id, v_invitee);

    v_seat := v_seat + 1;
  end loop;

  return v_game;
end;
$$;

revoke all on function public.create_drive_race_game(integer,text,uuid[]) from public, anon;
grant execute on function public.create_drive_race_game(integer,text,uuid[]) to authenticated, service_role;

create or replace function public.drive_update_setup(
  p_game_id uuid,
  p_car_id text,
  p_course integer default null
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game public.games;
begin
  if v_user_id is null then raise exception 'Sign in required'; end if;

  select g.* into v_game
  from public.games g
  join public.game_players gp on gp.game_id = g.id and gp.user_id = v_user_id
  where g.id = p_game_id and g.game_type = 'driving'
  for update;

  if v_game.id is null then raise exception 'Drive race not found'; end if;

  update public.games
  set game_state =
      jsonb_set(
        coalesce(game_state,'{}'::jsonb),
        array['driveCars', v_user_id::text],
        to_jsonb(coalesce(nullif(p_car_id,''),'gt'::text)),
        true
      )
      || case
           when p_course is not null and host_user_id = v_user_id
           then jsonb_build_object('driveCourse', greatest(1, least(5, p_course)))
           else '{}'::jsonb
         end,
      updated_at = now()
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

revoke all on function public.drive_update_setup(uuid,text,integer) from public, anon;
grant execute on function public.drive_update_setup(uuid,text,integer) to authenticated, service_role;

create or replace function public.respond_drive_invite(
  p_invite_id uuid,
  p_accept boolean
)
returns public.game_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.game_invites;
  v_pending integer;
  v_accepted integer;
begin
  select * into v_invite
  from public.game_invites
  where id = p_invite_id
    and to_user_id = v_user_id
    and game_type = 'driving'
    and status = 'pending'
  for update;

  if v_invite.id is null then raise exception 'Invite not found'; end if;

  update public.game_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if not p_accept then
    delete from public.game_players
    where game_id = v_invite.game_id and user_id = v_user_id;
  end if;

  select count(*) into v_pending from public.game_invites where game_id=v_invite.game_id and status='pending';
  select count(*) into v_accepted from public.game_invites where game_id=v_invite.game_id and status='accepted';

  if v_pending = 0 then
    update public.games
    set status = case when v_accepted > 0 then 'active' else 'cancelled' end,
        updated_at = now()
    where id = v_invite.game_id;
  end if;

  return v_invite;
end;
$$;

revoke all on function public.respond_drive_invite(uuid,boolean) from public, anon;
grant execute on function public.respond_drive_invite(uuid,boolean) to authenticated, service_role;

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
        jsonb_build_object('place', greatest(1, least(4,p_place)), 'course', greatest(1,least(5,p_course)), 'at', now()),
        true
      ),
      updated_at = now()
  where id=p_game_id and game_type='driving'
  returning * into v_game;

  select count(*) into v_total from public.game_players where game_id=p_game_id and user_id is not null;
  select count(*) into v_done from jsonb_object_keys(coalesce(v_game.game_state->'driveFinished','{}'::jsonb));

  if v_game.mode='multiplayer' and v_done >= v_total then
    update public.games
    set status='completed', finished_at=now(), is_live=false, live_ended_at=now()
    where id=p_game_id
    returning * into v_game;
  end if;

  return v_game;
end;
$$;

revoke all on function public.drive_finish_racer(uuid,integer,integer) from public, anon;
grant execute on function public.drive_finish_racer(uuid,integer,integer) to authenticated, service_role;

notify pgrst, 'reload schema';
