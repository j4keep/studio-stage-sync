
CREATE TABLE public.ai_generations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  lyrics text,
  genre text,
  mood text,
  production_notes text,
  bpm integer,
  musical_key text,
  type text NOT NULL DEFAULT 'AI Music',
  cover_url text,
  audio_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generations"
  ON public.ai_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations"
  ON public.ai_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generations"
  ON public.ai_generations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
