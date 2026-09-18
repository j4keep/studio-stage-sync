
-- =========================================================
-- Shared Circle content storage
-- =========================================================
CREATE TABLE IF NOT EXISTS public.circle_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'post',
  activity_type text NOT NULL DEFAULT 'photo',
  title text,
  body text,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_type text NOT NULL DEFAULT 'none',
  visibility text NOT NULL DEFAULT 'circle_members',
  donations_enabled boolean NOT NULL DEFAULT true,
  like_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  event_at timestamptz,
  event_end_at timestamptz,
  event_location text,
  event_online_url text,
  event_capacity integer,
  event_ticket_cents integer,
  event_reminders boolean NOT NULL DEFAULT false,
  community_subtype text,
  poll_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_contents_circle_idx ON public.circle_contents(circle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS circle_contents_author_idx ON public.circle_contents(author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_contents TO authenticated;
GRANT ALL ON public.circle_contents TO service_role;
ALTER TABLE public.circle_contents ENABLE ROW LEVEL SECURITY;

-- Does the viewer follow the owner of this circle (either follow table)?
CREATE OR REPLACE FUNCTION public.yaj_follows_circle_owner(_circle_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = _circle_id
      AND (
        EXISTS (SELECT 1 FROM public.followers f WHERE f.follower_id = _user_id AND f.following_id = c.owner_id)
        OR EXISTS (SELECT 1 FROM public.follows f2 WHERE f2.follower_id = _user_id AND f2.following_id = c.owner_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.yaj_circle_is_public(_circle_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.circles c WHERE c.id = _circle_id AND COALESCE(c.is_private,false) = false)
$$;

CREATE OR REPLACE FUNCTION public.yaj_circle_owner(_circle_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id FROM public.circles WHERE id = _circle_id
$$;

-- Can the viewer read this specific piece of circle content?
CREATE OR REPLACE FUNCTION public.yaj_can_view_circle_content(_content_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.circle_contents; is_member boolean; is_admin boolean; is_owner boolean;
BEGIN
  SELECT * INTO r FROM public.circle_contents WHERE id = _content_id;
  IF r.id IS NULL OR _user_id IS NULL THEN RETURN false; END IF;
  IF r.author_id = _user_id THEN RETURN true; END IF;
  IF r.visibility = 'only_me' THEN RETURN false; END IF;

  is_owner := public.yaj_circle_owner(r.circle_id) = _user_id;
  is_admin := public.is_social_circle_admin(r.circle_id, _user_id);
  is_member := public.is_social_circle_member(r.circle_id, _user_id);

  IF r.visibility = 'paid_members' THEN
    RETURN is_owner OR is_admin OR EXISTS (
      SELECT 1 FROM public.circle_members m
      WHERE m.circle_id = r.circle_id AND m.user_id = _user_id
        AND m.status = 'approved' AND m.role IN ('paid_member','owner','admin')
    );
  END IF;

  RETURN is_owner
    OR is_admin
    OR is_member
    OR public.yaj_circle_is_public(r.circle_id)
    OR public.yaj_follows_circle_owner(r.circle_id, _user_id);
END;
$$;

CREATE POLICY "View circle contents"
ON public.circle_contents FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR (
    visibility <> 'only_me'
    AND (
      public.yaj_circle_owner(circle_id) = auth.uid()
      OR public.is_social_circle_admin(circle_id, auth.uid())
      OR public.is_social_circle_member(circle_id, auth.uid())
      OR public.yaj_circle_is_public(circle_id)
      OR public.yaj_follows_circle_owner(circle_id, auth.uid())
    )
    AND (
      visibility <> 'paid_members'
      OR public.yaj_circle_owner(circle_id) = auth.uid()
      OR public.is_social_circle_admin(circle_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.circle_members m
        WHERE m.circle_id = circle_contents.circle_id AND m.user_id = auth.uid()
          AND m.status = 'approved' AND m.role IN ('paid_member','owner','admin')
      )
    )
  )
);

CREATE POLICY "Create circle contents"
ON public.circle_contents FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.yaj_circle_owner(circle_id) = auth.uid()
    OR public.is_social_circle_member(circle_id, auth.uid())
    OR public.is_social_circle_admin(circle_id, auth.uid())
    OR public.yaj_circle_is_public(circle_id)
  )
);

CREATE POLICY "Edit own circle contents"
ON public.circle_contents FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.yaj_circle_owner(circle_id) = auth.uid())
WITH CHECK (author_id = auth.uid() OR public.yaj_circle_owner(circle_id) = auth.uid());

CREATE POLICY "Delete own circle contents"
ON public.circle_contents FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.yaj_circle_owner(circle_id) = auth.uid());

-- =========================================================
-- Engagement tables
-- =========================================================
CREATE TABLE IF NOT EXISTS public.circle_content_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_content_likes TO authenticated;
GRANT ALL ON public.circle_content_likes TO service_role;
ALTER TABLE public.circle_content_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View circle content likes" ON public.circle_content_likes FOR SELECT TO authenticated
USING (public.yaj_can_view_circle_content(content_id, auth.uid()));
CREATE POLICY "Like circle content" ON public.circle_content_likes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.yaj_can_view_circle_content(content_id, auth.uid()));
CREATE POLICY "Unlike circle content" ON public.circle_content_likes FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.circle_content_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_content_comments TO authenticated;
GRANT ALL ON public.circle_content_comments TO service_role;
ALTER TABLE public.circle_content_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View circle content comments" ON public.circle_content_comments FOR SELECT TO authenticated
USING (public.yaj_can_view_circle_content(content_id, auth.uid()));
CREATE POLICY "Add circle content comments" ON public.circle_content_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.yaj_can_view_circle_content(content_id, auth.uid()));
CREATE POLICY "Delete own circle content comments" ON public.circle_content_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.circle_content_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_content_rsvps TO authenticated;
GRANT ALL ON public.circle_content_rsvps TO service_role;
ALTER TABLE public.circle_content_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View circle rsvps" ON public.circle_content_rsvps FOR SELECT TO authenticated
USING (public.yaj_can_view_circle_content(content_id, auth.uid()));
CREATE POLICY "Set own circle rsvp" ON public.circle_content_rsvps FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.yaj_can_view_circle_content(content_id, auth.uid()));
CREATE POLICY "Update own circle rsvp" ON public.circle_content_rsvps FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Remove own circle rsvp" ON public.circle_content_rsvps FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.circle_content_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_content_poll_votes TO authenticated;
GRANT ALL ON public.circle_content_poll_votes TO service_role;
ALTER TABLE public.circle_content_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View circle poll votes" ON public.circle_content_poll_votes FOR SELECT TO authenticated
USING (public.yaj_can_view_circle_content(content_id, auth.uid()));
CREATE POLICY "Cast own circle poll vote" ON public.circle_content_poll_votes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.yaj_can_view_circle_content(content_id, auth.uid()));
CREATE POLICY "Change own circle poll vote" ON public.circle_content_poll_votes FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Remove own circle poll vote" ON public.circle_content_poll_votes FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.circle_content_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.circle_contents(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.circle_content_donations TO authenticated;
GRANT ALL ON public.circle_content_donations TO service_role;
ALTER TABLE public.circle_content_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or received donations" ON public.circle_content_donations FOR SELECT TO authenticated
USING (
  from_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.circle_contents c WHERE c.id = content_id AND c.author_id = auth.uid())
);
CREATE POLICY "Send circle donation" ON public.circle_content_donations FOR INSERT TO authenticated
WITH CHECK (from_user_id = auth.uid() AND public.yaj_can_view_circle_content(content_id, auth.uid()));

