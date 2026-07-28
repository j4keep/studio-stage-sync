-- Phase 1 gap: job_listings.visibility (public | unlisted)
-- Public-read stays open + public; owners still see their own listings.

ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_listings_visibility_check'
  ) THEN
    ALTER TABLE public.job_listings
      ADD CONSTRAINT job_listings_visibility_check
      CHECK (visibility IN ('public', 'unlisted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_listings_visibility_idx
  ON public.job_listings (visibility);

-- Refresh public-read policy so unlisted jobs are owner-only (plus applicant read policies stay).
DROP POLICY IF EXISTS "job_listings public read open" ON public.job_listings;
CREATE POLICY "job_listings public read open"
  ON public.job_listings FOR SELECT
  USING (
    auth.uid() = employer_id
    OR (status = 'open' AND visibility = 'public')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_listings TO authenticated;
GRANT SELECT ON public.job_listings TO anon;
GRANT ALL ON public.job_listings TO service_role;
