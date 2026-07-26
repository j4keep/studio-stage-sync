CREATE TABLE IF NOT EXISTS public.pro_profiles (
  user_id uuid PRIMARY KEY,
  business_name text,
  about text,
  hourly_rate numeric,
  service_area text,
  categories text[] NOT NULL DEFAULT '{}',
  project_types jsonb NOT NULL DEFAULT '{}'::jsonb,
  work_focus jsonb NOT NULL DEFAULT '{}'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills text[] NOT NULL DEFAULT '{}',
  responds_minutes integer DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  hired_count integer NOT NULL DEFAULT 0,
  similar_jobs_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pro_profiles_active_idx ON public.pro_profiles (is_active);
CREATE INDEX IF NOT EXISTS pro_profiles_categories_idx ON public.pro_profiles USING gin (categories);

GRANT SELECT ON public.pro_profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pro_profiles TO authenticated;
GRANT ALL ON public.pro_profiles TO service_role;
ALTER TABLE public.pro_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_profiles public read active" ON public.pro_profiles;
CREATE POLICY "pro_profiles public read active"
  ON public.pro_profiles FOR SELECT
  USING (is_active = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "pro_profiles owner write" ON public.pro_profiles;
CREATE POLICY "pro_profiles owner write"
  ON public.pro_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_pro_profiles_updated_at ON public.pro_profiles;
CREATE TRIGGER update_pro_profiles_updated_at
  BEFORE UPDATE ON public.pro_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();