-- $1-$5 Finds carts for the marketplace
CREATE TABLE IF NOT EXISTS public.marketplace_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  fulfillment TEXT NOT NULL DEFAULT 'pickup',
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_carts_open_uniq
  ON public.marketplace_carts (buyer_id, seller_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS marketplace_carts_seller_idx ON public.marketplace_carts (seller_id, status);

CREATE TABLE IF NOT EXISTS public.marketplace_cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES public.marketplace_carts(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, listing_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_carts TO authenticated;
GRANT ALL ON public.marketplace_carts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_cart_items TO authenticated;
GRANT ALL ON public.marketplace_cart_items TO service_role;

ALTER TABLE public.marketplace_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyer or seller can view carts" ON public.marketplace_carts;
CREATE POLICY "Buyer or seller can view carts" ON public.marketplace_carts
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyer creates own cart" ON public.marketplace_carts;
CREATE POLICY "Buyer creates own cart" ON public.marketplace_carts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Buyer or seller updates cart" ON public.marketplace_carts;
CREATE POLICY "Buyer or seller updates cart" ON public.marketplace_carts
  FOR UPDATE TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyer deletes own cart" ON public.marketplace_carts;
CREATE POLICY "Buyer deletes own cart" ON public.marketplace_carts
  FOR DELETE TO authenticated USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Buyer or seller can view cart items" ON public.marketplace_cart_items;
CREATE POLICY "Buyer or seller can view cart items" ON public.marketplace_cart_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.marketplace_carts c
    WHERE c.id = cart_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Buyer manages cart items" ON public.marketplace_cart_items;
CREATE POLICY "Buyer manages cart items" ON public.marketplace_cart_items
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.marketplace_carts c WHERE c.id = cart_id AND c.buyer_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.marketplace_carts c WHERE c.id = cart_id AND c.buyer_id = auth.uid()
  ));

-- Add / update a cart line, enforcing seller inventory and the $5 cap
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

  SELECT id, seller_id, price, quantity, status
    INTO v_listing
  FROM public.marketplace_listings
  WHERE id = p_listing_id AND deleted_at IS NULL;

  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.seller_id = auth.uid() THEN RAISE EXCEPTION 'You cannot buy your own listing'; END IF;
  IF v_listing.status <> 'active' THEN RAISE EXCEPTION 'Listing is no longer available'; END IF;
  IF COALESCE(v_listing.price, 0) > 5 THEN RAISE EXCEPTION 'Cart is only for $1-$5 items'; END IF;
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
    VALUES (v_cart_id, p_listing_id, p_qty, COALESCE(v_listing.price, 0))
    ON CONFLICT (cart_id, listing_id) DO UPDATE SET qty = EXCLUDED.qty, unit_price = EXCLUDED.unit_price;
  END IF;

  UPDATE public.marketplace_carts SET updated_at = now() WHERE id = v_cart_id;
  RETURN v_cart_id;
END;
$$;

-- Buyer sends the cart to the seller; re-checks inventory for every line
CREATE OR REPLACE FUNCTION public.mp_submit_cart(
  p_cart_id UUID,
  p_fulfillment TEXT,
  p_address TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bad RECORD;
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

  UPDATE public.marketplace_carts
  SET status = 'submitted',
      fulfillment = COALESCE(NULLIF(p_fulfillment, ''), 'pickup'),
      delivery_address = p_address,
      note = p_note,
      updated_at = now()
  WHERE id = p_cart_id;
END;
$$;

-- Seller advances an order; completing it draws stock down
CREATE OR REPLACE FUNCTION public.mp_set_cart_status(p_cart_id UUID, p_status TEXT, p_delivery_fee NUMERIC DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart RECORD;
BEGIN
  SELECT * INTO v_cart FROM public.marketplace_carts WHERE id = p_cart_id;
  IF v_cart.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() <> v_cart.seller_id AND auth.uid() <> v_cart.buyer_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_status NOT IN ('ready', 'completed', 'cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  IF p_status = 'completed' THEN
    IF auth.uid() <> v_cart.seller_id THEN RAISE EXCEPTION 'Only the seller can complete an order'; END IF;
    UPDATE public.marketplace_listings l
    SET quantity = GREATEST(COALESCE(l.quantity, 0) - i.qty, 0), updated_at = now()
    FROM public.marketplace_cart_items i
    WHERE i.cart_id = p_cart_id AND l.id = i.listing_id;
  END IF;

  UPDATE public.marketplace_carts
  SET status = p_status,
      delivery_fee = COALESCE(p_delivery_fee, delivery_fee),
      updated_at = now()
  WHERE id = p_cart_id;
END;
$$;