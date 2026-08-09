ALTER TABLE public.marketplace_profiles
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS store_banner_url text,
  ADD COLUMN IF NOT EXISTS store_tagline text;

ALTER TABLE public.marketplace_carts DROP CONSTRAINT IF EXISTS marketplace_carts_status_check;
ALTER TABLE public.marketplace_carts
  ADD CONSTRAINT marketplace_carts_status_check
  CHECK (status IN ('open','submitted','approved','ready','completed','cancelled'));

CREATE OR REPLACE FUNCTION public.mp_find_or_create_conversation(_a uuid, _b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT cp.conversation_id INTO v_id
  FROM public.conversation_participants cp
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = cp.conversation_id AND cp2.user_id = _b
  WHERE cp.user_id = _a
  LIMIT 1;

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.conversations (created_by) VALUES (_a) RETURNING id INTO v_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_id, _a), (v_id, _b);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_notify_cart_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_name text;
  seller_name text;
  v_conv uuid;
  v_lines text := '';
  v_total numeric := 0;
  r record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT display_name INTO buyer_name FROM public.profiles WHERE user_id = NEW.buyer_id LIMIT 1;
  SELECT display_name INTO seller_name FROM public.profiles WHERE user_id = NEW.seller_id LIMIT 1;

  IF NEW.status = 'submitted' THEN
    FOR r IN
      SELECT l.title, i.qty, i.unit_price
      FROM public.marketplace_cart_items i
      JOIN public.marketplace_listings l ON l.id = i.listing_id
      WHERE i.cart_id = NEW.id
    LOOP
      v_lines := v_lines || '• ' || r.qty || ' × ' || r.title || ' ($' || to_char(r.unit_price, 'FM999999.00') || ')' || chr(10);
      v_total := v_total + (r.qty * r.unit_price);
    END LOOP;
    v_total := v_total + CASE WHEN NEW.fulfillment = 'delivery' THEN COALESCE(NEW.delivery_fee, 0) ELSE 0 END;

    INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.seller_id, 'purchase', '🛒 New order received',
      COALESCE(buyer_name, 'A buyer') || ' placed an order — approve it in your store dashboard.',
      NEW.id, 'marketplace_order');

    v_conv := public.mp_find_or_create_conversation(NEW.buyer_id, NEW.seller_id);
    INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content)
    VALUES (v_conv, NEW.buyer_id, NEW.seller_id,
      'New order' || chr(10) || v_lines
      || 'Fulfillment: ' || NEW.fulfillment
      || CASE WHEN NEW.delivery_address IS NOT NULL THEN ' (' || NEW.delivery_address || ')' ELSE '' END || chr(10)
      || 'Total: $' || to_char(v_total, 'FM999999.00')
      || CASE WHEN NEW.note IS NOT NULL THEN chr(10) || 'Note: ' || NEW.note ELSE '' END);
    RETURN NEW;
  END IF;

  IF NEW.status IN ('approved','ready','completed','cancelled') THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.buyer_id, 'purchase',
      CASE NEW.status
        WHEN 'approved' THEN '✅ Order approved'
        WHEN 'ready' THEN '📦 Order ready'
        WHEN 'completed' THEN '🎉 Order completed'
        ELSE '❌ Order cancelled'
      END,
      COALESCE(seller_name, 'The seller') || ' updated your order.',
      NEW.id, 'marketplace_order');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mp_notify_cart_change ON public.marketplace_carts;
CREATE TRIGGER trg_mp_notify_cart_change
AFTER UPDATE ON public.marketplace_carts
FOR EACH ROW EXECUTE FUNCTION public.mp_notify_cart_change();

CREATE OR REPLACE FUNCTION public.mp_notify_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_title text;
  buyer_name text;
BEGIN
  SELECT seller_id, title INTO v_seller, v_title FROM public.marketplace_listings WHERE id = NEW.listing_id;
  IF v_seller IS NULL OR v_seller = NEW.buyer_id THEN RETURN NEW; END IF;
  SELECT display_name INTO buyer_name FROM public.profiles WHERE user_id = NEW.buyer_id LIMIT 1;
  INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (v_seller, 'purchase', '💰 New offer on your listing',
    COALESCE(buyer_name, 'Someone') || ' wants to buy "' || COALESCE(v_title, 'your item') || '".',
    NEW.listing_id, 'marketplace_listing');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mp_notify_offer ON public.marketplace_offers;
CREATE TRIGGER trg_mp_notify_offer
AFTER INSERT ON public.marketplace_offers
FOR EACH ROW EXECUTE FUNCTION public.mp_notify_offer();

CREATE OR REPLACE FUNCTION public.mp_set_cart_status(p_cart_id uuid, p_status text, p_delivery_fee numeric DEFAULT NULL::numeric)
RETURNS void
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
  IF p_status NOT IN ('approved', 'ready', 'completed', 'cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  IF p_status IN ('approved', 'ready') AND auth.uid() <> v_cart.seller_id THEN
    RAISE EXCEPTION 'Only the seller can approve an order';
  END IF;

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