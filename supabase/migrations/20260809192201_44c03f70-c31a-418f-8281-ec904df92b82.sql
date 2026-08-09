ALTER TABLE public.marketplace_profiles
  ADD COLUMN IF NOT EXISTS store_address text,
  ADD COLUMN IF NOT EXISTS store_lat double precision,
  ADD COLUMN IF NOT EXISTS store_lng double precision,
  ADD COLUMN IF NOT EXISTS delivery_per_mile numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_min_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_max_miles numeric NOT NULL DEFAULT 0;

ALTER TABLE public.marketplace_carts
  ADD COLUMN IF NOT EXISTS delivery_miles numeric;

CREATE OR REPLACE FUNCTION public.mp_submit_cart(p_cart_id uuid, p_fulfillment text DEFAULT 'pickup'::text, p_address text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_miles numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bad RECORD;
  v_fee numeric := 0;
  v_seller uuid;
  v_rate numeric := 0;
  v_min numeric := 0;
  v_max numeric := 0;
BEGIN
  SELECT seller_id INTO v_seller FROM public.marketplace_carts
  WHERE id = p_cart_id AND buyer_id = auth.uid() AND status = 'open';
  IF v_seller IS NULL THEN RAISE EXCEPTION 'Cart not found'; END IF;

  SELECT l.title, l.quantity, i.qty INTO v_bad
  FROM public.marketplace_cart_items i
  JOIN public.marketplace_listings l ON l.id = i.listing_id
  WHERE i.cart_id = p_cart_id AND i.qty > COALESCE(l.quantity, 0)
  LIMIT 1;

  IF v_bad.title IS NOT NULL THEN
    RAISE EXCEPTION 'Not enough stock for %: % left', v_bad.title, COALESCE(v_bad.quantity, 0);
  END IF;

  IF COALESCE(NULLIF(p_fulfillment, ''), 'pickup') = 'delivery' THEN
    SELECT COALESCE(delivery_per_mile, 0), COALESCE(delivery_min_fee, 0), COALESCE(delivery_max_miles, 0)
      INTO v_rate, v_min, v_max
    FROM public.marketplace_profiles WHERE user_id = v_seller;

    IF v_rate > 0 AND p_miles IS NOT NULL THEN
      IF v_max > 0 AND p_miles > v_max THEN
        RAISE EXCEPTION 'This seller only delivers within % miles', v_max;
      END IF;
      v_fee := GREATEST(ROUND(v_rate * p_miles, 2), v_min);
    ELSE
      SELECT COALESCE(MAX(l.delivery_fee), 0) INTO v_fee
      FROM public.marketplace_cart_items i
      JOIN public.marketplace_listings l ON l.id = i.listing_id
      WHERE i.cart_id = p_cart_id;
    END IF;
  END IF;

  UPDATE public.marketplace_carts
  SET status = 'submitted',
      fulfillment = COALESCE(NULLIF(p_fulfillment, ''), 'pickup'),
      delivery_fee = v_fee,
      delivery_miles = CASE WHEN COALESCE(NULLIF(p_fulfillment, ''), 'pickup') = 'delivery' THEN p_miles ELSE NULL END,
      delivery_address = p_address,
      note = p_note,
      updated_at = now()
  WHERE id = p_cart_id;
END;
$function$;