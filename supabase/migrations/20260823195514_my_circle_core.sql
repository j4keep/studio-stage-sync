-- My Circle: private-membership circles (Milestone A — core tables + membership).
-- Unrelated to `savings_circles` (a rotating-savings-club feature that happens to share
-- the word "circle") — no tables, RLS, or code from that feature are touched or reused.

CREATE TABLE IF NOT EXISTS public.circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'custom'
    CHECK (type IN ('friends', 'local', 'gaming', 'fitness', 'networking', 'creator', 'private', 'custom')),
  name text NOT NULL,
  avatar_url text,
  cover_url text,
  description text,
  category text,
  city text,
  is_private boolean NOT NULL DEFAULT false,
  is_discoverable boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT false,
  is_paid boolean NOT NULL DEFAULT false,
  price_cents integer,
  welcome_message text,
  default_post_visibility text NOT NULL DEFAULT 'circle_members'
    CHECK (default_post_visibility IN ('everyone', 'circle_members', 'paid_members', 'selected_members', 'only_me')),
  member_posting_allowed boolean NOT NULL DEFAULT false,
  member_comments_allowed boolean NOT NULL DEFAULT true,
  member_invites_allowed boolean NOT NULL DEFAULT false,
  member_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circles_paid_needs_price CHECK (NOT is_paid OR price_cents IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS circles_owner_idx ON public.circles (owner_id);
CREATE INDEX IF NOT EXISTS circles_discoverable_idx ON public.circles (is_discoverable, type) WHERE is_discoverable = true;
CREATE INDEX IF NOT EXISTS circles_search_idx ON public.circles USING gin (
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(city,''))
);

CREATE TABLE IF NOT EXISTS public.circle_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'paid_member')),
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'blocked')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS circle_members_user_idx ON public.circle_members (user_id, status);
CREATE INDEX IF NOT EXISTS circle_members_circle_idx ON public.circle_members (circle_id, status);

-- ---------------------------------------------------------------------------
-- Helper: circle membership (needed by RLS — SECURITY DEFINER avoids recursive RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_circle_member(p_circle_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members m
    WHERE m.circle_id = p_circle_id
      AND m.user_id = p_user_id
      AND m.status = 'approved'
  )
  OR EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = p_circle_id AND c.owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_circle_admin(p_circle_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members m
    WHERE m.circle_id = p_circle_id
      AND m.user_id = p_user_id
      AND m.status = 'approved'
      AND m.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = p_circle_id AND c.owner_id = p_user_id
  )
  OR (p_user_id IS NOT NULL AND public.has_role(p_user_id, 'admin'));
$$;

-- Keep circles.member_count in sync with approved circle_members rows.
CREATE OR REPLACE FUNCTION public.sync_circle_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.circles
  SET member_count = (
    SELECT count(*) FROM public.circle_members
    WHERE circle_id = COALESCE(NEW.circle_id, OLD.circle_id) AND status = 'approved'
  )
  WHERE id = COALESCE(NEW.circle_id, OLD.circle_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS circle_members_count_trigger ON public.circle_members;
CREATE TRIGGER circle_members_count_trigger
AFTER INSERT OR UPDATE OF status OR DELETE ON public.circle_members
FOR EACH ROW EXECUTE FUNCTION public.sync_circle_member_count();

-- Owner is auto-seeded as an approved 'owner' member on circle creation.
CREATE OR REPLACE FUNCTION public.seed_circle_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.circle_members (circle_id, user_id, role, status, approved_at, approved_by)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'approved', now(), NEW.owner_id)
  ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circles_seed_owner_trigger ON public.circles;
CREATE TRIGGER circles_seed_owner_trigger
AFTER INSERT ON public.circles
FOR EACH ROW EXECUTE FUNCTION public.seed_circle_owner_member();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

-- Circles: public/discoverable circles fully visible; private circles show metadata
-- (name/cover/description/member_count) to everyone so the "request to join" welcome
-- screen works, but member-only content (posts/videos, added in a later milestone) is
-- gated separately by circle_id + is_circle_member(), not by this policy.
DROP POLICY IF EXISTS "View circles" ON public.circles;
CREATE POLICY "View circles" ON public.circles
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Users create circles" ON public.circles;
CREATE POLICY "Users create circles" ON public.circles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admins update circles" ON public.circles;
CREATE POLICY "Admins update circles" ON public.circles
  FOR UPDATE TO authenticated
  USING (public.is_circle_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Owners delete circles" ON public.circles;
CREATE POLICY "Owners delete circles" ON public.circles
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Members: a circle's own approved members (and admins) can see the roster, including
-- pending requests; a user can always see their own membership row (so they know their
-- request is still pending) but not other people's pending requests.
DROP POLICY IF EXISTS "View circle members" ON public.circle_members;
CREATE POLICY "View circle members" ON public.circle_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_circle_member(circle_id, auth.uid())
    OR public.is_circle_admin(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users request to join circles" ON public.circle_members;
CREATE POLICY "Users request to join circles" ON public.circle_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
  );

DROP POLICY IF EXISTS "Admins manage circle members" ON public.circle_members;
CREATE POLICY "Admins manage circle members" ON public.circle_members
  FOR UPDATE TO authenticated
  USING (public.is_circle_admin(circle_id, auth.uid()));

DROP POLICY IF EXISTS "Leave or admins remove circle members" ON public.circle_members;
CREATE POLICY "Leave or admins remove circle members" ON public.circle_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_circle_admin(circle_id, auth.uid()));

-- Grants
GRANT SELECT ON public.circles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.circles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_members TO authenticated;
GRANT ALL ON public.circles TO service_role;
GRANT ALL ON public.circle_members TO service_role;
