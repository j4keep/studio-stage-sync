
-- 1. Room-level session table
CREATE TABLE public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL UNIQUE,
  booking_id UUID REFERENCES public.studio_bookings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- 2. Per-user presence table
CREATE TABLE public.live_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT NOT NULL DEFAULT 'artist',
  display_name TEXT,
  client_instance_id TEXT,
  is_live BOOLEAN NOT NULL DEFAULT false,
  mic_muted BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('engineer', 'artist'))
);

-- Indexes
CREATE INDEX idx_live_sessions_code ON public.live_sessions (session_code);
CREATE INDEX idx_live_sessions_status ON public.live_sessions (status);
CREATE INDEX idx_lsp_session ON public.live_session_participants (live_session_id);
CREATE INDEX idx_lsp_user ON public.live_session_participants (user_id);

-- RLS on live_sessions
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select live_sessions"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Creator can insert live_sessions"
  ON public.live_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or participant can update live_sessions"
  ON public.live_sessions FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.live_session_participants p
      WHERE p.live_session_id = id AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_live_sessions_updated_at
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS on live_session_participants
ALTER TABLE public.live_session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view session members"
  ON public.live_session_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_session_participants p2
      WHERE p2.live_session_id = live_session_participants.live_session_id AND p2.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_session_participants.live_session_id AND ls.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can join sessions"
  ON public.live_session_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users update own presence"
  ON public.live_session_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_lsp_updated_at
  BEFORE UPDATE ON public.live_session_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_participants;
