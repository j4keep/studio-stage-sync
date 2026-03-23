
CREATE TABLE public.battle_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'left',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.battle_effects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view battle effects" ON public.battle_effects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert effects" ON public.battle_effects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_effects;
