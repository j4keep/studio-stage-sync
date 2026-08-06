-- YAJ Deals: verified-business limited-time promotions (separate from Marketplace).

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  logo_url text,
  cover_url text,
  website text,
  phone text,
  email text,
  category text,
  is_verified boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),
  can_publish boolean NOT NULL DEFAULT false,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  address text,
  hours_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  follower_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_businesses_owner_idx ON public.deal_businesses (owner_id);
CREATE INDEX IF NOT EXISTS deal_businesses_verified_idx ON public.deal_businesses (is_verified, can_publish);

CREATE TABLE IF NOT EXISTS public.deal_business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS deal_business_members_user_idx ON public.deal_business_members (user_id);

-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  deal_type text NOT NULL DEFAULT 'percent_off'
    CHECK (deal_type IN (
      'percent_off', 'amount_off', 'bogo', 'free_item', 'member_special',
      'limited_time', 'fixed_price', 'other'
    )),
  discount_badge text,
  regular_price numeric(12,2),
  deal_price numeric(12,2),
  discount_value numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redemption_type text NOT NULL DEFAULT 'promo_code'
    CHECK (redemption_type IN (
      'promo_code', 'qr_code', 'barcode', 'claim_in_app', 'show_screen',
      'external_website', 'call', 'directions'
    )),
  promo_code text,
  qr_payload text,
  barcode_value text,
  external_url text,
  total_claim_limit integer,
  per_user_limit integer NOT NULL DEFAULT 1,
  claims_count integer NOT NULL DEFAULT 0,
  redemption_count integer NOT NULL DEFAULT 0,
  views_count integer NOT NULL DEFAULT 0,
  saves_count integer NOT NULL DEFAULT 0,
  location_type text NOT NULL DEFAULT 'in_store'
    CHECK (location_type IN ('in_store', 'online', 'both')),
  address text,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  map_label text,
  terms text,
  minimum_purchase numeric(12,2),
  age_restriction integer,
  exclusions text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending_review', 'approved', 'active', 'paused',
      'rejected', 'expired', 'sold_out', 'archived'
    )),
  is_featured boolean NOT NULL DEFAULT false,
  is_sponsored boolean NOT NULL DEFAULT false,
  rejection_reason text,
  moderation_notes text,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_expires_after_starts CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS deals_status_expires_idx ON public.deals (status, expires_at);
CREATE INDEX IF NOT EXISTS deals_business_idx ON public.deals (business_id);
CREATE INDEX IF NOT EXISTS deals_category_idx ON public.deals (category);
CREATE INDEX IF NOT EXISTS deals_featured_idx ON public.deals (is_featured, status) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS deals_geo_idx ON public.deals (latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS deals_search_idx ON public.deals USING gin (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(city,'') || ' ' || coalesce(postal_code,''))
);
CREATE INDEX IF NOT EXISTS deals_tags_idx ON public.deals USING gin (tags);

CREATE TABLE IF NOT EXISTS public.deal_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_images_deal_idx ON public.deal_images (deal_id, sort_order);

CREATE TABLE IF NOT EXISTS public.deal_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.deal_businesses(id) ON DELETE SET NULL,
  label text,
  address text,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_locations_deal_idx ON public.deal_locations (deal_id);

-- ---------------------------------------------------------------------------
-- User engagement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.deal_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'used', 'expired', 'cancelled')),
  redemption_type text NOT NULL,
  redemption_code text,
  qr_payload text,
  barcode_value text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS deal_claims_active_unique
  ON public.deal_claims (deal_id, user_id)
  WHERE status IN ('claimed', 'used');

CREATE INDEX IF NOT EXISTS deal_claims_user_idx ON public.deal_claims (user_id, status, claimed_at DESC);
CREATE INDEX IF NOT EXISTS deal_claims_deal_idx ON public.deal_claims (deal_id);

CREATE TABLE IF NOT EXISTS public.deal_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.deal_claims(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  method text NOT NULL,
  notes text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id)
);

