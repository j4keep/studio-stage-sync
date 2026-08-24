-- Live comments: the chat feed on a Circle live, same access model as gifts (only an
-- approved member/owner of the circle can read or post).

CREATE TABLE public.circle_live_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.circle_live_sessions(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX circle_live_comments_session_idx ON public.circle_live_comments (session_id, created_at);

ALTER TABLE public.circle_live_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments for circles you're in"
  ON public.circle_live_comments FOR SELECT
  USING (
    public.is_social_circle_member(circle_id, auth.uid())
    OR public.is_social_circle_admin(circle_id, auth.uid())
  );

CREATE POLICY "Approved members comment"
  ON public.circle_live_comments FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (public.is_social_circle_member(circle_id, auth.uid()) OR public.is_social_circle_admin(circle_id, auth.uid()))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_live_comments;
