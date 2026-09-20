-- YAJ.TV Live: creators broadcast themselves (LiveKit), viewers watch and
-- chat. Deliberately no gifts/donations table here — Live TV never gets a
-- donate button (that lives only on uploaded/original tv_posts content).
-- Modeled on circle_live_sessions/circle_live_comments, without the
-- Circle/Exclusive-specific columns this doesn't need.

CREATE TABLE IF NOT EXISTS public.yajtv_live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  room text NOT NULL UNIQUE,
  title text,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT ON public.yajtv_live_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.yajtv_live_sessions TO authenticated;
GRANT ALL ON public.yajtv_live_sessions TO service_role;
ALTER TABLE public.yajtv_live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "yajtv_live_sessions public read" ON public.yajtv_live_sessions FOR SELECT USING (true);
CREATE POLICY "yajtv_live_sessions host insert" ON public.yajtv_live_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "yajtv_live_sessions host update" ON public.yajtv_live_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id);
CREATE INDEX IF NOT EXISTS yajtv_live_sessions_status_idx ON public.yajtv_live_sessions (status) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS yajtv_live_sessions_host_idx ON public.yajtv_live_sessions (host_user_id);

CREATE TABLE IF NOT EXISTS public.yajtv_live_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.yajtv_live_sessions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.yajtv_live_comments TO anon;
GRANT SELECT, INSERT ON public.yajtv_live_comments TO authenticated;
GRANT ALL ON public.yajtv_live_comments TO service_role;
ALTER TABLE public.yajtv_live_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "yajtv_live_comments public read" ON public.yajtv_live_comments FOR SELECT USING (true);
CREATE POLICY "yajtv_live_comments self insert" ON public.yajtv_live_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE INDEX IF NOT EXISTS yajtv_live_comments_session_idx ON public.yajtv_live_comments (session_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.yajtv_live_comments;
