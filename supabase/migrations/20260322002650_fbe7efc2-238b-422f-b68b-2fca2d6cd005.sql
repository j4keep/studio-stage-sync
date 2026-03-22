
-- Battles table
CREATE TABLE public.battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL,
  opponent_id UUID,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  media_type TEXT NOT NULL DEFAULT 'audio',
  challenger_media_url TEXT,
  challenger_cover_url TEXT,
  challenger_title TEXT,
  opponent_media_url TEXT,
  opponent_cover_url TEXT,
  opponent_title TEXT,
  winner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view battles" ON public.battles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create battles" ON public.battles FOR INSERT TO authenticated WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Participants can update battles" ON public.battles FOR UPDATE TO authenticated USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Battle votes (likes)
CREATE TABLE public.battle_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  voted_for UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(battle_id, user_id)
);

ALTER TABLE public.battle_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes" ON public.battle_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can vote" ON public.battle_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change vote" ON public.battle_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can remove vote" ON public.battle_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Battle comments
CREATE TABLE public.battle_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.battle_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON public.battle_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment" ON public.battle_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Enable realtime for comments and votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_comments;
