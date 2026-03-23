
-- Tighten insert policy: only allow inserting wins where the user is the winner
DROP POLICY "System can insert wins" ON public.battle_wins;
CREATE POLICY "Winners can record wins" ON public.battle_wins FOR INSERT TO authenticated WITH CHECK (auth.uid() = winner_id);
