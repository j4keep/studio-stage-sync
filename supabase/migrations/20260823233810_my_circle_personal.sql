-- My Circle: personal circles — every user gets exactly one auto-provisioned "My
-- Circle" (their own gated fan space, distinct from the group Circles they can
-- additionally create), reached from the "My Circle" icon on their posts/profile.

ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

-- One personal circle per owner.
CREATE UNIQUE INDEX IF NOT EXISTS circles_one_personal_per_owner
  ON public.circles (owner_id) WHERE is_personal = true;

-- Whoever taps a "My Circle" icon first needs to be able to lazily provision the
-- *target* person's personal circle even when they aren't that person — e.g. viewing
-- someone else's post before that person has ever opened their own My Circle. The
-- normal "Users create circles" INSERT policy requires auth.uid() = owner_id, so a
-- plain client-side insert would be rejected here; this SECURITY DEFINER function does
-- the find-or-create atomically and is the only way personal circles get created for
-- anyone other than the caller themselves.
CREATE OR REPLACE FUNCTION public.get_or_create_personal_circle(p_user_id uuid, p_display_name text DEFAULT NULL)
RETURNS public.circles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_circle public.circles;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT * INTO v_circle FROM public.circles WHERE owner_id = p_user_id AND is_personal = true;
  IF FOUND THEN
    RETURN v_circle;
  END IF;

  INSERT INTO public.circles (owner_id, type, name, is_private, is_discoverable, requires_approval, is_personal, default_post_visibility)
  VALUES (
    p_user_id, 'private',
    CASE WHEN p_display_name IS NOT NULL AND length(trim(p_display_name)) > 0 THEN p_display_name || '''s Circle' ELSE 'My Circle' END,
    true, true, true, true, 'circle_members'
  )
  ON CONFLICT (owner_id) WHERE is_personal = true DO NOTHING
  RETURNING * INTO v_circle;

  IF v_circle.id IS NULL THEN
    -- Lost a create race against a concurrent call — read back the winner's row.
    SELECT * INTO v_circle FROM public.circles WHERE owner_id = p_user_id AND is_personal = true;
  END IF;

  RETURN v_circle;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_personal_circle(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_personal_circle(uuid, text) TO authenticated;
