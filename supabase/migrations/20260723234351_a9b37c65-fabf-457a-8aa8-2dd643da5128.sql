
ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS qualifications text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS external_apply_url text;

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS employment_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS application_skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS desired_position text,
  ADD COLUMN IF NOT EXISTS target_pay_rate text,
  ADD COLUMN IF NOT EXISTS available_start_date date,
  ADD COLUMN IF NOT EXISTS shift_preference text,
  ADD COLUMN IF NOT EXISTS references_json jsonb DEFAULT '[]'::jsonb;