-- =========================================================
-- Feed RPCs used by the app
-- =========================================================
CREATE OR REPLACE FUNCTION public.yaj_circle_home_contents(p_circle_id uuid)
RETURNS SETOF public.circle_contents
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.* FROM public.circle_contents c
  WHERE c.circle_id = p_circle_id
    AND public.yaj_can_view_circle_content(c.id, auth.uid())
  ORDER BY c.is_pinned DESC, c.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.yaj_my_circle_home_contents()
RETURNS SETOF public.circle_contents
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.* FROM public.circle_contents c
  WHERE auth.uid() IS NOT NULL
    AND c.activity_type <> 'exclusive'
    AND (
      c.author_id = auth.uid()
      OR public.yaj_circle_owner(c.circle_id) = auth.uid()
      OR public.is_social_circle_member(c.circle_id, auth.uid())
      OR public.yaj_follows_circle_owner(c.circle_id, auth.uid())
    )
    AND public.yaj_can_view_circle_content(c.id, auth.uid())
  ORDER BY c.is_pinned DESC, c.created_at DESC
  LIMIT 200
$$;

CREATE OR REPLACE FUNCTION public.yaj_upsert_circle_content(p_row jsonb)
RETURNS public.circle_contents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.circle_contents; v_circle uuid; v_author uuid;
BEGIN
  v_circle := (p_row->>'circle_id')::uuid;
  v_author := (p_row->>'author_id')::uuid;
  IF auth.uid() IS NULL OR v_author IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NOT (
    public.yaj_circle_owner(v_circle) = auth.uid()
    OR public.is_social_circle_member(v_circle, auth.uid())
    OR public.is_social_circle_admin(v_circle, auth.uid())
    OR public.yaj_circle_is_public(v_circle)
  ) THEN
    RAISE EXCEPTION 'Not a member of this circle';
  END IF;

  INSERT INTO public.circle_contents (
    id, circle_id, author_id, kind, activity_type, title, body, media_urls, media_type,
    visibility, donations_enabled, like_count, view_count, comment_count,
    event_at, event_end_at, event_location, event_online_url, event_capacity,
    event_ticket_cents, event_reminders, community_subtype, poll_options, tags,
    is_pinned, created_at, updated_at
  )
  VALUES (
    COALESCE((p_row->>'id')::uuid, gen_random_uuid()),
    v_circle, v_author,
    COALESCE(p_row->>'kind','post'),
    COALESCE(p_row->>'activity_type','photo'),
    p_row->>'title', p_row->>'body',
    COALESCE(p_row->'media_urls','[]'::jsonb),
    COALESCE(p_row->>'media_type','none'),
    COALESCE(p_row->>'visibility','circle_members'),
    COALESCE((p_row->>'donations_enabled')::boolean, true),
    COALESCE((p_row->>'like_count')::int, 0),
    COALESCE((p_row->>'view_count')::int, 0),
    COALESCE((p_row->>'comment_count')::int, 0),
    NULLIF(p_row->>'event_at','')::timestamptz,
    NULLIF(p_row->>'event_end_at','')::timestamptz,
    p_row->>'event_location', p_row->>'event_online_url',
    NULLIF(p_row->>'event_capacity','')::int,
    NULLIF(p_row->>'event_ticket_cents','')::int,
    COALESCE((p_row->>'event_reminders')::boolean, false),
    p_row->>'community_subtype',
    COALESCE(p_row->'poll_options','[]'::jsonb),
    COALESCE(p_row->'tags','[]'::jsonb),
    COALESCE((p_row->>'is_pinned')::boolean, false),
    COALESCE(NULLIF(p_row->>'created_at','')::timestamptz, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    kind = EXCLUDED.kind,
    activity_type = EXCLUDED.activity_type,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    media_urls = EXCLUDED.media_urls,
    media_type = EXCLUDED.media_type,
    visibility = EXCLUDED.visibility,
    donations_enabled = EXCLUDED.donations_enabled,
    event_at = EXCLUDED.event_at,
    event_end_at = EXCLUDED.event_end_at,
    event_location = EXCLUDED.event_location,
    event_online_url = EXCLUDED.event_online_url,
    event_capacity = EXCLUDED.event_capacity,
    event_ticket_cents = EXCLUDED.event_ticket_cents,
    event_reminders = EXCLUDED.event_reminders,
    community_subtype = EXCLUDED.community_subtype,
    poll_options = EXCLUDED.poll_options,
    tags = EXCLUDED.tags,
    is_pinned = EXCLUDED.is_pinned,
    updated_at = now()
  WHERE public.circle_contents.author_id = auth.uid()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_circle_content_like(p_content_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.yaj_can_view_circle_content(p_content_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.circle_content_likes WHERE content_id = p_content_id AND user_id = auth.uid())
  INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.circle_content_likes WHERE content_id = p_content_id AND user_id = auth.uid();
    UPDATE public.circle_contents SET like_count = GREATEST(0, like_count - 1) WHERE id = p_content_id;
    RETURN false;
  END IF;
  INSERT INTO public.circle_content_likes (content_id, user_id) VALUES (p_content_id, auth.uid());
  UPDATE public.circle_contents SET like_count = like_count + 1 WHERE id = p_content_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_circle_content_views(p_content_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.circle_contents SET view_count = view_count + 1 WHERE id = p_content_id
$$;

CREATE TRIGGER circle_contents_updated_at
BEFORE UPDATE ON public.circle_contents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
