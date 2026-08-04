-- Services + Events listings for Explore / Happening rails.

CREATE TABLE IF NOT EXISTS public.service_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  phone text,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view services"
  ON public.service_listings FOR SELECT TO public USING (true);
CREATE POLICY "Users create own services"
  ON public.service_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own services"
  ON public.service_listings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own services"
  ON public.service_listings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.service_listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_listings TO authenticated;
GRANT ALL ON public.service_listings TO service_role;

CREATE TABLE IF NOT EXISTS public.event_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  media_url text,
  media_type text NOT NULL DEFAULT 'image',
  address text,
  map_url text,
  price_cents integer,
  starts_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view events"
  ON public.event_listings FOR SELECT TO public USING (true);
CREATE POLICY "Users create own events"
  ON public.event_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own events"
  ON public.event_listings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own events"
  ON public.event_listings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.event_listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_listings TO authenticated;
GRANT ALL ON public.event_listings TO service_role;
