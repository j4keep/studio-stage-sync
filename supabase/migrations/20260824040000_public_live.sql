-- Public (non-Circle) live streams: the exact same live infrastructure (sessions, gifts,
-- comments, LiveKit room) as a Circle live, just with circle_id = NULL. Anyone who can be
-- a viewer at all — not just approved Circle members — can watch, comment, and gift; the
-- host doesn't have to be an admin of anything, just themselves. Keeping this on the same
-- three tables (rather than a parallel set) is deliberate — the user explicitly wants the
-- Circle-live and post-feed-live surfaces to share one structure, not two to keep in sync.

ALTER TABLE public.circle_live_sessions ALTER COLUMN circle_id DROP NOT NULL;
ALTER TABLE public.circle_live_gifts ALTER COLUMN circle_id DROP NOT NULL;
ALTER TABLE public.circle_live_comments ALTER COLUMN circle_id DROP NOT NULL;

DROP POLICY "View live sessions for circles you're in" ON public.circle_live_sessions;
CREATE POLICY "View live sessions"
  ON public.circle_live_sessions FOR SELECT
  USING (
    circle_id IS NULL
    OR public.is_social_circle_member(circle_id, auth.uid())
    OR public.is_social_circle_admin(circle_id, auth.uid())
  );

DROP POLICY "Owners go live" ON public.circle_live_sessions;
CREATE POLICY "Owners go live"
  ON public.circle_live_sessions FOR INSERT
  WITH CHECK (
    host_user_id = auth.uid()
    AND (circle_id IS NULL OR public.is_social_circle_admin(circle_id, auth.uid()))
  );

DROP POLICY "View gifts for circles you're in" ON public.circle_live_gifts;
CREATE POLICY "View gifts"
  ON public.circle_live_gifts FOR SELECT
  USING (
    circle_id IS NULL
    OR public.is_social_circle_member(circle_id, auth.uid())
    OR public.is_social_circle_admin(circle_id, auth.uid())
  );

DROP POLICY "Approved members send gifts" ON public.circle_live_gifts;
CREATE POLICY "Send gifts"
  ON public.circle_live_gifts FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      circle_id IS NULL
      OR public.is_social_circle_member(circle_id, auth.uid())
      OR public.is_social_circle_admin(circle_id, auth.uid())
    )
  );

DROP POLICY "View comments for circles you're in" ON public.circle_live_comments;
CREATE POLICY "View comments"
  ON public.circle_live_comments FOR SELECT
  USING (
    circle_id IS NULL
    OR public.is_social_circle_member(circle_id, auth.uid())
    OR public.is_social_circle_admin(circle_id, auth.uid())
  );

DROP POLICY "Approved members comment" ON public.circle_live_comments;
CREATE POLICY "Send comments"
  ON public.circle_live_comments FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      circle_id IS NULL
      OR public.is_social_circle_member(circle_id, auth.uid())
      OR public.is_social_circle_admin(circle_id, auth.uid())
    )
  );
