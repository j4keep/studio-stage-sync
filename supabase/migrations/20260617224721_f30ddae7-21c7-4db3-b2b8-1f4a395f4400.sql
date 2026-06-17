
ALTER TABLE public.podcast_episodes
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_chapters jsonb,
  ADD COLUMN IF NOT EXISTS ai_titles jsonb,
  ADD COLUMN IF NOT EXISTS ai_soundbites jsonb,
  ADD COLUMN IF NOT EXISTS ai_show_notes text;

CREATE TABLE public.podcast_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  recording_id uuid REFERENCES public.podcast_recordings(id) ON DELETE CASCADE,
  language text DEFAULT 'en',
  text text NOT NULL DEFAULT '',
  segments jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | ready | failed
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX podcast_transcripts_episode_idx ON public.podcast_transcripts(episode_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_transcripts TO authenticated;
GRANT ALL ON public.podcast_transcripts TO service_role;
ALTER TABLE public.podcast_transcripts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_podcast_transcripts_updated BEFORE UPDATE ON public.podcast_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "host manages transcripts" ON public.podcast_transcripts
  FOR ALL USING (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.podcast_episodes e WHERE e.id=episode_id AND e.host_user_id=auth.uid()));
