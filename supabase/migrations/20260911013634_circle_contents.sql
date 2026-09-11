-- My Circle content: posts & videos (exclusive to the circle — not the main feed).
-- Likes, comments, views, optional donations. No share-to-feed.

CREATE TABLE IF NOT EXISTS public.circle_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('post', 'video')),
  activity_type text NOT NULL DEFAULT 'update'
    CHECK (activity_type IN ('photo', 'event', 'community', 'update', 'exclusive', 'video')),
  title text,
  body text,
  media_urls text[] NOT NULL DEFAULT '{}',
  media_type text NOT NULL DEFAULT 'none'
    CHECK (media_type IN ('image', 'video', 'none')),
  visibility text NOT NULL DEFAULT 'circle_members'
    CHECK (visibility IN ('circle_members', 'paid_members', 'only_me', 'public_in_circle')),
  donations_enabled boolean NOT NULL DEFAULT true,
  like_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  event_at timestamptz,
  event_location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_contents_circle_created_idx
  ON public.circle_contents (circle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS circle_contents_circle_kind_idx
  ON public.circle_contents (circle_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS public.circle_content_likes (
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.circle_content_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_content_comments_content_idx
  ON public.circle_content_comments (content_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.circle_content_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_content_donations_content_idx
  ON public.circle_content_donations (content_id, created_at DESC);

ALTER TABLE public.circle_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_content_donations ENABLE ROW LEVEL SECURITY;

-- Members (or public_in_circle for non-private circles) can view content.
CREATE POLICY "View circle contents"
  ON public.circle_contents FOR SELECT
  USING (
    author_id = auth.uid()
    OR visibility = 'public_in_circle'
    OR (
      visibility IN ('circle_members', 'paid_members')
      AND public.is_social_circle_member(circle_id, auth.uid())
    )
    OR (
      visibility = 'only_me'
      AND author_id = auth.uid()
    )
  );

CREATE POLICY "Authors insert circle contents"
  ON public.circle_contents FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_social_circle_admin(circle_id, auth.uid())
      OR (
        public.is_social_circle_member(circle_id, auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.circles c
          WHERE c.id = circle_id AND c.member_posting_allowed = true
        )
      )
    )
  );

CREATE POLICY "Authors update circle contents"
  ON public.circle_contents FOR UPDATE
  USING (author_id = auth.uid() OR public.is_social_circle_admin(circle_id, auth.uid()));

CREATE POLICY "Authors delete circle contents"
  ON public.circle_contents FOR DELETE
  USING (author_id = auth.uid() OR public.is_social_circle_admin(circle_id, auth.uid()));

CREATE POLICY "View circle content likes"
  ON public.circle_content_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id
        AND (
          c.author_id = auth.uid()
          OR c.visibility = 'public_in_circle'
          OR public.is_social_circle_member(c.circle_id, auth.uid())
        )
    )
  );

CREATE POLICY "Members like circle content"
  ON public.circle_content_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id
        AND public.is_social_circle_member(c.circle_id, auth.uid())
    )
  );

CREATE POLICY "Users unlike own circle likes"
  ON public.circle_content_likes FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "View circle content comments"
  ON public.circle_content_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id
        AND (
          c.author_id = auth.uid()
          OR c.visibility = 'public_in_circle'
          OR public.is_social_circle_member(c.circle_id, auth.uid())
        )
    )
  );

CREATE POLICY "Members comment on circle content"
  ON public.circle_content_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id
        AND public.is_social_circle_member(c.circle_id, auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.circles cir
          WHERE cir.id = c.circle_id
            AND (cir.member_comments_allowed = true OR cir.owner_id = auth.uid())
        )
    )
  );

CREATE POLICY "Users delete own circle comments"
  ON public.circle_content_comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id AND public.is_social_circle_admin(c.circle_id, auth.uid())
    )
  );

CREATE POLICY "View circle content donations"
  ON public.circle_content_donations FOR SELECT
  USING (
    from_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id
        AND (c.author_id = auth.uid() OR public.is_social_circle_admin(c.circle_id, auth.uid()))
    )
  );

CREATE POLICY "Members donate on circle content"
  ON public.circle_content_donations FOR INSERT
  WITH CHECK (
    from_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.circle_contents c
      WHERE c.id = content_id
        AND c.donations_enabled = true
        AND public.is_social_circle_member(c.circle_id, auth.uid())
    )
  );

-- Atomic-ish counters
CREATE OR REPLACE FUNCTION public.increment_circle_content_views(p_content_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.circle_contents
  SET view_count = view_count + 1, updated_at = now()
  WHERE id = p_content_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_circle_content_like(p_content_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  liked boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.circle_content_likes WHERE content_id = p_content_id AND user_id = uid) THEN
    DELETE FROM public.circle_content_likes WHERE content_id = p_content_id AND user_id = uid;
    UPDATE public.circle_contents SET like_count = GREATEST(like_count - 1, 0), updated_at = now() WHERE id = p_content_id;
    liked := false;
  ELSE
    INSERT INTO public.circle_content_likes (content_id, user_id) VALUES (p_content_id, uid);
    UPDATE public.circle_contents SET like_count = like_count + 1, updated_at = now() WHERE id = p_content_id;
    liked := true;
  END IF;
  RETURN liked;
END;
$$;
