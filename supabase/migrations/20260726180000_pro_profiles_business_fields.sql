-- Local Help business profile fields (handyman / services accounts)
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS business_hours text,
  ADD COLUMN IF NOT EXISTS certifications text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS insurance_note text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
