-- 1) game_stats: authenticated-only reads
DROP POLICY IF EXISTS "Anyone views game stats" ON public.game_stats;
CREATE POLICY "Authenticated users view game stats"
ON public.game_stats FOR SELECT TO authenticated USING (true);

-- 2) live_sessions: creator or participant only
CREATE OR REPLACE FUNCTION public.is_live_session_member(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_sessions s WHERE s.id = _session_id AND s.created_by = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.live_session_participants p
    WHERE p.live_session_id = _session_id AND p.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Authenticated can select live_sessions" ON public.live_sessions;
CREATE POLICY "Members can select live_sessions"
ON public.live_sessions FOR SELECT TO authenticated
USING (public.is_live_session_member(id, auth.uid()));

-- Secure code-based lookup so invited guests can resolve a session id from a code they hold
CREATE OR REPLACE FUNCTION public.lookup_live_session_by_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id FROM public.live_sessions s
  WHERE upper(s.session_code) = upper(_code)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.lookup_live_session_by_code(text) TO authenticated;

-- 3) profiles.email: only the owner can read the email column
REVOKE SELECT (email) ON public.profiles FROM anon;
REVOKE SELECT (email) ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.my_profile_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.my_profile_email() TO authenticated;