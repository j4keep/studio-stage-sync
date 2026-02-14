-- Add mood tags and audio preview URL to store_products
ALTER TABLE public.store_products
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preview_url text;

-- Add artist_name column so we can display seller names without joins
ALTER TABLE public.store_products
ADD COLUMN IF NOT EXISTS artist_name text;

-- Allow public read access to store_products for the marketplace
CREATE POLICY "Anyone can view store products"
ON public.store_products
FOR SELECT
USING (true);