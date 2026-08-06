-- ============ DEAL BUSINESSES ============
CREATE TABLE public.deal_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
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
  verification_status text NOT NULL DEFAULT 'pending',
  can_publish boolean NOT NULL DEFAULT false,
  address text,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  hours_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  avg_rating numeric NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deal_businesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_businesses TO authenticated;
GRANT ALL ON public.deal_businesses TO service_role;
ALTER TABLE public.deal_businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'manager',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_business_members TO authenticated;
GRANT ALL ON public.deal_business_members TO service_role;
ALTER TABLE public.deal_business_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_deal_business(_business_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.deal_businesses b WHERE b.id = _business_id AND b.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.deal_business_members m WHERE m.business_id = _business_id AND m.user_id = _user_id AND m.status = 'active');
$$;

-- ============ DEALS ============
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  title text NOT NULL,
  slug text,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  tags text[],
  deal_type text NOT NULL DEFAULT 'other',
  discount_badge text,
  regular_price numeric,
  deal_price numeric,
  discount_value numeric,
  currency text NOT NULL DEFAULT 'USD',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  redemption_type text NOT NULL DEFAULT 'claim_in_app',
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
  location_type text NOT NULL DEFAULT 'in_store',
  address text,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  map_label text,
  terms text,
  minimum_purchase numeric,
  age_restriction integer,
  exclusions text,
  status text NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  is_sponsored boolean NOT NULL DEFAULT false,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deals_category ON public.deals(category);
CREATE INDEX idx_deals_business ON public.deals(business_id);
CREATE INDEX idx_deals_expires ON public.deals(expires_at);
GRANT SELECT ON public.deals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deal_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_images TO authenticated;
GRANT ALL ON public.deal_images TO service_role;
ALTER TABLE public.deal_images ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_saves TO authenticated;
GRANT ALL ON public.deal_saves TO service_role;
ALTER TABLE public.deal_saves ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  redemption_type text NOT NULL DEFAULT 'claim_in_app',
  redemption_code text,
  qr_payload text,
  barcode_value text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  used_at timestamptz
);
CREATE INDEX idx_deal_claims_user ON public.deal_claims(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_claims TO authenticated;
GRANT ALL ON public.deal_claims TO service_role;
ALTER TABLE public.deal_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.deal_claims(id) ON DELETE CASCADE,
  offer_matched integer NOT NULL DEFAULT 5,
  redemption_easy integer NOT NULL DEFAULT 5,
  staff_honored integer NOT NULL DEFAULT 5,
  overall integer NOT NULL DEFAULT 5,
  body text,
  business_response text,
  business_responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, user_id)
);
GRANT SELECT ON public.deal_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_reviews TO authenticated;
GRANT ALL ON public.deal_reviews TO service_role;
ALTER TABLE public.deal_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deal_reports TO authenticated;
GRANT ALL ON public.deal_reports TO service_role;
ALTER TABLE public.deal_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_notification_preferences (
  user_id uuid PRIMARY KEY,
  saved_ending_soon boolean NOT NULL DEFAULT true,
  claimed_expiring_soon boolean NOT NULL DEFAULT true,
  followed_business_new boolean NOT NULL DEFAULT false,
  category_new boolean NOT NULL DEFAULT false,
  nearby_new boolean NOT NULL DEFAULT false,
  business_review_result boolean NOT NULL DEFAULT true,
  claim_limit_warning boolean NOT NULL DEFAULT true,
  sold_out boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_notification_preferences TO authenticated;
GRANT ALL ON public.deal_notification_preferences TO service_role;
ALTER TABLE public.deal_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  actor_id uuid DEFAULT auth.uid(),
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deal_audit_log TO authenticated;
GRANT ALL ON public.deal_audit_log TO service_role;
ALTER TABLE public.deal_audit_log ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
CREATE POLICY "Public can view businesses" ON public.deal_businesses FOR SELECT USING (true);
CREATE POLICY "Users create own business" ON public.deal_businesses FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update business" ON public.deal_businesses FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (true);
CREATE POLICY "Owners delete business" ON public.deal_businesses FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members visible to team" ON public.deal_business_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_deal_business(business_id, auth.uid()));
CREATE POLICY "Managers add members" ON public.deal_business_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.can_manage_deal_business(business_id, auth.uid()));
CREATE POLICY "Managers update members" ON public.deal_business_members FOR UPDATE TO authenticated
  USING (public.can_manage_deal_business(business_id, auth.uid())) WITH CHECK (true);
