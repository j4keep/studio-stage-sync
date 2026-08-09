ALTER TABLE public.marketplace_profiles
  ADD COLUMN IF NOT EXISTS buyer_address text,
  ADD COLUMN IF NOT EXISTS buyer_lat numeric,
  ADD COLUMN IF NOT EXISTS buyer_lng numeric,
  ADD COLUMN IF NOT EXISTS share_location boolean NOT NULL DEFAULT false;