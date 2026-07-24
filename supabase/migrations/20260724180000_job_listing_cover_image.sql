-- Per-job header/cover image (not shared across all of an employer's posts)
ALTER TABLE public.job_listings
  ADD COLUMN IF NOT EXISTS cover_image_url text;
