-- Deals business verification: documents, fraud flags, admin review actions.

-- Expand verification statuses
ALTER TABLE public.deal_businesses
  DROP CONSTRAINT IF EXISTS deal_businesses_verification_status_check;

ALTER TABLE public.deal_businesses
  ADD CONSTRAINT deal_businesses_verification_status_check
  CHECK (verification_status IN (
    'pending', 'needs_info', 'approved', 'rejected', 'suspended'
  ));

ALTER TABLE public.deal_businesses
  ADD COLUMN IF NOT EXISTS phone_normalized text,
  ADD COLUMN IF NOT EXISTS address_normalized text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS admin_request_message text,
  ADD COLUMN IF NOT EXISTS fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needs_manual_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posting_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS violation_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS deal_businesses_phone_norm_idx
  ON public.deal_businesses (phone_normalized)
  WHERE phone_normalized IS NOT NULL AND length(phone_normalized) > 0;

CREATE INDEX IF NOT EXISTS deal_businesses_addr_norm_idx
  ON public.deal_businesses (address_normalized)
  WHERE address_normalized IS NOT NULL AND length(address_normalized) > 0;

CREATE INDEX IF NOT EXISTS deal_businesses_verification_status_idx
  ON public.deal_businesses (verification_status, created_at DESC);

-- Verification documents (license, EIN, utility bill, etc.)
CREATE TABLE IF NOT EXISTS public.deal_business_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.deal_businesses(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN (
    'business_license',
    'ein_tax',
    'utility_bill',
    'state_registration',
    'website_social',
    'other'
  )),
  file_url text NOT NULL,
  file_name text,
  notes text,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_business_documents_biz_idx
  ON public.deal_business_documents (business_id, created_at DESC);

