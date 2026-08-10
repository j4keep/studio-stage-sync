ALTER TABLE public.marketplace_carts
  ADD COLUMN IF NOT EXISTS seller_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_complete_reminder_at timestamptz;

CREATE TABLE IF NOT EXISTS public.store_seller_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.marketplace_carts(id) ON DELETE CASCADE,
  listing_id uuid,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text,
  seller_reply text,
  seller_replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, buyer_id)
);

GRANT SELECT, INSERT, UPDATE ON public.store_seller_reviews TO authenticated;
GRANT SELECT ON public.store_seller_reviews TO anon;
GRANT ALL ON public.store_seller_reviews TO service_role;

ALTER TABLE public.store_seller_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store reviews are public"
ON public.store_seller_reviews FOR SELECT
USING (true);

CREATE POLICY "Buyer can review a completed store order"
ON public.store_seller_reviews FOR INSERT TO authenticated
WITH CHECK (
  buyer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.marketplace_carts c
    WHERE c.id = cart_id
      AND c.buyer_id = auth.uid()
      AND c.seller_id = store_seller_reviews.seller_id
      AND c.seller_completed_at IS NOT NULL
  )
);

CREATE POLICY "Buyer can edit their own store review"
ON public.store_seller_reviews FOR UPDATE TO authenticated
USING (buyer_id = auth.uid())
WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Seller can reply to their store review"
ON public.store_seller_reviews FOR UPDATE TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

CREATE TRIGGER store_seller_reviews_updated_at
BEFORE UPDATE ON public.store_seller_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS store_seller_reviews_seller_idx ON public.store_seller_reviews(seller_id);
CREATE INDEX IF NOT EXISTS store_seller_reviews_listing_idx ON public.store_seller_reviews(listing_id);

CREATE OR REPLACE FUNCTION public.mp_complete_cart(p_cart_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cart RECORD;
  v_is_seller boolean;
BEGIN
  SELECT * INTO v_cart FROM public.marketplace_carts WHERE id = p_cart_id;
  IF v_cart.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() <> v_cart.seller_id AND auth.uid() <> v_cart.buyer_id THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_cart.status IN ('open', 'cancelled') THEN RAISE EXCEPTION 'This order cannot be completed yet'; END IF;

  v_is_seller := auth.uid() = v_cart.seller_id;

  IF v_is_seller THEN
    IF v_cart.seller_completed_at IS NULL THEN
      UPDATE public.marketplace_listings l
      SET quantity = GREATEST(COALESCE(l.quantity, 0) - i.qty, 0), updated_at = now()
      FROM public.marketplace_cart_items i
      WHERE i.cart_id = p_cart_id AND l.id = i.listing_id;
    END IF;
    UPDATE public.marketplace_carts
    SET seller_completed_at = COALESCE(seller_completed_at, now()),
        status = 'completed',
        updated_at = now()
    WHERE id = p_cart_id;

    INSERT INTO public.notifications (user_id, type, title, body, message, reference_id, reference_type, link)
    VALUES (v_cart.buyer_id, 'marketplace', 'Rate your seller',
            'Your order is complete — leave a star rating and comment for the seller.',
            'Your order is complete — leave a star rating and comment for the seller.',
            p_cart_id, 'marketplace_cart', '/marketplace/purchases');
  ELSE
    UPDATE public.marketplace_carts
    SET buyer_completed_at = COALESCE(buyer_completed_at, now()),
        updated_at = now()
    WHERE id = p_cart_id;

    INSERT INTO public.notifications (user_id, type, title, body, message, reference_id, reference_type, link)
    VALUES (v_cart.seller_id, 'marketplace', 'Buyer confirmed the sale',
            'The buyer marked this order complete.',
            'The buyer marked this order complete.',
            p_cart_id, 'marketplace_cart', '/marketplace/orders');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_notify_store_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, message, reference_id, reference_type, link)
    VALUES (NEW.seller_id, 'marketplace', 'New store rating',
            NEW.score || '-star rating on your $1–$5 store. You can reply to it.',
            NEW.score || '-star rating on your $1–$5 store. You can reply to it.',
            NEW.cart_id, 'store_review', '/marketplace/orders');
  ELSIF NEW.seller_reply IS DISTINCT FROM OLD.seller_reply AND NEW.seller_reply IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, message, reference_id, reference_type, link)
    VALUES (NEW.buyer_id, 'marketplace', 'Seller replied to your review',
            NEW.seller_reply, NEW.seller_reply,
            NEW.cart_id, 'store_review', '/marketplace/purchases');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER store_seller_reviews_notify
AFTER INSERT OR UPDATE ON public.store_seller_reviews
FOR EACH ROW EXECUTE FUNCTION public.mp_notify_store_review();

CREATE OR REPLACE FUNCTION public.mp_store_completion_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM public.marketplace_carts
    WHERE status NOT IN ('open', 'cancelled')
      AND (seller_completed_at IS NULL OR buyer_completed_at IS NULL)
      AND (last_complete_reminder_at IS NULL OR last_complete_reminder_at < now() - interval '20 hours')
  LOOP
    IF r.seller_completed_at IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, message, reference_id, reference_type, link)
      VALUES (r.seller_id, 'marketplace', 'Complete your sale',
              'You have a sale waiting to be marked complete.',
              'You have a sale waiting to be marked complete.',
              r.id, 'marketplace_cart', '/marketplace/orders');
      v_count := v_count + 1;
    END IF;
    IF r.buyer_completed_at IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, message, reference_id, reference_type, link)
      VALUES (r.buyer_id, 'marketplace', 'Confirm your order',
              'Confirm you received your order, then rate the seller.',
              'Confirm you received your order, then rate the seller.',
              r.id, 'marketplace_cart', '/marketplace/purchases');
      v_count := v_count + 1;
    END IF;
    UPDATE public.marketplace_carts SET last_complete_reminder_at = now() WHERE id = r.id;
  END LOOP;
  RETURN v_count;
END;
$$;