-- Fleet Clash: four-person crew lobbies and captain snapshot updates.
-- Host/captain + up to 3 invited crew members = 4 total human players.

create or replace function public.create_fleet_clash_game(
  p_initial_state jsonb,
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
begin
  if v_user_id is null then
    raise exception 'Sign in required';
  end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[])
  into v_invitees
  from unnest(coalesce(p_invitee_ids, '{}'::uuid[])) as x
  where x is not null and x <> v_user_id;

  if coalesce(array_length(v_invitees, 1), 0) < 1 then
    raise exception 'Choose at least one crew member';
  end if;

  if array_length(v_invitees, 1) > 3 then
    raise exception 'Fleet Clash supports up to 4 players total';
  end if;

  insert into public.games (
    game_type, host_user_id, mode, status, current_turn_user_id, game_state
  ) values (
    'battleship',
    v_user_id,
    'multiplayer',
    'waiting',
    v_user_id,
    coalesce(p_initial_state, '{}'::jsonb)
      || jsonb_build_object('fleetClashCrewMode', true, 'fleetClashLevel', 1)
  )
  returning * into v_game;

  insert into public.game_players (game_id, user_id, is_computer, seat, symbol)
  values (v_game.id, v_user_id, false, 1, 'CAPTAIN');

  foreach v_invitee in array v_invitees loop
    insert into public.game_players (game_id, user_id, is_computer, seat, symbol)
    values (v_game.id, v_invitee, false, v_seat, 'CREW');

    insert into public.game_invites (game_id, game_type, from_user_id, to_user_id)
    values (v_game.id, 'battleship', v_user_id, v_invitee);

    v_seat := v_seat + 1;
  end loop;

  return v_game;
end;
$$;

revoke all on function public.create_fleet_clash_game(jsonb, uuid[]) from public, anon;
grant execute on function public.create_fleet_clash_game(jsonb, uuid[]) to authenticated, service_role;

create or replace function public.respond_fleet_clash_invite(
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
  if v_user_id is null then
    raise exception 'Sign in required';
  end if;

  select * into v_invite
  from public.game_invites
  where id = p_invite_id
    and to_user_id = v_user_id
    and game_type = 'battleship'
    and status = 'pending'
  for update;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;

  update public.game_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if not p_accept then
    delete from public.game_players
    where game_id = v_invite.game_id and user_id = v_user_id;
  end if;

  select count(*) into v_pending
  from public.game_invites
  where game_id = v_invite.game_id and status = 'pending';

  select count(*) into v_accepted
  from public.game_invites
  where game_id = v_invite.game_id and status = 'accepted';

  if v_pending = 0 then
    update public.games
    set status = case when v_accepted > 0 then 'active' else 'cancelled' end,
        updated_at = now()
    where id = v_invite.game_id;
  end if;

  return v_invite;
end;
$$;

revoke all on function public.respond_fleet_clash_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_fleet_clash_invite(uuid, boolean) to authenticated, service_role;

create or replace function public.fleet_clash_update_snapshot(
  p_game_id uuid,
  p_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in required';
  end if;

  update public.games
  set game_state = jsonb_set(
        coalesce(game_state, '{}'::jsonb),
        '{fleetClashSnapshot}',
        coalesce(p_snapshot, '{}'::jsonb),
        true
      ),
      updated_at = now()
  where id = p_game_id
    and game_type = 'battleship'
    and host_user_id = v_user_id
    and status in ('waiting','active');

  if not found then
    raise exception 'Only the Fleet Clash captain can update the race';
  end if;
end;
$$;

revoke all on function public.fleet_clash_update_snapshot(uuid, jsonb) from public, anon;
grant execute on function public.fleet_clash_update_snapshot(uuid, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
