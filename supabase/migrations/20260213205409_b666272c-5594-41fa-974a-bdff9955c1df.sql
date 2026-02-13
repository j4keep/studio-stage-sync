
-- Store products table for digital downloads
CREATE TABLE public.store_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Digital Download',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cover_url TEXT,
  file_url TEXT,
  file_name TEXT,
  sales INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

-- Owner can CRUD their own products
CREATE POLICY "Users can view their own products"
  ON public.store_products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own products"
  ON public.store_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
  ON public.store_products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
  ON public.store_products FOR DELETE
  USING (auth.uid() = user_id);

-- Anyone can view products for purchase (public storefront)
CREATE POLICY "Anyone can view listed products"
  ON public.store_products FOR SELECT
  USING (true);

-- Purchases tracking table
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "System can insert purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);
