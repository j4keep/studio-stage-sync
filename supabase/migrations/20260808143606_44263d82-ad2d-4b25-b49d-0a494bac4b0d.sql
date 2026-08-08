ALTER TABLE public.deal_businesses
  ALTER COLUMN verification_status SET DEFAULT 'unverified',
  ALTER COLUMN can_publish SET DEFAULT true;

UPDATE public.deal_businesses
   SET verification_status = 'unverified',
       can_publish = true,
       updated_at = now()
 WHERE verification_status IN ('pending', 'not_started')
    OR verification_status IS NULL;

UPDATE public.deal_businesses
   SET can_publish = true, updated_at = now()
 WHERE can_publish = false
   AND coalesce(verification_status, 'unverified') NOT IN ('rejected', 'suspended');

CREATE OR REPLACE FUNCTION public.submit_deal_for_review(p_deal_id uuid)
RETURNS public.deals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  -- Launch model: verification is optional. Any business in good standing can
  -- publish; only admin-blocked businesses land in the review queue.
  SELECT (coalesce(b.can_publish, true)
          AND coalesce(b.verification_status, 'unverified') NOT IN ('rejected', 'suspended'))
    INTO v_can_publish
    FROM public.deal_businesses b WHERE b.id = v_deal.business_id;

  UPDATE public.deals
     SET status = CASE WHEN COALESCE(v_can_publish, true) THEN 'active' ELSE 'pending_review' END,
         updated_at = now()
   WHERE id = p_deal_id
   RETURNING * INTO v_deal;

  INSERT INTO public.deal_audit_log (deal_id, business_id, actor_id, action)
  VALUES (p_deal_id, v_deal.business_id, v_user, 'submit_' || v_deal.status);

  RETURN v_deal;
END;
$fn$;