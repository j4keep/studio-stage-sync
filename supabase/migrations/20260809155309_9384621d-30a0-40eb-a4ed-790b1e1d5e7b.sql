CREATE OR REPLACE FUNCTION public.validate_marketplace_five_under()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_type = 'five_under' THEN
    IF NEW.price IS NULL OR NEW.price < 1 OR NEW.price > 5 THEN
      RAISE EXCEPTION '$1-$5 Finds must be priced between $1 and $5';
    END IF;
    IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN
      RAISE EXCEPTION 'Inventory must be at least 1 for $1-$5 Finds';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_marketplace_five_under_trg ON public.marketplace_listings;
CREATE TRIGGER validate_marketplace_five_under_trg
BEFORE INSERT OR UPDATE OF listing_type, price, quantity ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.validate_marketplace_five_under();

CREATE OR REPLACE FUNCTION public.mp_set_cart_item(p_listing_id UUID, p_qty INTEGER)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_cart_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;

  SELECT id, seller_id, listing_type, price, quantity, status
    INTO v_listing
  FROM public.marketplace_listings
  WHERE id = p_listing_id AND deleted_at IS NULL;

  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.seller_id = auth.uid() THEN RAISE EXCEPTION 'You cannot buy your own listing'; END IF;
  IF v_listing.status <> 'active' THEN RAISE EXCEPTION 'Listing is no longer available'; END IF;
  IF v_listing.listing_type <> 'five_under' OR v_listing.price < 1 OR v_listing.price > 5 THEN
    RAISE EXCEPTION 'Cart is only for $1-$5 Finds';
  END IF;
  IF p_qty > COALESCE(v_listing.quantity, 0) THEN
    RAISE EXCEPTION 'Only % left in stock', COALESCE(v_listing.quantity, 0);
  END IF;

  SELECT id INTO v_cart_id FROM public.marketplace_carts
  WHERE buyer_id = auth.uid() AND seller_id = v_listing.seller_id AND status = 'open';

  IF v_cart_id IS NULL THEN
    INSERT INTO public.marketplace_carts (buyer_id, seller_id)
    VALUES (auth.uid(), v_listing.seller_id) RETURNING id INTO v_cart_id;
  END IF;

  IF p_qty <= 0 THEN
    DELETE FROM public.marketplace_cart_items WHERE cart_id = v_cart_id AND listing_id = p_listing_id;
  ELSE
    INSERT INTO public.marketplace_cart_items (cart_id, listing_id, qty, unit_price)
    VALUES (v_cart_id, p_listing_id, p_qty, v_listing.price)
    ON CONFLICT (cart_id, listing_id) DO UPDATE SET qty = EXCLUDED.qty, unit_price = EXCLUDED.unit_price;
  END IF;

  UPDATE public.marketplace_carts SET updated_at = now() WHERE id = v_cart_id;
  RETURN v_cart_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mp_set_cart_item(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mp_set_cart_item(UUID, INTEGER) TO authenticated, service_role;