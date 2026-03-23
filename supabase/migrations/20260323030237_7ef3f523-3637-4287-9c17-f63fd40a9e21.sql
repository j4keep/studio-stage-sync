
-- Table to persist battle wins even if the battle is deleted
CREATE TABLE public.battle_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid,
  winner_id uuid NOT NULL,
  loser_id uuid,
  battle_title text NOT NULL,
  winner_votes integer NOT NULL DEFAULT 0,
  loser_votes integer NOT NULL DEFAULT 0,
  media_type text NOT NULL DEFAULT 'audio',
  winner_cover_url text,
  winner_media_url text,
  winner_title text,
  declared_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.battle_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view battle wins" ON public.battle_wins FOR SELECT TO public USING (true);
CREATE POLICY "System can insert wins" ON public.battle_wins FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_battle_wins_winner ON public.battle_wins(winner_id);
CREATE INDEX idx_battle_wins_battle ON public.battle_wins(battle_id);
