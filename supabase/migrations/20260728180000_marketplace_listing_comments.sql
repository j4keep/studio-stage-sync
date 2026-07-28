-- Listing comments for YAJ Marketplace (Nextdoor-style activity)

CREATE TABLE IF NOT EXISTS public.marketplace_listing_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.marketplace_listing_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_listing_comments_listing_idx
  ON public.marketplace_listing_comments (listing_id, created_at);

ALTER TABLE public.marketplace_listing_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_comments_read" ON public.marketplace_listing_comments;
CREATE POLICY "mp_comments_read" ON public.marketplace_listing_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "mp_comments_insert" ON public.marketplace_listing_comments;
CREATE POLICY "mp_comments_insert" ON public.marketplace_listing_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mp_comments_update" ON public.marketplace_listing_comments;
CREATE POLICY "mp_comments_update" ON public.marketplace_listing_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mp_comments_delete" ON public.marketplace_listing_comments;
CREATE POLICY "mp_comments_delete" ON public.marketplace_listing_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.marketplace_listing_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marketplace_listing_comments TO authenticated;
GRANT ALL ON public.marketplace_listing_comments TO service_role;
