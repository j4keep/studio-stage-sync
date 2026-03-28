
-- Recording sessions
CREATE TABLE public.recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  beat_url TEXT,
  beat_name TEXT,
  cover_url TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.recording_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.recording_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.recording_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.recording_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Recording takes
CREATE TABLE public.recording_takes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Take 1',
  audio_url TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  muted BOOLEAN NOT NULL DEFAULT false,
  solo BOOLEAN NOT NULL DEFAULT false,
  trim_start INTEGER NOT NULL DEFAULT 0,
  trim_end INTEGER NOT NULL DEFAULT 100,
  waveform_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recording_takes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own takes" ON public.recording_takes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own takes" ON public.recording_takes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own takes" ON public.recording_takes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own takes" ON public.recording_takes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Recording exports
CREATE TABLE public.recording_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.recording_sessions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  artist_name TEXT,
  audio_url TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recording_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exports" ON public.recording_exports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exports" ON public.recording_exports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own exports" ON public.recording_exports FOR DELETE TO authenticated USING (auth.uid() = user_id);
