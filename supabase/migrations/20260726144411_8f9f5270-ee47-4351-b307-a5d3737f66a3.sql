-- 1. profiles: hide email column from public reads
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, display_name, avatar_url, banner_url, bio, created_at, updated_at, terms_accepted_at, theme_preset, custom_accent_color, background_image_url, daw_shortcuts, country_flag, hide_yaj_page_on_gigs, gig_experience_bio) ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2. users: only own row readable
DROP POLICY IF EXISTS "users_read_all" ON public.users;
CREATE POLICY "users_read_self" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);

-- 3. user_reputation_summary: writes are backend-only
DROP POLICY IF EXISTS "rep_write_auth" ON public.user_reputation_summary;
REVOKE INSERT, UPDATE, DELETE ON public.user_reputation_summary FROM anon, authenticated;
GRANT ALL ON public.user_reputation_summary TO service_role;

-- 4. studio_bookings: remove blanket read, add safe session-code lookup
DROP POLICY IF EXISTS "Users can look up bookings by session code" ON public.studio_bookings;

CREATE OR REPLACE FUNCTION public.lookup_booking_by_session_code(_code text)
RETURNS TABLE (id uuid, session_code text, session_status text, studio_id uuid, hours integer, user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.session_code, b.session_status, b.studio_id, b.hours, b.user_id
  FROM public.studio_bookings b
  WHERE auth.uid() IS NOT NULL
    AND b.session_code = upper(_code)
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.lookup_booking_by_session_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_booking_by_session_code(text) TO authenticated, service_role;

-- 5. no_show_strikes: scoped reads
DROP POLICY IF EXISTS "Anyone can view no-show strikes" ON public.no_show_strikes;
CREATE POLICY "Involved parties can view no-show strikes" ON public.no_show_strikes
FOR SELECT TO authenticated
USING (
  auth.uid() = reported_by
  OR booking_id IN (SELECT id FROM public.studio_bookings WHERE user_id = auth.uid())
  OR studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid())
);

-- 6. fundraiser_donations: donor + campaign owner only
DROP POLICY IF EXISTS "fd_read_auth" ON public.fundraiser_donations;
CREATE POLICY "fd_read_scoped" ON public.fundraiser_donations
FOR SELECT TO authenticated
USING (
  auth.uid() = donor_user_id
  OR campaign_id IN (SELECT id FROM public.fundraiser_campaigns WHERE user_id = auth.uid())
);

-- 7. savings circles: members/owners only
CREATE OR REPLACE FUNCTION public.is_circle_member(_circle_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.savings_circle_members m
    WHERE m.circle_id = _circle_id AND m.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.savings_circles c
    WHERE c.id = _circle_id AND c.owner_id = _user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "circles_read_auth" ON public.savings_circles;
CREATE POLICY "circles_read_members" ON public.savings_circles
FOR SELECT TO authenticated
USING (auth.uid() = owner_id OR public.is_circle_member(id, auth.uid()));

DROP POLICY IF EXISTS "members_read_auth" ON public.savings_circle_members;
CREATE POLICY "members_read_members" ON public.savings_circle_members
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_circle_member(circle_id, auth.uid()));

DROP POLICY IF EXISTS "periods_read_auth" ON public.savings_circle_periods;
CREATE POLICY "periods_read_members" ON public.savings_circle_periods
FOR SELECT TO authenticated
USING (public.is_circle_member(circle_id, auth.uid()));

DROP POLICY IF EXISTS "payments_read_auth" ON public.savings_circle_payments;
CREATE POLICY "payments_read_members" ON public.savings_circle_payments
FOR SELECT TO authenticated
USING (public.is_circle_member(circle_id, auth.uid()));

DROP POLICY IF EXISTS "cd_read_auth" ON public.savings_circle_donations;
CREATE POLICY "cd_read_members" ON public.savings_circle_donations
FOR SELECT TO authenticated
USING (public.is_circle_member(circle_id, auth.uid()));

-- 8. remove always-true write checks on circle finance tables
DROP POLICY IF EXISTS "payments_write" ON public.savings_circle_payments;
CREATE POLICY "payments_write_members" ON public.savings_circle_payments
FOR ALL TO authenticated
USING (public.is_circle_member(circle_id, auth.uid()))
WITH CHECK (public.is_circle_member(circle_id, auth.uid()));

DROP POLICY IF EXISTS "periods_write" ON public.savings_circle_periods;
CREATE POLICY "periods_write_members" ON public.savings_circle_periods
FOR ALL TO authenticated
USING (public.is_circle_member(circle_id, auth.uid()))
WITH CHECK (public.is_circle_member(circle_id, auth.uid()));