-- Richer Circle post fields + RSVP / poll votes.
-- Circle access stays on circles (is_private / requires_approval / is_paid).

ALTER TABLE public.circle_contents
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS event_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_online_url text,
  ADD COLUMN IF NOT EXISTS event_capacity integer,
  ADD COLUMN IF NOT EXISTS event_ticket_cents integer,
  ADD COLUMN IF NOT EXISTS event_reminders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS community_subtype text
    CHECK (community_subtype IS NULL OR community_subtype IN ('poll', 'question', 'challenge', 'activity')),
  ADD COLUMN IF NOT EXISTS poll_options text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS circle_contents_pinned_idx
  ON public.circle_contents (circle_id, is_pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.circle_content_rsvps (
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('going', 'interested', 'cant_go')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.circle_content_poll_votes (
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index integer NOT NULL CHECK (option_index >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, user_id)
);

ALTER TABLE public.circle_content_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_content_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View circle RSVPs"
  ON public.circle_content_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id AND public.is_social_circle_member(c.circle_id, auth.uid())
    )
  );

CREATE POLICY "Members RSVP"
  ON public.circle_content_rsvps FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id AND public.is_social_circle_member(c.circle_id, auth.uid())
    )
  );

CREATE POLICY "Members update RSVP"
  ON public.circle_content_rsvps FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Members delete RSVP"
  ON public.circle_content_rsvps FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "View poll votes"
  ON public.circle_content_poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id AND public.is_social_circle_member(c.circle_id, auth.uid())
    )
  );

CREATE POLICY "Members vote polls"
  ON public.circle_content_poll_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id AND public.is_social_circle_member(c.circle_id, auth.uid())
    )
  );

CREATE POLICY "Members change poll vote"
  ON public.circle_content_poll_votes FOR UPDATE
  USING (user_id = auth.uid());
