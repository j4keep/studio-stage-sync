-- 1. Fixed search_path on helper function
CREATE OR REPLACE FUNCTION public.suggested_moderation_action(p_offense_count integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_offense_count <= 1 THEN 'warning'
    WHEN p_offense_count = 2 THEN 'timeout_24h'
    WHEN p_offense_count = 3 THEN 'timeout_7d'
    ELSE 'ban'
  END
$$;

-- 2. Deal tables: prevent ownership/foreign-key reassignment on update
DROP POLICY IF EXISTS "Owners update business" ON public.deal_businesses;
CREATE POLICY "Owners update business" ON public.deal_businesses
FOR UPDATE TO authenticated
USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'))
WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users update own claims" ON public.deal_claims;
CREATE POLICY "Users update own claims" ON public.deal_claims
FOR UPDATE TO authenticated
USING ((user_id = auth.uid()) OR can_manage_deal_business(business_id, auth.uid()))
WITH CHECK ((user_id = auth.uid()) OR can_manage_deal_business(business_id, auth.uid()));

DROP POLICY IF EXISTS "Authors or business update reviews" ON public.deal_reviews;
CREATE POLICY "Authors or business update reviews" ON public.deal_reviews
FOR UPDATE TO authenticated
USING ((user_id = auth.uid()) OR can_manage_deal_business(business_id, auth.uid()))
WITH CHECK ((user_id = auth.uid()) OR can_manage_deal_business(business_id, auth.uid()));

DROP POLICY IF EXISTS "Managers update deals" ON public.deals;
CREATE POLICY "Managers update deals" ON public.deals
FOR UPDATE TO authenticated
USING (can_manage_deal_business(business_id, auth.uid()) OR has_role(auth.uid(), 'admin'))
WITH CHECK (can_manage_deal_business(business_id, auth.uid()) OR has_role(auth.uid(), 'admin'));

-- 3. Subscriptions: owner-only reads
DROP POLICY IF EXISTS "us_read_auth" ON public.user_subscriptions;
CREATE POLICY "us_read_auth" ON public.user_subscriptions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 4. Move buyer location out of the publicly readable marketplace profile
CREATE TABLE IF NOT EXISTS public.marketplace_buyer_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_address text,
  buyer_lat numeric,
  buyer_lng numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_buyer_locations TO authenticated;
GRANT ALL ON public.marketplace_buyer_locations TO service_role;

ALTER TABLE public.marketplace_buyer_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_buyer_loc_own" ON public.marketplace_buyer_locations;
CREATE POLICY "mp_buyer_loc_own" ON public.marketplace_buyer_locations
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

INSERT INTO public.marketplace_buyer_locations (user_id, buyer_address, buyer_lat, buyer_lng)
SELECT user_id, buyer_address, buyer_lat, buyer_lng
FROM public.marketplace_profiles
WHERE buyer_address IS NOT NULL OR buyer_lat IS NOT NULL OR buyer_lng IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.marketplace_profiles
  DROP COLUMN IF EXISTS buyer_address,
  DROP COLUMN IF EXISTS buyer_lat,
  DROP COLUMN IF EXISTS buyer_lng;