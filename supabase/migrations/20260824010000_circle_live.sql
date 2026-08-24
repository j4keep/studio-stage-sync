-- Circle live sessions: lets a Circle owner go live (real LiveKit broadcast, reusing the
-- same livekit-token edge function the Podcast rooms already use) with approved members
-- able to watch. A dedicated table rather than reusing podcast_episodes — that table is
-- podcast-specific (recovery, editor state) and reusing it would leak Circle "lives" into
-- podcast listings.

CREATE TABLE public.circle_live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL,
  room text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX circle_live_sessions_circle_status_idx ON public.circle_live_sessions (circle_id, status);

ALTER TABLE public.circle_live_sessions ENABLE ROW LEVEL SECURITY;

-- Only an approved member (or the owner/admin) can see that a live session exists at
-- all — matches the same gating as everything else in a private Circle.
CREATE POLICY "View live sessions for circles you're in"
  ON public.circle_live_sessions FOR SELECT
  USING (
    public.is_social_circle_member(circle_id, auth.uid())
    OR public.is_social_circle_admin(circle_id, auth.uid())
  );

CREATE POLICY "Owners go live"
  ON public.circle_live_sessions FOR INSERT
  WITH CHECK (
    host_user_id = auth.uid()
    AND public.is_social_circle_admin(circle_id, auth.uid())
  );

CREATE POLICY "Hosts end their own live session"
  ON public.circle_live_sessions FOR UPDATE
  USING (host_user_id = auth.uid());

-- So members see "circle went live" without polling.
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_live_sessions;
