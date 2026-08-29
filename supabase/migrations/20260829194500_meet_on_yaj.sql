-- Meet on YAJ — adult dating profiles + interview requests

CREATE TABLE IF NOT EXISTS public.meet_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  headline TEXT,
  bio TEXT,
  birth_year INTEGER,
  gender TEXT,
  looking_for TEXT,
  city TEXT,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  interests TEXT[] NOT NULL DEFAULT '{}',
  prompt_question TEXT,
  prompt_answer TEXT,
  open_to_interview BOOLEAN NOT NULL DEFAULT true,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meet_profiles_visible_idx
  ON public.meet_profiles (is_visible)
  WHERE is_visible = true;

CREATE INDEX IF NOT EXISTS meet_profiles_city_idx
  ON public.meet_profiles (city)
  WHERE is_visible = true;

ALTER TABLE public.meet_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meet_profiles_select_visible_or_own" ON public.meet_profiles;
CREATE POLICY "meet_profiles_select_visible_or_own"
  ON public.meet_profiles FOR SELECT TO authenticated
  USING (is_visible = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "meet_profiles_insert_own" ON public.meet_profiles;
CREATE POLICY "meet_profiles_insert_own"
  ON public.meet_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meet_profiles_update_own" ON public.meet_profiles;
CREATE POLICY "meet_profiles_update_own"
  ON public.meet_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meet_profiles_delete_own" ON public.meet_profiles;
CREATE POLICY "meet_profiles_delete_own"
  ON public.meet_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_meet_profiles_updated_at ON public.meet_profiles;
CREATE TRIGGER update_meet_profiles_updated_at
  BEFORE UPDATE ON public.meet_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.meet_interview_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS meet_interview_to_idx
  ON public.meet_interview_requests (to_user_id, status);

CREATE INDEX IF NOT EXISTS meet_interview_from_idx
  ON public.meet_interview_requests (from_user_id, status);

ALTER TABLE public.meet_interview_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meet_interview_select_participants" ON public.meet_interview_requests;
CREATE POLICY "meet_interview_select_participants"
  ON public.meet_interview_requests FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "meet_interview_insert_own" ON public.meet_interview_requests;
CREATE POLICY "meet_interview_insert_own"
  ON public.meet_interview_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id AND from_user_id <> to_user_id);

DROP POLICY IF EXISTS "meet_interview_update_participants" ON public.meet_interview_requests;
CREATE POLICY "meet_interview_update_participants"
  ON public.meet_interview_requests FOR UPDATE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP TRIGGER IF EXISTS update_meet_interview_requests_updated_at ON public.meet_interview_requests;
CREATE TRIGGER update_meet_interview_requests_updated_at
  BEFORE UPDATE ON public.meet_interview_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meet_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.meet_interview_requests TO authenticated;
