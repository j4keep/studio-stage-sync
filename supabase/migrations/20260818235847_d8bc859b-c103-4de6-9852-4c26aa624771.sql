ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_title TEXT;

CREATE INDEX IF NOT EXISTS games_is_live_idx ON public.games (is_live, live_started_at DESC);

DROP POLICY IF EXISTS "Anyone can view live games" ON public.games;
CREATE POLICY "Anyone can view live games"
ON public.games FOR SELECT TO authenticated
USING (is_live = true);

DROP POLICY IF EXISTS "Anyone can view players of live games" ON public.game_players;
CREATE POLICY "Anyone can view players of live games"
ON public.game_players FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_players.game_id AND g.is_live = true));

DROP POLICY IF EXISTS "Anyone can view moves of live games" ON public.game_moves;
CREATE POLICY "Anyone can view moves of live games"
ON public.game_moves FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_moves.game_id AND g.is_live = true));

CREATE TABLE IF NOT EXISTS public.game_live_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_live_comments_game_idx ON public.game_live_comments (game_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.game_live_comments TO authenticated;
GRANT ALL ON public.game_live_comments TO service_role;

ALTER TABLE public.game_live_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View comments on live or own games" ON public.game_live_comments;
CREATE POLICY "View comments on live or own games"
ON public.game_live_comments FOR SELECT TO authenticated
USING (
  public.is_game_participant(game_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_live_comments.game_id AND g.is_live = true)
);

DROP POLICY IF EXISTS "Comment on live games" ON public.game_live_comments;
CREATE POLICY "Comment on live games"
ON public.game_live_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.is_game_participant(game_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_live_comments.game_id AND g.is_live = true)
  )
);

DROP POLICY IF EXISTS "Delete own live comments" ON public.game_live_comments;
CREATE POLICY "Delete own live comments"
ON public.game_live_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());