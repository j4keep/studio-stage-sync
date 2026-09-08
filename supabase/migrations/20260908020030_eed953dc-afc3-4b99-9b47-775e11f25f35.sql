DROP POLICY IF EXISTS "Claimers write reviews" ON public.deal_reviews;
CREATE POLICY "Claimers write reviews" ON public.deal_reviews
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.deal_claims c
    WHERE c.id = deal_reviews.claim_id
      AND c.user_id = auth.uid()
      AND c.deal_id = deal_reviews.deal_id
  )
);

DROP POLICY IF EXISTS "Join games" ON public.game_players;
CREATE POLICY "Join games" ON public.game_players
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_game_participant(game_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_players.game_id AND g.host_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Creator or participant can update live_sessions" ON public.live_sessions;
CREATE POLICY "Creator or participant can update live_sessions" ON public.live_sessions
FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR public.is_live_session_member(id, auth.uid()))
WITH CHECK (auth.uid() = created_by OR public.is_live_session_member(id, auth.uid()));