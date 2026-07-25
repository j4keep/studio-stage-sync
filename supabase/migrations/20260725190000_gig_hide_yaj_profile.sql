-- Gig posters can hide their full YAJ page; only name + avatar stay visible.
ALTER TABLE public.gig_listings
  ADD COLUMN IF NOT EXISTS hide_yaj_profile boolean NOT NULL DEFAULT false;

-- Anyone contacting on gigs can hide their YAJ page the same way.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_yaj_page_on_gigs boolean NOT NULL DEFAULT false;
