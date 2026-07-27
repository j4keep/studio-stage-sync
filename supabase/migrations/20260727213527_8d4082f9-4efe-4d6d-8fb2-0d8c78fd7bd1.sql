CREATE TABLE IF NOT EXISTS public.marketplace_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  bio text,
  avatar_url text,
  city text,
  service_area text,
  is_business boolean NOT NULL DEFAULT false,
  response_time_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_type text NOT NULL DEFAULT 'item',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'for-sale',
  subcategory text,
  condition text,
  brand text,
  model text,
  color text,
  quantity integer NOT NULL DEFAULT 1,
  price numeric,
  firm_price boolean NOT NULL DEFAULT false,
  open_to_offers boolean NOT NULL DEFAULT true,
  delivery boolean NOT NULL DEFAULT false,
  shipping boolean NOT NULL DEFAULT false,
  local_pickup boolean NOT NULL DEFAULT true,
  city text,
  state text,
  zip text,
  location_approx text,
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'active',
  cover_url text,
  tags text[] NOT NULL DEFAULT '{}',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  promoted boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.marketplace_listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_vehicle_details (
  listing_id uuid PRIMARY KEY REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  year integer,
  make text,
  model text,
  trim text,
  body_style text,
  mileage integer,
  vin text,
  transmission text,
  drivetrain text,
  engine text,
  cylinders integer,
  fuel_type text,
  exterior_color text,
  interior_color text,
  title_status text,
  motorcycle_type text,
  engine_size text,
  boat_type text,
  length_ft numeric,
  engine_type text,
  engine_hours integer,
  hull_material text,
  trailer_included boolean,
  rv_type text,
  sleeping_capacity integer,
  slide_outs integer,
  dealer boolean NOT NULL DEFAULT false,
  extras jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.marketplace_saved_listings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.marketplace_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.marketplace_profiles, public.marketplace_listings, public.marketplace_listing_media, public.marketplace_vehicle_details TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_saved_listings, public.marketplace_offers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marketplace_profiles, public.marketplace_listings, public.marketplace_listing_media, public.marketplace_vehicle_details TO authenticated;
GRANT ALL ON public.marketplace_profiles, public.marketplace_listings, public.marketplace_listing_media, public.marketplace_vehicle_details, public.marketplace_saved_listings, public.marketplace_offers TO service_role;

CREATE INDEX IF NOT EXISTS marketplace_listings_status_idx ON public.marketplace_listings (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS marketplace_listings_seller_idx ON public.marketplace_listings (seller_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_category_idx ON public.marketplace_listings (category);
CREATE INDEX IF NOT EXISTS marketplace_listings_created_idx ON public.marketplace_listings (created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_listing_media_listing_idx ON public.marketplace_listing_media (listing_id, sort_order);
CREATE INDEX IF NOT EXISTS marketplace_saved_user_idx ON public.marketplace_saved_listings (user_id);

ALTER TABLE public.marketplace_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listing_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_vehicle_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_profiles_read" ON public.marketplace_profiles;
CREATE POLICY "mp_profiles_read" ON public.marketplace_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "mp_profiles_write" ON public.marketplace_profiles;
CREATE POLICY "mp_profiles_write" ON public.marketplace_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mp_listings_read" ON public.marketplace_listings;
CREATE POLICY "mp_listings_read" ON public.marketplace_listings FOR SELECT
  USING (deleted_at IS NULL AND (status IN ('active', 'pending', 'sold') OR auth.uid() = seller_id));
DROP POLICY IF EXISTS "mp_listings_write" ON public.marketplace_listings;
CREATE POLICY "mp_listings_write" ON public.marketplace_listings FOR ALL TO authenticated
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "mp_media_read" ON public.marketplace_listing_media;
CREATE POLICY "mp_media_read" ON public.marketplace_listing_media FOR SELECT USING (true);
DROP POLICY IF EXISTS "mp_media_write" ON public.marketplace_listing_media;
CREATE POLICY "mp_media_write" ON public.marketplace_listing_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

DROP POLICY IF EXISTS "mp_vehicle_read" ON public.marketplace_vehicle_details;
CREATE POLICY "mp_vehicle_read" ON public.marketplace_vehicle_details FOR SELECT USING (true);
DROP POLICY IF EXISTS "mp_vehicle_write" ON public.marketplace_vehicle_details;
CREATE POLICY "mp_vehicle_write" ON public.marketplace_vehicle_details FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

DROP POLICY IF EXISTS "mp_saved_own" ON public.marketplace_saved_listings;
CREATE POLICY "mp_saved_own" ON public.marketplace_saved_listings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mp_offers_parties" ON public.marketplace_offers;
CREATE POLICY "mp_offers_parties" ON public.marketplace_offers FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
DROP POLICY IF EXISTS "mp_offers_insert" ON public.marketplace_offers;
CREATE POLICY "mp_offers_insert" ON public.marketplace_offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "mp_offers_update" ON public.marketplace_offers;
CREATE POLICY "mp_offers_update" ON public.marketplace_offers FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);