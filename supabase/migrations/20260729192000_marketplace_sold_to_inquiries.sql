-- Who the item was sold to (for seller rating / accountability)
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS sold_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketplace_listings_sold_to_idx
  ON public.marketplace_listings (sold_to)
  WHERE sold_to IS NOT NULL;

-- Track who inquired (messaged / offered / commented) so Mark Sold can pick a buyer
CREATE TABLE IF NOT EXISTS public.marketplace_listing_inquiries (
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'message',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS marketplace_listing_inquiries_listing_idx
  ON public.marketplace_listing_inquiries (listing_id, updated_at DESC);

ALTER TABLE public.marketplace_listing_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_inquiries_read_parties" ON public.marketplace_listing_inquiries;
CREATE POLICY "mp_inquiries_read_parties"
  ON public.marketplace_listing_inquiries FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.marketplace_listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "mp_inquiries_insert_self" ON public.marketplace_listing_inquiries;
CREATE POLICY "mp_inquiries_insert_self"
  ON public.marketplace_listing_inquiries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mp_inquiries_update_self" ON public.marketplace_listing_inquiries;
CREATE POLICY "mp_inquiries_update_self"
  ON public.marketplace_listing_inquiries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seller may upsert when recording from offers/comments flows
DROP POLICY IF EXISTS "mp_inquiries_seller_write" ON public.marketplace_listing_inquiries;
CREATE POLICY "mp_inquiries_seller_write"
  ON public.marketplace_listing_inquiries FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marketplace_listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listing_inquiries TO authenticated;
GRANT ALL ON public.marketplace_listing_inquiries TO service_role;
GRANT SELECT ON public.marketplace_listing_inquiries TO anon;
