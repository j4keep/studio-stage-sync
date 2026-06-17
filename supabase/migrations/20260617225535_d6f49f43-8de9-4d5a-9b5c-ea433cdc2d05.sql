ALTER TABLE public.podcast_transcripts ADD COLUMN IF NOT EXISTS words jsonb;
ALTER TABLE public.podcast_recordings ADD COLUMN IF NOT EXISTS edl jsonb;
ALTER TABLE public.podcast_recordings ADD COLUMN IF NOT EXISTS processed_audio_key text;
ALTER TABLE public.podcast_recordings ADD COLUMN IF NOT EXISTS magic_audio_status text DEFAULT 'idle';