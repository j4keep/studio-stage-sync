
-- EMPLOYER PROFILES
CREATE TABLE public.employer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_name text NOT NULL,
  logo_url text,
  description text,
  website text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employer_profiles TO authenticated;
GRANT SELECT ON public.employer_profiles TO anon;
GRANT ALL ON public.employer_profiles TO service_role;
ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employer_profiles readable by all" ON public.employer_profiles FOR SELECT USING (true);
CREATE POLICY "employer_profiles owner writes" ON public.employer_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER employer_profiles_updated BEFORE UPDATE ON public.employer_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- JOB LISTINGS
CREATE TABLE public.job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  employment_type text NOT NULL DEFAULT 'full_time',
  salary_min numeric,
  salary_max numeric,
  salary_currency text DEFAULT 'USD',
  location text,
  remote_mode text DEFAULT 'onsite',
  skills text[] DEFAULT '{}',
  education text,
  experience_level text DEFAULT 'mid',
  benefits text[] DEFAULT '{}',
  deadline date,
  media jsonb DEFAULT '[]'::jsonb,
  video_url text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_listings TO authenticated;
GRANT SELECT ON public.job_listings TO anon;
GRANT ALL ON public.job_listings TO service_role;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_listings public read open" ON public.job_listings FOR SELECT USING (status = 'open' OR auth.uid() = employer_id);
CREATE POLICY "job_listings owner insert" ON public.job_listings FOR INSERT WITH CHECK (auth.uid() = employer_id);
CREATE POLICY "job_listings owner update" ON public.job_listings FOR UPDATE USING (auth.uid() = employer_id);
CREATE POLICY "job_listings owner delete" ON public.job_listings FOR DELETE USING (auth.uid() = employer_id);
CREATE TRIGGER job_listings_updated BEFORE UPDATE ON public.job_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX job_listings_category_idx ON public.job_listings(category);
CREATE INDEX job_listings_created_idx ON public.job_listings(created_at DESC);

-- GIG LISTINGS
CREATE TABLE public.gig_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  location text,
  budget_min numeric,
  budget_max numeric,
  currency text DEFAULT 'USD',
  urgency text DEFAULT 'flexible',
  preferred_date date,
  preferred_time text,
  media jsonb DEFAULT '[]'::jsonb,
  ai_estimate jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_listings TO authenticated;
GRANT SELECT ON public.gig_listings TO anon;
GRANT ALL ON public.gig_listings TO service_role;
ALTER TABLE public.gig_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gig_listings public read open" ON public.gig_listings FOR SELECT USING (status = 'open' OR auth.uid() = poster_id);
CREATE POLICY "gig_listings owner insert" ON public.gig_listings FOR INSERT WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "gig_listings owner update" ON public.gig_listings FOR UPDATE USING (auth.uid() = poster_id);
CREATE POLICY "gig_listings owner delete" ON public.gig_listings FOR DELETE USING (auth.uid() = poster_id);
CREATE TRIGGER gig_listings_updated BEFORE UPDATE ON public.gig_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX gig_listings_category_idx ON public.gig_listings(category);
CREATE INDEX gig_listings_created_idx ON public.gig_listings(created_at DESC);

-- RESUMES
CREATE TABLE public.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'upload',
  file_url text,
  structured_data jsonb,
  visibility text NOT NULL DEFAULT 'private',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resumes TO authenticated;
GRANT ALL ON public.resumes TO service_role;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resumes owner all" ON public.resumes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resumes public if visible" ON public.resumes FOR SELECT USING (visibility = 'public');
CREATE TRIGGER resumes_updated BEFORE UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- JOB APPLICATIONS
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL,
  resume_id uuid REFERENCES public.resumes(id) ON DELETE SET NULL,
  cover_letter text,
  status text NOT NULL DEFAULT 'applied',
  anonymous_mode boolean NOT NULL DEFAULT false,
  employer_accepted boolean NOT NULL DEFAULT false,
  applicant_accepted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications applicant read" ON public.job_applications FOR SELECT USING (auth.uid() = applicant_id OR auth.uid() IN (SELECT employer_id FROM public.job_listings WHERE id = job_id));
CREATE POLICY "applications applicant insert" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "applications applicant update" ON public.job_applications FOR UPDATE USING (auth.uid() = applicant_id OR auth.uid() IN (SELECT employer_id FROM public.job_listings WHERE id = job_id));
CREATE POLICY "applications applicant delete" ON public.job_applications FOR DELETE USING (auth.uid() = applicant_id);
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- JOB PREFERENCES
CREATE TABLE public.job_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  titles text[] DEFAULT '{}',
  categories text[] DEFAULT '{}',
  locations text[] DEFAULT '{}',
  radius integer DEFAULT 25,
  remote_ok boolean DEFAULT true,
  hybrid_ok boolean DEFAULT true,
  onsite_ok boolean DEFAULT true,
  employment_types text[] DEFAULT '{}',
  salary_expect numeric,
  availability text DEFAULT 'open',
  experience_level text DEFAULT 'mid',
  alert_keywords text[] DEFAULT '{}',
  notify_frequency text DEFAULT 'instant',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_preferences TO authenticated;
GRANT ALL ON public.job_preferences TO service_role;
ALTER TABLE public.job_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs owner all" ON public.job_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER prefs_updated BEFORE UPDATE ON public.job_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SAVED JOBS
CREATE TABLE public.saved_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_jobs TO authenticated;
GRANT ALL ON public.saved_jobs TO service_role;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved owner all" ON public.saved_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