CREATE TABLE IF NOT EXISTS public.deal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.deal_claims(id) ON DELETE CASCADE,
  offer_matched integer NOT NULL CHECK (offer_matched BETWEEN 1 AND 5),
  redemption_easy integer NOT NULL CHECK (redemption_easy BETWEEN 1 AND 5),
  staff_honored integer NOT NULL CHECK (staff_honored BETWEEN 1 AND 5),
  overall integer NOT NULL CHECK (overall BETWEEN 1 AND 5),
  body text,
  business_response text,
  business_responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id)
);

CREATE INDEX IF NOT EXISTS deal_reviews_business_idx ON public.deal_reviews (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.deal_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'misleading_promotion', 'scam', 'prohibited_item', 'expired_offer',
    'unsafe_location', 'discrimination', 'other'
  )),
  details text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

CREATE INDEX IF NOT EXISTS deal_reports_status_idx ON public.deal_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.deal_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_ending_soon boolean NOT NULL DEFAULT true,
  claimed_expiring_soon boolean NOT NULL DEFAULT true,
  followed_business_new boolean NOT NULL DEFAULT false,
  category_new boolean NOT NULL DEFAULT false,
  nearby_new boolean NOT NULL DEFAULT false,
  business_review_result boolean NOT NULL DEFAULT true,
  claim_limit_warning boolean NOT NULL DEFAULT true,
  sold_out boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deal_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.deal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  business_id uuid REFERENCES public.deal_businesses(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_audit_log_deal_idx ON public.deal_audit_log (deal_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helper: admin / business membership (needed by RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_deal_business_member(p_business_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deal_business_members m
    WHERE m.business_id = p_business_id
      AND m.user_id = p_user_id
      AND m.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.deal_businesses b
    WHERE b.id = p_business_id AND b.owner_id = p_user_id
  )
  OR (
    p_user_id IS NOT NULL
    AND public.has_role(p_user_id, 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.deal_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;

-- Businesses: public can see approved/verified; members manage own
DROP POLICY IF EXISTS "Public view deal businesses" ON public.deal_businesses;
CREATE POLICY "Public view deal businesses" ON public.deal_businesses
  FOR SELECT TO public
  USING (
    verification_status = 'approved'
    OR owner_id = auth.uid()
    OR public.is_deal_business_member(id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Owners create deal businesses" ON public.deal_businesses;
CREATE POLICY "Owners create deal businesses" ON public.deal_businesses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Members update deal businesses" ON public.deal_businesses;
CREATE POLICY "Members update deal businesses" ON public.deal_businesses
  FOR UPDATE TO authenticated
  USING (public.is_deal_business_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Members
DROP POLICY IF EXISTS "View deal business members" ON public.deal_business_members;
CREATE POLICY "View deal business members" ON public.deal_business_members
  FOR SELECT TO authenticated
  USING (public.is_deal_business_member(business_id, auth.uid()) OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Manage deal business members" ON public.deal_business_members;
CREATE POLICY "Manage deal business members" ON public.deal_business_members
  FOR ALL TO authenticated
  USING (public.is_deal_business_member(business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_deal_business_member(business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Deals: public active; members see all own; admin all
DROP POLICY IF EXISTS "Public view active deals" ON public.deals;
CREATE POLICY "Public view active deals" ON public.deals
  FOR SELECT TO public
  USING (
    status = 'active'
    OR creator_id = auth.uid()
    OR public.is_deal_business_member(business_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Members insert deals" ON public.deals;
CREATE POLICY "Members insert deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = creator_id
    AND public.is_deal_business_member(business_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members update deals" ON public.deals;
CREATE POLICY "Members update deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (
    public.is_deal_business_member(business_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Members delete deals" ON public.deals;
CREATE POLICY "Members delete deals" ON public.deals
  FOR DELETE TO authenticated
  USING (
    public.is_deal_business_member(business_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Images / locations follow deal visibility
DROP POLICY IF EXISTS "Public view deal images" ON public.deal_images;
CREATE POLICY "Public view deal images" ON public.deal_images
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND (
          d.status = 'active'
          OR d.creator_id = auth.uid()
          OR public.is_deal_business_member(d.business_id, auth.uid())
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Members manage deal images" ON public.deal_images;
CREATE POLICY "Members manage deal images" ON public.deal_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND (public.is_deal_business_member(d.business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND (public.is_deal_business_member(d.business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "Public view deal locations" ON public.deal_locations;
CREATE POLICY "Public view deal locations" ON public.deal_locations
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND (
          d.status = 'active'
          OR d.creator_id = auth.uid()
          OR public.is_deal_business_member(d.business_id, auth.uid())
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "Members manage deal locations" ON public.deal_locations;
CREATE POLICY "Members manage deal locations" ON public.deal_locations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND (public.is_deal_business_member(d.business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND (public.is_deal_business_member(d.business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Saves
DROP POLICY IF EXISTS "Users manage own deal saves" ON public.deal_saves;
CREATE POLICY "Users manage own deal saves" ON public.deal_saves
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own deal saves" ON public.deal_saves;
CREATE POLICY "Users view own deal saves" ON public.deal_saves
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Claims: user sees own; business members see theirs; never expose others' codes publicly
DROP POLICY IF EXISTS "Users view own deal claims" ON public.deal_claims;
CREATE POLICY "Users view own deal claims" ON public.deal_claims
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_deal_business_member(business_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Users update own deal claims" ON public.deal_claims;
CREATE POLICY "Users update own deal claims" ON public.deal_claims
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Redemptions
DROP POLICY IF EXISTS "Users view own redemptions" ON public.deal_redemptions;
CREATE POLICY "Users view own redemptions" ON public.deal_redemptions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_deal_business_member(business_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Reviews: public read; author write after claim enforced in RPC
DROP POLICY IF EXISTS "Public view deal reviews" ON public.deal_reviews;
CREATE POLICY "Public view deal reviews" ON public.deal_reviews
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Users insert own deal reviews" ON public.deal_reviews;
CREATE POLICY "Users insert own deal reviews" ON public.deal_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.deal_claims c
      WHERE c.id = claim_id
        AND c.user_id = auth.uid()
        AND c.status IN ('claimed', 'used')
    )
  );

DROP POLICY IF EXISTS "Users update own deal reviews" ON public.deal_reviews;
CREATE POLICY "Users update own deal reviews" ON public.deal_reviews
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_deal_business_member(business_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Reports
DROP POLICY IF EXISTS "Users create deal reports" ON public.deal_reports;
CREATE POLICY "Users create deal reports" ON public.deal_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users view own deal reports" ON public.deal_reports;
CREATE POLICY "Users view own deal reports" ON public.deal_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage deal reports" ON public.deal_reports;
CREATE POLICY "Admins manage deal reports" ON public.deal_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Notification prefs
DROP POLICY IF EXISTS "Users manage deal notification prefs" ON public.deal_notification_preferences;
CREATE POLICY "Users manage deal notification prefs" ON public.deal_notification_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Follows
DROP POLICY IF EXISTS "Users manage deal follows" ON public.deal_follows;
CREATE POLICY "Users manage deal follows" ON public.deal_follows
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public count deal follows" ON public.deal_follows;
CREATE POLICY "Public count deal follows" ON public.deal_follows
  FOR SELECT TO public USING (true);

-- Audit: members + admin
DROP POLICY IF EXISTS "Members view deal audit" ON public.deal_audit_log;
CREATE POLICY "Members view deal audit" ON public.deal_audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (business_id IS NOT NULL AND public.is_deal_business_member(business_id, auth.uid()))
  );

-- Grants
GRANT SELECT ON public.deal_businesses TO anon, authenticated;
GRANT INSERT, UPDATE ON public.deal_businesses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_business_members TO authenticated;
GRANT SELECT ON public.deals TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT SELECT ON public.deal_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.deal_images TO authenticated;
GRANT SELECT ON public.deal_locations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.deal_locations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.deal_saves TO authenticated;
GRANT SELECT, UPDATE ON public.deal_claims TO authenticated;
GRANT SELECT ON public.deal_redemptions TO authenticated;
GRANT SELECT ON public.deal_reviews TO anon, authenticated;
GRANT INSERT, UPDATE ON public.deal_reviews TO authenticated;
GRANT SELECT, INSERT ON public.deal_reports TO authenticated;
GRANT UPDATE ON public.deal_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.deal_notification_preferences TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.deal_follows TO authenticated;
GRANT SELECT ON public.deal_audit_log TO authenticated;
GRANT ALL ON public.deal_businesses TO service_role;
GRANT ALL ON public.deal_business_members TO service_role;
GRANT ALL ON public.deals TO service_role;
GRANT ALL ON public.deal_images TO service_role;
GRANT ALL ON public.deal_locations TO service_role;
GRANT ALL ON public.deal_saves TO service_role;
GRANT ALL ON public.deal_claims TO service_role;
GRANT ALL ON public.deal_redemptions TO service_role;
GRANT ALL ON public.deal_reviews TO service_role;
GRANT ALL ON public.deal_reports TO service_role;
GRANT ALL ON public.deal_notification_preferences TO service_role;
GRANT ALL ON public.deal_follows TO service_role;
GRANT ALL ON public.deal_audit_log TO service_role;

-- ---------------------------------------------------------------------------
-- Prohibited content heuristic → pending review
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deals_contains_prohibited(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_text IS NULL OR length(trim(p_text)) = 0 THEN false
    ELSE lower(p_text) ~ '(weapon|firearm|gun|ammunition|cocaine|heroin|fentanyl|meth|cannabis|marijuana|prescription|viagra|tobacco|cigarette|vape|nicotine|escort|porn|adult.?service|counterfeit|fake.?rolex|gambling|casino|crypto.?giveaway|get.?rich|steroid|recalled.?product)'
  END;
$$;

-- ---------------------------------------------------------------------------
-- Atomic claim
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_deal(p_deal_id uuid)
RETURNS public.deal_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deal public.deals%ROWTYPE;
  v_user_claims integer;
  v_claim public.deal_claims%ROWTYPE;
  v_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF v_deal.status <> 'active' THEN
    RAISE EXCEPTION 'Deal is not available';
  END IF;

  IF v_deal.expires_at <= now() THEN
    UPDATE public.deals SET status = 'expired', updated_at = now() WHERE id = v_deal.id;
    RAISE EXCEPTION 'Deal expired';
  END IF;

  IF v_deal.starts_at > now() THEN
    RAISE EXCEPTION 'Deal not started yet';
  END IF;

  IF v_deal.total_claim_limit IS NOT NULL AND v_deal.claims_count >= v_deal.total_claim_limit THEN
    UPDATE public.deals SET status = 'sold_out', updated_at = now() WHERE id = v_deal.id;
    RAISE EXCEPTION 'Deal sold out';
  END IF;

  SELECT count(*)::integer INTO v_user_claims
  FROM public.deal_claims
  WHERE deal_id = p_deal_id
    AND user_id = v_uid
    AND status IN ('claimed', 'used');

  IF v_user_claims >= coalesce(v_deal.per_user_limit, 1) THEN
    RAISE EXCEPTION 'Per-user claim limit reached';
  END IF;

  v_code := coalesce(
    nullif(trim(v_deal.promo_code), ''),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

  INSERT INTO public.deal_claims (
    deal_id, user_id, business_id, status, redemption_type,
    redemption_code, qr_payload, barcode_value, expires_at
  ) VALUES (
    v_deal.id, v_uid, v_deal.business_id, 'claimed', v_deal.redemption_type,
    CASE WHEN v_deal.redemption_type IN ('promo_code', 'claim_in_app', 'show_screen', 'qr_code', 'barcode')
      THEN v_code ELSE v_deal.promo_code END,
    coalesce(nullif(v_deal.qr_payload, ''), 'yaj-deal:' || v_deal.id::text || ':' || v_uid::text || ':' || v_code),
    coalesce(v_deal.barcode_value, v_code),
    v_deal.expires_at
  )
  RETURNING * INTO v_claim;

  UPDATE public.deals
  SET claims_count = claims_count + 1,
      status = CASE
        WHEN total_claim_limit IS NOT NULL AND claims_count + 1 >= total_claim_limit THEN 'sold_out'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_deal.id;

  INSERT INTO public.deal_audit_log (deal_id, business_id, actor_id, action, after_json)
  VALUES (v_deal.id, v_deal.business_id, v_uid, 'claim', to_jsonb(v_claim));

  RETURN v_claim;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_deal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_deal(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Mark used / redeem
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_deal_used(p_claim_id uuid)
RETURNS public.deal_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_claim public.deal_claims%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_claim FROM public.deal_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;
  IF v_claim.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin')
     AND NOT public.is_deal_business_member(v_claim.business_id, v_uid) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_claim.status = 'used' THEN
    RAISE EXCEPTION 'Already used';
  END IF;
  IF v_claim.status = 'expired' OR (v_claim.expires_at IS NOT NULL AND v_claim.expires_at <= now()) THEN
    UPDATE public.deal_claims SET status = 'expired' WHERE id = v_claim.id;
    RAISE EXCEPTION 'Claim expired';
  END IF;
  IF v_claim.status <> 'claimed' THEN
    RAISE EXCEPTION 'Claim not redeemable';
  END IF;

  UPDATE public.deal_claims
  SET status = 'used', used_at = now()
  WHERE id = v_claim.id
  RETURNING * INTO v_claim;

  INSERT INTO public.deal_redemptions (claim_id, deal_id, user_id, business_id, method)
  VALUES (v_claim.id, v_claim.deal_id, v_claim.user_id, v_claim.business_id, v_claim.redemption_type)
  ON CONFLICT (claim_id) DO NOTHING;

  UPDATE public.deals
  SET redemption_count = redemption_count + 1, updated_at = now()
  WHERE id = v_claim.deal_id;

  RETURN v_claim;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_deal_used(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_deal_used(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Submit deal for review (material changes / publish)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_deal_for_review(p_deal_id uuid)
RETURNS public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deal public.deals%ROWTYPE;
  v_biz public.deal_businesses%ROWTYPE;
  v_text text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF NOT public.is_deal_business_member(v_deal.business_id, v_uid) AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_biz FROM public.deal_businesses WHERE id = v_deal.business_id;

  IF v_deal.expires_at <= now() THEN
    RAISE EXCEPTION 'Expiration must be in the future';
  END IF;
  IF v_deal.regular_price IS NOT NULL AND v_deal.deal_price IS NOT NULL AND v_deal.deal_price > v_deal.regular_price THEN
    RAISE EXCEPTION 'Deal price cannot exceed regular price';
  END IF;

  v_text := coalesce(v_deal.title,'') || ' ' || coalesce(v_deal.description,'') || ' ' || coalesce(v_deal.terms,'');
  IF public.deals_contains_prohibited(v_text) THEN
    UPDATE public.deals SET status = 'pending_review', updated_at = now() WHERE id = v_deal.id
    RETURNING * INTO v_deal;
    INSERT INTO public.deal_audit_log (deal_id, business_id, actor_id, action, note)
    VALUES (v_deal.id, v_deal.business_id, v_uid, 'submit_flagged', 'Prohibited keyword heuristic');
    RETURN v_deal;
  END IF;

  -- Only verified / can_publish / admin may go live; everyone else stays pending review.
  UPDATE public.deals
  SET status = CASE
      WHEN public.has_role(v_uid, 'admin') THEN 'active'
      WHEN (v_biz.can_publish OR v_biz.is_verified) THEN 'active'
      ELSE 'pending_review'
    END,
    updated_at = now()
  WHERE id = v_deal.id
  RETURNING * INTO v_deal;

  INSERT INTO public.deal_audit_log (deal_id, business_id, actor_id, action, after_json)
  VALUES (v_deal.id, v_deal.business_id, v_uid, 'submit', to_jsonb(v_deal));

  RETURN v_deal;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_deal_for_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_deal_for_review(uuid) TO authenticated;

-- Material edit → pending review
CREATE OR REPLACE FUNCTION public.apply_deal_material_edit(
  p_deal_id uuid,
  p_patch jsonb
)
RETURNS public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_before public.deals%ROWTYPE;
  v_after public.deals%ROWTYPE;
  v_material boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_before FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF NOT public.is_deal_business_member(v_before.business_id, v_uid) AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_patch ? 'regular_price' OR p_patch ? 'deal_price' OR p_patch ? 'discount_value'
     OR p_patch ? 'terms' OR p_patch ? 'starts_at' OR p_patch ? 'expires_at'
     OR p_patch ? 'redemption_type' OR p_patch ? 'promo_code' OR p_patch ? 'total_claim_limit'
     OR p_patch ? 'per_user_limit' OR p_patch ? 'address' OR p_patch ? 'city'
     OR p_patch ? 'latitude' OR p_patch ? 'longitude' OR p_patch ? 'location_type' THEN
    v_material := true;
  END IF;

  UPDATE public.deals SET
    title = coalesce(p_patch->>'title', title),
    description = coalesce(p_patch->>'description', description),
    category = coalesce(p_patch->>'category', category),
    cover_url = coalesce(p_patch->>'cover_url', cover_url),
    discount_badge = coalesce(p_patch->>'discount_badge', discount_badge),
    regular_price = CASE WHEN p_patch ? 'regular_price' THEN (p_patch->>'regular_price')::numeric ELSE regular_price END,
    deal_price = CASE WHEN p_patch ? 'deal_price' THEN (p_patch->>'deal_price')::numeric ELSE deal_price END,
    discount_value = CASE WHEN p_patch ? 'discount_value' THEN (p_patch->>'discount_value')::numeric ELSE discount_value END,
    terms = coalesce(p_patch->>'terms', terms),
    starts_at = CASE WHEN p_patch ? 'starts_at' THEN (p_patch->>'starts_at')::timestamptz ELSE starts_at END,
    expires_at = CASE WHEN p_patch ? 'expires_at' THEN (p_patch->>'expires_at')::timestamptz ELSE expires_at END,
    redemption_type = coalesce(p_patch->>'redemption_type', redemption_type),
    promo_code = coalesce(p_patch->>'promo_code', promo_code),
    total_claim_limit = CASE WHEN p_patch ? 'total_claim_limit' THEN (p_patch->>'total_claim_limit')::integer ELSE total_claim_limit END,
    per_user_limit = CASE WHEN p_patch ? 'per_user_limit' THEN (p_patch->>'per_user_limit')::integer ELSE per_user_limit END,
    address = coalesce(p_patch->>'address', address),
    city = coalesce(p_patch->>'city', city),
    state = coalesce(p_patch->>'state', state),
    postal_code = coalesce(p_patch->>'postal_code', postal_code),
    latitude = CASE WHEN p_patch ? 'latitude' THEN (p_patch->>'latitude')::double precision ELSE latitude END,
    longitude = CASE WHEN p_patch ? 'longitude' THEN (p_patch->>'longitude')::double precision ELSE longitude END,
    location_type = coalesce(p_patch->>'location_type', location_type),
    status = CASE
      WHEN v_material AND status = 'active' AND NOT public.has_role(v_uid, 'admin') THEN 'pending_review'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_deal_id
  RETURNING * INTO v_after;

  INSERT INTO public.deal_audit_log (deal_id, business_id, actor_id, action, before_json, after_json, note)
  VALUES (
    p_deal_id, v_before.business_id, v_uid,
    CASE WHEN v_material THEN 'material_edit' ELSE 'edit' END,
    to_jsonb(v_before), to_jsonb(v_after),
    CASE WHEN v_material AND v_before.status = 'active' THEN 'Returned to review' ELSE NULL END
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_deal_material_edit(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_deal_material_edit(uuid, jsonb) TO authenticated;

-- Increment views safely
CREATE OR REPLACE FUNCTION public.increment_deal_views(p_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.deals SET views_count = views_count + 1 WHERE id = p_deal_id AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.increment_deal_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_deal_views(uuid) TO anon, authenticated;

-- Expire stale deals (callable by clients/cron)
CREATE OR REPLACE FUNCTION public.expire_stale_deals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.deals
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.deal_claims
  SET status = 'expired'
  WHERE status = 'claimed' AND expires_at IS NOT NULL AND expires_at <= now();

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_deals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_deals() TO authenticated, service_role;
