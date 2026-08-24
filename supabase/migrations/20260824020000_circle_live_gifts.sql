-- Live gifts: the animated gift icons a viewer can send during a Circle live. Real money
-- (card capture, actual charges) is explicit future work per the user — this table and
-- its RLS only ever record which gift was sent, by whom, in which session. No balance,
-- no payment reference — nothing here pretends a real transaction happened.

CREATE TABLE public.circle_live_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.circle_live_sessions(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  gift_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX circle_live_gifts_session_idx ON public.circle_live_gifts (session_id, created_at);

ALTER TABLE public.circle_live_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View gifts for circles you're in"
  ON public.circle_live_gifts FOR SELECT
  USING (
    public.is_social_circle_member(circle_id, auth.uid())
    OR public.is_social_circle_admin(circle_id, auth.uid())
  );

CREATE POLICY "Approved members send gifts"
  ON public.circle_live_gifts FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (public.is_social_circle_member(circle_id, auth.uid()) OR public.is_social_circle_admin(circle_id, auth.uid()))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_live_gifts;
