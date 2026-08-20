CREATE OR REPLACE FUNCTION public.create_game(p_game_type text, p_mode text, p_initial_state jsonb, p_opponent_id uuid DEFAULT NULL::uuid)
 RETURNS games
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_game public.games;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF p_game_type NOT IN ('tic_tac_toe', 'connect_four', 'dominoes', 'checkers', 'trivia', 'pool', 'boxing', 'battleship', 'driving', 'poker', 'pop_shot', 'knock_hockey', 'bingo', 'word_link', 'mini_golf', 'snake_royale', 'obby', 'city_run', 'treasure_rush', 'tower_escape', 'survival_island') THEN
    RAISE EXCEPTION 'Unsupported game type';
  END IF;

  IF p_mode NOT IN ('solo', 'multiplayer') THEN
    RAISE EXCEPTION 'Invalid game mode';
  END IF;

  IF p_mode = 'multiplayer' AND (p_opponent_id IS NULL OR p_opponent_id = v_user_id) THEN
    RAISE EXCEPTION 'Choose another YAJ user';
  END IF;

  INSERT INTO public.games (
    game_type, host_user_id, mode, status, current_turn_user_id, game_state
  ) VALUES (
    p_game_type,
    v_user_id,
    p_mode,
    CASE WHEN p_mode = 'solo' THEN 'active' ELSE 'waiting' END,
    v_user_id,
    COALESCE(p_initial_state, '{}'::jsonb)
  )
  RETURNING * INTO v_game;

  INSERT INTO public.game_players (game_id, user_id, is_computer, seat, symbol)
  VALUES (v_game.id, v_user_id, false, 1, 'X');

  IF p_mode = 'solo' THEN
    INSERT INTO public.game_players (game_id, user_id, is_computer, seat, symbol)
    VALUES (v_game.id, NULL, true, 2, 'O');
  ELSE
    INSERT INTO public.game_players (game_id, user_id, is_computer, seat, symbol)
    VALUES (v_game.id, p_opponent_id, false, 2, 'O');

    INSERT INTO public.game_invites (game_id, game_type, from_user_id, to_user_id)
    VALUES (v_game.id, p_game_type, v_user_id, p_opponent_id);
  END IF;

  RETURN v_game;
END;
$function$;