ALTER TABLE public.deal_business_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view own deal biz docs" ON public.deal_business_documents;
CREATE POLICY "Owners view own deal biz docs" ON public.deal_business_documents
  FOR SELECT TO authenticated
  USING (
    public.is_deal_business_member(business_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Owners upload deal biz docs" ON public.deal_business_documents;
CREATE POLICY "Owners upload deal biz docs" ON public.deal_business_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND public.is_deal_business_member(business_id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage deal biz docs" ON public.deal_business_documents;
CREATE POLICY "Admins manage deal biz docs" ON public.deal_business_documents
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT ON public.deal_business_documents TO authenticated;
GRANT UPDATE ON public.deal_business_documents TO authenticated;
GRANT ALL ON public.deal_business_documents TO service_role;

-- Normalize helpers
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.normalize_address(p_address text, p_city text, p_state text, p_postal text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(
    coalesce(p_address,'') || '|' || coalesce(p_city,'') || '|' || coalesce(p_state,'') || '|' || coalesce(p_postal,''),
    '\s+', ' ', 'g'
  )));
$$;

-- Fraud scan on submit
CREATE OR REPLACE FUNCTION public.scan_deal_business_fraud(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_biz public.deal_businesses%ROWTYPE;
  v_flags jsonb := '[]'::jsonb;
  v_dup_phone integer;
  v_dup_addr integer;
  v_owner_count integer;
BEGIN
  SELECT * INTO v_biz FROM public.deal_businesses WHERE id = p_business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  IF v_biz.phone_normalized IS NOT NULL AND length(v_biz.phone_normalized) >= 7 THEN
    SELECT count(*)::integer INTO v_dup_phone
    FROM public.deal_businesses b
    WHERE b.id <> p_business_id
      AND b.phone_normalized = v_biz.phone_normalized;
    IF v_dup_phone > 0 THEN
      v_flags := v_flags || jsonb_build_array(jsonb_build_object(
        'code', 'duplicate_phone',
        'detail', format('%s other business(es) share this phone', v_dup_phone)
      ));
    END IF;
  END IF;

  IF v_biz.address_normalized IS NOT NULL AND length(v_biz.address_normalized) > 8 THEN
    SELECT count(*)::integer INTO v_dup_addr
    FROM public.deal_businesses b
    WHERE b.id <> p_business_id
      AND b.address_normalized = v_biz.address_normalized;
    IF v_dup_addr > 0 THEN
      v_flags := v_flags || jsonb_build_array(jsonb_build_object(
        'code', 'duplicate_address',
        'detail', format('%s other business(es) share this address', v_dup_addr)
      ));
    END IF;
  END IF;

  SELECT count(*)::integer INTO v_owner_count
  FROM public.deal_businesses b
  WHERE b.owner_id = v_biz.owner_id;
  IF v_owner_count > 3 THEN
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code', 'many_businesses_same_owner',
      'detail', format('Owner has %s business profiles', v_owner_count)
    ));
  END IF;

  UPDATE public.deal_businesses
  SET fraud_flags = v_flags,
      needs_manual_review = jsonb_array_length(v_flags) > 0,
      updated_at = now()
  WHERE id = p_business_id;

  RETURN v_flags;
END;
$$;

REVOKE ALL ON FUNCTION public.scan_deal_business_fraud(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scan_deal_business_fraud(uuid) TO authenticated;

-- Submit for verification review
CREATE OR REPLACE FUNCTION public.submit_deal_business_verification(p_business_id uuid)
RETURNS public.deal_businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_biz public.deal_businesses%ROWTYPE;
  v_doc_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_deal_business_member(p_business_id, v_uid) AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_biz FROM public.deal_businesses WHERE id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;

  IF coalesce(nullif(trim(v_biz.name), ''), '') = '' THEN RAISE EXCEPTION 'Business name required'; END IF;
  IF coalesce(nullif(trim(v_biz.address), ''), '') = '' THEN RAISE EXCEPTION 'Address required'; END IF;
  IF coalesce(nullif(trim(v_biz.phone), ''), '') = '' THEN RAISE EXCEPTION 'Phone required'; END IF;
  IF coalesce(nullif(trim(v_biz.category), ''), '') = '' THEN RAISE EXCEPTION 'Category required'; END IF;
  IF coalesce(nullif(trim(v_biz.description), ''), '') = '' THEN RAISE EXCEPTION 'Description required'; END IF;

  SELECT count(*)::integer INTO v_doc_count
  FROM public.deal_business_documents d
  WHERE d.business_id = p_business_id;
  IF v_doc_count < 1 THEN
    RAISE EXCEPTION 'Upload at least one verification document';
  END IF;

  UPDATE public.deal_businesses SET
    phone_normalized = public.normalize_phone(phone),
    address_normalized = public.normalize_address(address, city, state, postal_code),
    verification_status = 'pending',
    verification_submitted_at = now(),
    admin_request_message = null,
    updated_at = now()
  WHERE id = p_business_id
  RETURNING * INTO v_biz;

  PERFORM public.scan_deal_business_fraud(p_business_id);
  SELECT * INTO v_biz FROM public.deal_businesses WHERE id = p_business_id;

  INSERT INTO public.deal_audit_log (deal_id, business_id, actor_id, action, after_json, note)
  VALUES (null, p_business_id, v_uid, 'verification_submit', to_jsonb(v_biz), 'Submitted for review');

  RETURN v_biz;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_deal_business_verification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_deal_business_verification(uuid) TO authenticated;

-- Admin review
CREATE OR REPLACE FUNCTION public.review_deal_business(
  p_business_id uuid,
  p_decision text,
  p_message text DEFAULT NULL
)
RETURNS public.deal_businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_biz public.deal_businesses%ROWTYPE;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_decision NOT IN ('approve', 'reject', 'request_info', 'suspend', 'revoke') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO v_biz FROM public.deal_businesses WHERE id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;

  IF p_decision = 'approve' THEN
    v_status := 'approved';
    UPDATE public.deal_businesses SET
      verification_status = v_status,
      is_verified = true,
      can_publish = true,
      posting_suspended = false,
      verification_reviewed_at = now(),
      verification_reviewed_by = v_uid,
      verification_note = nullif(trim(p_message), ''),
      admin_request_message = null,
      updated_at = now()
    WHERE id = p_business_id
    RETURNING * INTO v_biz;
  ELSIF p_decision = 'reject' THEN
    v_status := 'rejected';
    UPDATE public.deal_businesses SET
      verification_status = v_status,
      is_verified = false,
      can_publish = false,
      verification_reviewed_at = now(),
      verification_reviewed_by = v_uid,
      verification_note = coalesce(nullif(trim(p_message), ''), 'Rejected'),
      updated_at = now()
    WHERE id = p_business_id
    RETURNING * INTO v_biz;
  ELSIF p_decision = 'request_info' THEN
    v_status := 'needs_info';
    UPDATE public.deal_businesses SET
      verification_status = v_status,
      is_verified = false,
      can_publish = false,
      verification_reviewed_at = now(),
      verification_reviewed_by = v_uid,
      admin_request_message = coalesce(nullif(trim(p_message), ''), 'Please provide additional documentation.'),
      updated_at = now()
    WHERE id = p_business_id
    RETURNING * INTO v_biz;
  ELSIF p_decision = 'suspend' THEN
    v_status := 'suspended';
    UPDATE public.deal_businesses SET
      verification_status = v_status,
      can_publish = false,
      posting_suspended = true,
      verification_reviewed_at = now(),
      verification_reviewed_by = v_uid,
      verification_note = coalesce(nullif(trim(p_message), ''), 'Suspended'),
      violation_count = violation_count + 1,
      updated_at = now()
    WHERE id = p_business_id
    RETURNING * INTO v_biz;
    -- Pause active deals
    UPDATE public.deals SET status = 'paused', updated_at = now()
    WHERE business_id = p_business_id AND status = 'active';
  ELSE -- revoke
    v_status := 'pending';
    UPDATE public.deal_businesses SET
      verification_status = 'pending',
      is_verified = false,
      can_publish = false,
      verification_reviewed_at = now(),
      verification_reviewed_by = v_uid,
      verification_note = coalesce(nullif(trim(p_message), ''), 'Verification revoked'),
      updated_at = now()
    WHERE id = p_business_id
    RETURNING * INTO v_biz;
    UPDATE public.deals SET status = 'paused', updated_at = now()
    WHERE business_id = p_business_id AND status = 'active';
  END IF;

  INSERT INTO public.deal_audit_log (business_id, actor_id, action, after_json, note)
  VALUES (p_business_id, v_uid, 'verification_' || p_decision, to_jsonb(v_biz), p_message);

  RETURN v_biz;
END;
$$;

REVOKE ALL ON FUNCTION public.review_deal_business(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_deal_business(uuid, text, text) TO authenticated;

-- Admin hide/pause a deal without banning the business
CREATE OR REPLACE FUNCTION public.moderate_deal(
  p_deal_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deal public.deals%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_action NOT IN ('hide', 'pause', 'restore') THEN RAISE EXCEPTION 'Invalid action'; END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;

  IF p_action = 'hide' THEN
    UPDATE public.deals SET status = 'archived', updated_at = now() WHERE id = p_deal_id RETURNING * INTO v_deal;
  ELSIF p_action = 'pause' THEN
    UPDATE public.deals SET status = 'paused', updated_at = now() WHERE id = p_deal_id RETURNING * INTO v_deal;
  ELSE
    UPDATE public.deals SET status = 'active', updated_at = now()
    WHERE id = p_deal_id AND expires_at > now()
    RETURNING * INTO v_deal;
  END IF;

  INSERT INTO public.deal_audit_log (deal_id, business_id, actor_id, action, after_json, note)
  VALUES (p_deal_id, v_deal.business_id, v_uid, 'deal_moderate_' || p_action, to_jsonb(v_deal), p_note);

  RETURN v_deal;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_deal(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_deal(uuid, text, text) TO authenticated;

-- Admins can view all businesses (including pending)
DROP POLICY IF EXISTS "Admins view all deal businesses" ON public.deal_businesses;
CREATE POLICY "Admins view all deal businesses" ON public.deal_businesses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR verification_status = 'approved'
    OR owner_id = auth.uid()
    OR public.is_deal_business_member(id, auth.uid())
  );

-- Keep owners able to see their own pending business (already covered by owner_id)