CREATE POLICY "Managers remove members" ON public.deal_business_members FOR DELETE TO authenticated
  USING (public.can_manage_deal_business(business_id, auth.uid()));

CREATE POLICY "Public can view active deals" ON public.deals FOR SELECT USING (status = 'active');
CREATE POLICY "Managers view own deals" ON public.deals FOR SELECT TO authenticated
  USING (public.can_manage_deal_business(business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers create deals" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND public.can_manage_deal_business(business_id, auth.uid()));
CREATE POLICY "Managers update deals" ON public.deals FOR UPDATE TO authenticated
  USING (public.can_manage_deal_business(business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) WITH CHECK (true);
CREATE POLICY "Managers delete deals" ON public.deals FOR DELETE TO authenticated
  USING (public.can_manage_deal_business(business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view deal images" ON public.deal_images FOR SELECT USING (true);
CREATE POLICY "Managers manage deal images" ON public.deal_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND public.can_manage_deal_business(d.business_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND public.can_manage_deal_business(d.business_id, auth.uid())));

CREATE POLICY "Users manage own saves" ON public.deal_saves FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own claims" ON public.deal_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_deal_business(business_id, auth.uid()));
CREATE POLICY "Users update own claims" ON public.deal_claims FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_deal_business(business_id, auth.uid())) WITH CHECK (true);

CREATE POLICY "Public can view reviews" ON public.deal_reviews FOR SELECT USING (true);
CREATE POLICY "Claimers write reviews" ON public.deal_reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.deal_claims c WHERE c.id = claim_id AND c.user_id = auth.uid() AND c.deal_id = deal_id
  ));
CREATE POLICY "Authors or business update reviews" ON public.deal_reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_deal_business(business_id, auth.uid())) WITH CHECK (true);
CREATE POLICY "Authors delete reviews" ON public.deal_reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create reports" ON public.deal_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Reporters and admins view reports" ON public.deal_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users manage own deal prefs" ON public.deal_notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers view audit log" ON public.deal_audit_log FOR SELECT TO authenticated
  USING (public.can_manage_deal_business(business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers write audit log" ON public.deal_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_deal_business(business_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ TIMESTAMP TRIGGERS ============
CREATE TRIGGER trg_deal_businesses_updated BEFORE UPDATE ON public.deal_businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deal_reviews_updated BEFORE UPDATE ON public.deal_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deal_prefs_updated BEFORE UPDATE ON public.deal_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deal_members_updated BEFORE UPDATE ON public.deal_business_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SERVER-SIDE LOGIC ============
CREATE OR REPLACE FUNCTION public.expire_stale_deals()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.deals SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND expires_at <= now();

  UPDATE public.deals SET status = 'sold_out', updated_at = now()
  WHERE status = 'active' AND total_claim_limit IS NOT NULL AND claims_count >= total_claim_limit;

  UPDATE public.deal_claims SET status = 'expired'
  WHERE status = 'claimed' AND expires_at IS NOT NULL AND expires_at <= now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.expire_stale_deals() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_deal_views(p_deal_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.deals SET views_count = COALESCE(views_count, 0) + 1 WHERE id = p_deal_id;
$$;
GRANT EXECUTE ON FUNCTION public.increment_deal_views(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_deal(p_deal_id uuid)
RETURNS public.deal_claims LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_deal public.deals;
  v_mine integer;
  v_claim public.deal_claims;
  v_code text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required to claim deals'; END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF v_deal.id IS NULL THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status <> 'active' THEN RAISE EXCEPTION 'This deal is no longer available'; END IF;
  IF v_deal.expires_at <= now() THEN RAISE EXCEPTION 'This deal has expired'; END IF;
  IF v_deal.total_claim_limit IS NOT NULL AND v_deal.claims_count >= v_deal.total_claim_limit THEN
    RAISE EXCEPTION 'This deal is sold out';
  END IF;

  SELECT count(*) INTO v_mine FROM public.deal_claims
   WHERE deal_id = p_deal_id AND user_id = v_user AND status <> 'expired';
  IF v_mine >= COALESCE(v_deal.per_user_limit, 1) THEN
    RAISE EXCEPTION 'You already claimed this deal';
  END IF;

  v_code := COALESCE(v_deal.promo_code, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

  INSERT INTO public.deal_claims (
    deal_id, business_id, user_id, status, redemption_type,
    redemption_code, qr_payload, barcode_value, expires_at
  ) VALUES (
    p_deal_id, v_deal.business_id, v_user, 'claimed', v_deal.redemption_type,
    v_code,
    CASE WHEN v_deal.redemption_type = 'qr_code' THEN 'yaj-deal:' || p_deal_id::text || ':' || v_code ELSE NULL END,
    CASE WHEN v_deal.redemption_type = 'barcode' THEN COALESCE(v_deal.barcode_value, v_code) ELSE NULL END,
    v_deal.expires_at
  ) RETURNING * INTO v_claim;

  UPDATE public.deals
     SET claims_count = COALESCE(claims_count, 0) + 1,
         status = CASE WHEN total_claim_limit IS NOT NULL AND COALESCE(claims_count, 0) + 1 >= total_claim_limit
                       THEN 'sold_out' ELSE status END,
         updated_at = now()
   WHERE id = p_deal_id;

  RETURN v_claim;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_deal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_deal_used(p_claim_id uuid)
RETURNS public.deal_claims LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_claim public.deal_claims;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_claim FROM public.deal_claims WHERE id = p_claim_id FOR UPDATE;
  IF v_claim.id IS NULL THEN RAISE EXCEPTION 'Claim not found'; END IF;
  IF v_claim.user_id <> v_user AND NOT public.can_manage_deal_business(v_claim.business_id, v_user) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_claim.status = 'used' THEN RAISE EXCEPTION 'This deal was already redeemed'; END IF;

  UPDATE public.deal_claims SET status = 'used', used_at = now() WHERE id = p_claim_id RETURNING * INTO v_claim;
  UPDATE public.deals SET redemption_count = COALESCE(redemption_count, 0) + 1, updated_at = now()
   WHERE id = v_claim.deal_id;
  RETURN v_claim;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_deal_used(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_deal_for_review(p_deal_id uuid)
RETURNS public.deals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_deal public.deals;
  v_can_publish boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF v_deal.id IS NULL THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF NOT public.can_manage_deal_business(v_deal.business_id, v_user) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_deal.expires_at <= now() THEN RAISE EXCEPTION 'Expiration date must be in the future'; END IF;

  SELECT (b.can_publish AND b.is_verified) INTO v_can_publish
    FROM public.deal_businesses b WHERE b.id = v_deal.business_id;

  UPDATE public.deals
     SET status = CASE WHEN COALESCE(v_can_publish, false) THEN 'active' ELSE 'pending_review' END,
         updated_at = now()
   WHERE id = p_deal_id
   RETURNING * INTO v_deal;

  INSERT INTO public.deal_audit_log (deal_id, business_id, actor_id, action)
  VALUES (p_deal_id, v_deal.business_id, v_user, 'submit_' || v_deal.status);

  RETURN v_deal;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_deal_for_review(uuid) TO authenticated;