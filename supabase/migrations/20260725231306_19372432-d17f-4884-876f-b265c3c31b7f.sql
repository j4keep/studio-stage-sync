ALTER TABLE public.gig_listings
  ADD COLUMN IF NOT EXISTS hide_yaj_profile boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_yaj_page_on_gigs boolean NOT NULL DEFAULT false;