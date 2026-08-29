-- YAJ Safety & Balance: central account safety policy (Youth Mode + Digital Balance)

CREATE TABLE IF NOT EXISTS public.account_safety_policies (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  age_band TEXT NOT NULL DEFAULT 'unknown'
    CHECK (age_band IN ('under_13', 'teen', 'adult', 'unknown')),
  youth_mode BOOLEAN NOT NULL DEFAULT false,
  youth_welcome_seen_at TIMESTAMPTZ,
  daily_social_limit_minutes INTEGER,
  social_minutes_used_today INTEGER NOT NULL DEFAULT 0,
  social_usage_date DATE,
  continuous_reminder_minutes INTEGER,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  parent_account_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_link_code TEXT,
  parent_link_code_expires_at TIMESTAMPTZ,
  profile_privacy TEXT NOT NULL DEFAULT 'public'
    CHECK (profile_privacy IN ('public', 'private')),
  dm_permission TEXT NOT NULL DEFAULT 'everyone'
    CHECK (dm_permission IN ('everyone', 'friends', 'friends_and_approved', 'none')),
  location_permission TEXT NOT NULL DEFAULT 'off'
    CHECK (location_permission IN ('off', 'approximate', 'precise')),
  detox_until TIMESTAMPTZ,
  games_daily_limit_minutes INTEGER,
  dating_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_safety_policies_parent_idx
  ON public.account_safety_policies (parent_account_id)
  WHERE parent_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS account_safety_policies_link_code_idx
  ON public.account_safety_policies (parent_link_code)
  WHERE parent_link_code IS NOT NULL;

ALTER TABLE public.account_safety_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safety_policy_select_own_or_parent" ON public.account_safety_policies;
CREATE POLICY "safety_policy_select_own_or_parent"
  ON public.account_safety_policies FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = parent_account_id
  );

DROP POLICY IF EXISTS "safety_policy_insert_own" ON public.account_safety_policies;
CREATE POLICY "safety_policy_insert_own"
  ON public.account_safety_policies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "safety_policy_update_own_or_parent" ON public.account_safety_policies;
CREATE POLICY "safety_policy_update_own_or_parent"
  ON public.account_safety_policies FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = parent_account_id
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = parent_account_id
  );

DROP TRIGGER IF EXISTS update_account_safety_policies_updated_at ON public.account_safety_policies;
CREATE TRIGGER update_account_safety_policies_updated_at
  BEFORE UPDATE ON public.account_safety_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Age helpers (server-side) for signup trigger
CREATE OR REPLACE FUNCTION public.yaj_age_from_dob(dob DATE)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN dob IS NULL THEN NULL
    ELSE (
      EXTRACT(YEAR FROM age(CURRENT_DATE, dob))
    )::INTEGER
  END;
$$;

CREATE OR REPLACE FUNCTION public.yaj_age_band_from_dob(dob DATE)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN dob IS NULL THEN 'unknown'
    WHEN public.yaj_age_from_dob(dob) < 13 THEN 'under_13'
    WHEN public.yaj_age_from_dob(dob) < 18 THEN 'teen'
    ELSE 'adult'
  END;
$$;

-- Ensure every new user gets a safety policy; apply Youth defaults from DOB metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display TEXT;
  v_dob DATE;
  v_band TEXT;
  v_youth BOOLEAN;
BEGIN
  v_display := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  BEGIN
    v_dob := NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::DATE;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

  v_band := public.yaj_age_band_from_dob(v_dob);
  v_youth := (v_band = 'teen');

  INSERT INTO public.profiles (id, user_id, display_name, email)
  VALUES (NEW.id, NEW.id, v_display, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.account_safety_policies (
    user_id,
    date_of_birth,
    age_band,
    youth_mode,
    daily_social_limit_minutes,
    continuous_reminder_minutes,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end,
    profile_privacy,
    dm_permission,
    location_permission,
    dating_allowed
  ) VALUES (
    NEW.id,
    v_dob,
    v_band,
    v_youth,
    CASE WHEN v_youth THEN 90 ELSE NULL END,
    CASE WHEN v_youth THEN 45 ELSE NULL END,
    v_youth,
    CASE WHEN v_youth THEN TIME '22:00' ELSE NULL END,
    CASE WHEN v_youth THEN TIME '06:00' ELSE NULL END,
    CASE WHEN v_youth THEN 'private' ELSE 'public' END,
    CASE WHEN v_youth THEN 'friends_and_approved' ELSE 'everyone' END,
    'off',
    NOT v_youth AND v_band <> 'under_13'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Parent claims teen via invite code (does not expose private messages)
CREATE OR REPLACE FUNCTION public.link_parent_to_teen(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teen UUID;
  v_parent UUID := auth.uid();
BEGIN
  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_teen
  FROM public.account_safety_policies
  WHERE upper(parent_link_code) = upper(trim(p_code))
    AND parent_link_code_expires_at > now()
    AND youth_mode = true
  LIMIT 1;

  IF v_teen IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired parent code';
  END IF;

  IF v_teen = v_parent THEN
    RAISE EXCEPTION 'Cannot link to your own account';
  END IF;

  UPDATE public.account_safety_policies
  SET
    parent_account_id = v_parent,
    parent_link_code = NULL,
    parent_link_code_expires_at = NULL,
    updated_at = now()
  WHERE user_id = v_teen;

  RETURN v_teen;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_parent_to_teen(TEXT) TO authenticated;

-- Age-band lookup for DM restrictions (authenticated peers only)
CREATE OR REPLACE FUNCTION public.get_peer_age_band(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT age_band FROM public.account_safety_policies WHERE user_id = p_user_id),
    'unknown'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_peer_age_band(UUID) TO authenticated;
