-- GAMES
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type text NOT NULL,
  host_user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'multiplayer',
  status text NOT NULL DEFAULT 'waiting',
  current_turn_user_id uuid,
  game_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner_user_id uuid,
  is_draw boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid,
  is_computer boolean NOT NULL DEFAULT false,
  seat integer NOT NULL,
  symbol text,
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, seat)
);

CREATE TABLE public.game_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE TABLE public.game_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid,
  move_number integer NOT NULL,
  move jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.game_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_type text NOT NULL,
  games_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  high_score integer NOT NULL DEFAULT 0,
  last_played_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_type)
);

CREATE INDEX idx_games_status ON public.games(status);
CREATE INDEX idx_game_players_user ON public.game_players(user_id);
CREATE INDEX idx_game_invites_to ON public.game_invites(to_user_id, status);
CREATE INDEX idx_game_moves_game ON public.game_moves(game_id, move_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_players TO authenticated;
GRANT ALL ON public.game_players TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_invites TO authenticated;
GRANT ALL ON public.game_invites TO service_role;
GRANT SELECT, INSERT ON public.game_moves TO authenticated;
GRANT ALL ON public.game_moves TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.game_stats TO authenticated;
GRANT ALL ON public.game_stats TO service_role;
GRANT SELECT ON public.game_stats TO anon;

CREATE OR REPLACE FUNCTION public.is_game_participant(_game_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.game_id = _game_id AND gp.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = _game_id AND g.host_user_id = _user_id);
$$;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view their games" ON public.games FOR SELECT TO authenticated
USING (public.is_game_participant(id, auth.uid()) OR status = 'waiting');
CREATE POLICY "Host creates games" ON public.games FOR INSERT TO authenticated
WITH CHECK (host_user_id = auth.uid());
CREATE POLICY "Participants update games" ON public.games FOR UPDATE TO authenticated
USING (public.is_game_participant(id, auth.uid())) WITH CHECK (public.is_game_participant(id, auth.uid()));
CREATE POLICY "Host deletes games" ON public.games FOR DELETE TO authenticated
USING (host_user_id = auth.uid());

CREATE POLICY "View players of own games" ON public.game_players FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_game_participant(game_id, auth.uid()));
CREATE POLICY "Join games" ON public.game_players FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR is_computer OR public.is_game_participant(game_id, auth.uid()));
CREATE POLICY "Update players in own games" ON public.game_players FOR UPDATE TO authenticated
USING (public.is_game_participant(game_id, auth.uid())) WITH CHECK (public.is_game_participant(game_id, auth.uid()));

CREATE POLICY "View own invites" ON public.game_invites FOR SELECT TO authenticated
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "Send invites" ON public.game_invites FOR INSERT TO authenticated
WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "Respond to invites" ON public.game_invites FOR UPDATE TO authenticated
USING (to_user_id = auth.uid() OR from_user_id = auth.uid())
WITH CHECK (to_user_id = auth.uid() OR from_user_id = auth.uid());
CREATE POLICY "Cancel own invites" ON public.game_invites FOR DELETE TO authenticated
USING (from_user_id = auth.uid());

CREATE POLICY "View moves of own games" ON public.game_moves FOR SELECT TO authenticated
USING (public.is_game_participant(game_id, auth.uid()));
CREATE POLICY "Insert moves in own games" ON public.game_moves FOR INSERT TO authenticated
WITH CHECK (public.is_game_participant(game_id, auth.uid()));

CREATE POLICY "Anyone views game stats" ON public.game_stats FOR SELECT USING (true);
CREATE POLICY "Users insert own stats" ON public.game_stats FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own stats" ON public.game_stats FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_games_updated BEFORE UPDATE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_game_stats_updated BEFORE UPDATE ON public.game_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_moves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;