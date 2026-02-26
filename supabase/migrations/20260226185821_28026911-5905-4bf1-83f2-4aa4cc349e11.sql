
CREATE TABLE public.boosts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('song', 'video', 'studio', 'store_product')),
  content_id UUID NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 5,
  duration_days INTEGER NOT NULL DEFAULT 3,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own boosts" ON public.boosts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own boosts" ON public.boosts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own boosts" ON public.boosts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view active boosts" ON public.boosts FOR SELECT USING (status = 'active' AND end_date > now());
