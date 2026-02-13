
-- Create studios table
CREATE TABLE IF NOT EXISTS public.studios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  daily_rate NUMERIC,
  equipment TEXT[] DEFAULT '{}',
  engineer_available BOOLEAN DEFAULT false,
  rating NUMERIC DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view studios" ON public.studios FOR SELECT USING (true);
CREATE POLICY "Users can create their own studios" ON public.studios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own studios" ON public.studios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own studios" ON public.studios FOR DELETE USING (auth.uid() = user_id);

-- Create studio_photos table
CREATE TABLE IF NOT EXISTS public.studio_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view studio photos" ON public.studio_photos FOR SELECT USING (true);
CREATE POLICY "Studio owners can insert photos" ON public.studio_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));
CREATE POLICY "Studio owners can delete photos" ON public.studio_photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));

-- Create studio_availability table
CREATE TABLE IF NOT EXISTS public.studio_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_booked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view availability" ON public.studio_availability FOR SELECT USING (true);
CREATE POLICY "Studio owners can manage availability" ON public.studio_availability FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));
CREATE POLICY "Studio owners can update availability" ON public.studio_availability FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));
CREATE POLICY "Studio owners can delete availability" ON public.studio_availability FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));
