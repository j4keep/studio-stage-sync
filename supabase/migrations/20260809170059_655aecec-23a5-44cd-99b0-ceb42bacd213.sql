ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.mp_submit_cart(p_cart_id uuid, p_fulfillment text DEFAULT 'pickup', p_address text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bad RECORD;
  v_fee numeric := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_carts WHERE id = p_cart_id AND buyer_id = auth.uid() AND status = 'open') THEN
    RAISE EXCEPTION 'Cart not found';
  END IF;

  SELECT l.title, l.quantity, i.qty INTO v_bad
  FROM public.marketplace_cart_items i
  JOIN public.marketplace_listings l ON l.id = i.listing_id
  WHERE i.cart_id = p_cart_id AND i.qty > COALESCE(l.quantity, 0)
  LIMIT 1;

  IF v_bad.title IS NOT NULL THEN
    RAISE EXCEPTION 'Not enough stock for %: % left', v_bad.title, COALESCE(v_bad.quantity, 0);
  END IF;

  IF COALESCE(NULLIF(p_fulfillment, ''), 'pickup') = 'delivery' THEN
    SELECT COALESCE(MAX(l.delivery_fee), 0) INTO v_fee
    FROM public.marketplace_cart_items i
    JOIN public.marketplace_listings l ON l.id = i.listing_id
    WHERE i.cart_id = p_cart_id;
  END IF;

  UPDATE public.marketplace_carts
  SET status = 'submitted',
      fulfillment = COALESCE(NULLIF(p_fulfillment, ''), 'pickup'),
      delivery_fee = v_fee,
      delivery_address = p_address,
      note = p_note,
      updated_at = now()
  WHERE id = p_cart_id;
END;
$$;