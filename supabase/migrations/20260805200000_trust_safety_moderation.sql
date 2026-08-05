-- Trust & Safety: warnings, cooldowns, timeouts, bans, appeals, audit history.

-- 1) Profile moderation state
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active'
    CHECK (moderation_status IN ('active', 'warned', 'cooldown', 'timeout', 'suspended', 'banned')),
  ADD COLUMN IF NOT EXISTS moderation_until timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_offense_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moderation_public_note text;

CREATE INDEX IF NOT EXISTS profiles_moderation_status_idx
  ON public.profiles (moderation_status)
  WHERE moderation_status <> 'active';

-- 2) Immutable-ish action log
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'warning',
    'cooldown_24h',
    'timeout_3d',
    'timeout_7d',
    'suspend',
    'ban',
    'restore',
    'note'
  )),
  reason text NOT NULL,
  details text,
  duration_hours integer,
  ends_at timestamptz,
  offense_number integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_actions_target_idx
  ON public.moderation_actions (target_user_id, created_at DESC);

GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own moderation history" ON public.moderation_actions;
DROP POLICY IF EXISTS "Admins manage moderation actions" ON public.moderation_actions;

CREATE POLICY "Users view own moderation history"
  ON public.moderation_actions FOR SELECT TO authenticated
  USING (
    auth.uid() = target_user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins insert moderation actions"
  ON public.moderation_actions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- 3) Appeals (Customer Relations can also see these)
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'approved', 'denied')),
  message text NOT NULL,
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

CREATE INDEX IF NOT EXISTS moderation_appeals_status_idx
  ON public.moderation_appeals (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.moderation_appeals TO authenticated;
GRANT ALL ON public.moderation_appeals TO service_role;
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own appeals" ON public.moderation_appeals;
DROP POLICY IF EXISTS "Users insert own appeals" ON public.moderation_appeals;
DROP POLICY IF EXISTS "Users view own appeals" ON public.moderation_appeals;
DROP POLICY IF EXISTS "Users update own open appeals" ON public.moderation_appeals;
DROP POLICY IF EXISTS "Admins manage appeals" ON public.moderation_appeals;

CREATE POLICY "Users insert own appeals"
  ON public.moderation_appeals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own appeals"
  ON public.moderation_appeals FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins update appeals"
  ON public.moderation_appeals FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- 4) Apply moderation (admin/moderator only)
CREATE OR REPLACE FUNCTION public.apply_moderation_action(
  p_target_user_id uuid,
  p_action_type text,
  p_reason text,
  p_details text DEFAULT NULL,
  p_duration_hours integer DEFAULT NULL
)
RETURNS public.moderation_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  offense integer;
  ends timestamptz;
  hours integer := p_duration_hours;
  new_status text;
  row public.moderation_actions;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'moderator')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  SELECT coalesce(moderation_offense_count, 0) INTO offense
  FROM public.profiles
  WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF p_action_type = 'warning' THEN
    offense := offense + 1;
    new_status := 'warned';
    ends := NULL;
    hours := NULL;
  ELSIF p_action_type = 'cooldown_24h' THEN
    offense := offense + 1;
    new_status := 'cooldown';
    hours := coalesce(hours, 24);
    ends := now() + make_interval(hours => hours);
  ELSIF p_action_type = 'timeout_3d' THEN
    offense := offense + 1;
    new_status := 'timeout';
    hours := coalesce(hours, 72);
    ends := now() + make_interval(hours => hours);
  ELSIF p_action_type = 'timeout_7d' THEN
    offense := offense + 1;
    new_status := 'timeout';
    hours := coalesce(hours, 168);
    ends := now() + make_interval(hours => hours);
  ELSIF p_action_type = 'suspend' THEN
    offense := offense + 1;
    new_status := 'suspended';
    ends := NULL;
    hours := NULL;
  ELSIF p_action_type = 'ban' THEN
    offense := offense + 1;
    new_status := 'banned';
    ends := NULL;
    hours := NULL;
  ELSIF p_action_type = 'restore' THEN
    new_status := 'active';
    ends := NULL;
    hours := NULL;
  ELSIF p_action_type = 'note' THEN
    INSERT INTO public.moderation_actions (
      target_user_id, actor_id, action_type, reason, details, duration_hours, ends_at, offense_number
    ) VALUES (
      p_target_user_id, uid, 'note', trim(p_reason), p_details, NULL, NULL, offense
    )
    RETURNING * INTO row;
    RETURN row;
  ELSE
    RAISE EXCEPTION 'invalid action_type';
  END IF;

  UPDATE public.profiles
  SET
    moderation_status = new_status,
    moderation_until = ends,
    moderation_reason = CASE
      WHEN p_action_type = 'restore' THEN NULL
      ELSE trim(p_reason)
    END,
    moderation_offense_count = offense,
    moderation_public_note = CASE
      WHEN p_action_type = 'restore' THEN NULL
      ELSE coalesce(p_details, moderation_public_note)
    END,
    updated_at = now()
  WHERE user_id = p_target_user_id;

  INSERT INTO public.moderation_actions (
    target_user_id, actor_id, action_type, reason, details, duration_hours, ends_at, offense_number
  ) VALUES (
    p_target_user_id, uid, p_action_type, trim(p_reason), p_details, hours, ends, offense
  )
  RETURNING * INTO row;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_moderation_action(uuid, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_moderation_action(uuid, text, text, text, integer)
  TO authenticated, service_role;

-- 5) Auto-expire timed restrictions when the user (or admin) checks status
CREATE OR REPLACE FUNCTION public.refresh_moderation_status(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  moderation_status text,
  moderation_until timestamptz,
  moderation_reason text,
  moderation_offense_count integer,
  moderation_public_note text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := coalesce(p_user_id, auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF uid IS DISTINCT FROM auth.uid()
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH expired AS (
    UPDATE public.profiles p
    SET
      moderation_status = 'active',
      moderation_until = NULL,
      moderation_reason = NULL,
      moderation_public_note = NULL,
      updated_at = now()
    WHERE p.user_id = uid
      AND p.moderation_status IN ('cooldown', 'timeout')
      AND p.moderation_until IS NOT NULL
      AND p.moderation_until <= now()
    RETURNING p.user_id, p.moderation_offense_count
  )
  INSERT INTO public.moderation_actions (
    target_user_id, actor_id, action_type, reason, details, offense_number
  )
  SELECT
    e.user_id,
    NULL,
    'restore',
    'Automatic restore',
    'Community Timeout expired — account restored',
    coalesce(e.moderation_offense_count, 0)
  FROM expired e;

  RETURN QUERY
  SELECT
    p.moderation_status,
    p.moderation_until,
    p.moderation_reason,
    p.moderation_offense_count,
    p.moderation_public_note
  FROM public.profiles p
  WHERE p.user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_moderation_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_moderation_status(uuid) TO authenticated, service_role;

-- Suggested next action from offense count (client can also compute)
CREATE OR REPLACE FUNCTION public.suggested_moderation_action(p_offense_count integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_offense_count, 0) <= 0 THEN 'warning'
    WHEN p_offense_count = 1 THEN 'cooldown_24h'
    WHEN p_offense_count = 2 THEN 'timeout_3d'
    WHEN p_offense_count = 3 THEN 'timeout_7d'
    ELSE 'ban'
  END
$$;

GRANT EXECUTE ON FUNCTION public.suggested_moderation_action(integer) TO authenticated, service_role;
