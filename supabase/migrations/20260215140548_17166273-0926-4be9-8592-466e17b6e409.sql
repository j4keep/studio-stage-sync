
-- Studio bookings table
CREATE TABLE public.studio_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  booking_date DATE NOT NULL,
  hours INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookings" ON public.studio_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookings" ON public.studio_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Studio owners can view bookings for their studios" ON public.studio_bookings FOR SELECT USING (
  studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid())
);

-- Studio reviews table (only bookers can review)
CREATE TABLE public.studio_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  booking_id UUID NOT NULL REFERENCES public.studio_bookings(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_id)
);

ALTER TABLE public.studio_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.studio_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews for their bookings" ON public.studio_reviews FOR INSERT WITH CHECK (
  auth.uid() = user_id AND booking_id IN (SELECT id FROM public.studio_bookings WHERE user_id = auth.uid())
);

-- Trigger to update studio rating on new review
CREATE OR REPLACE FUNCTION public.update_studio_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.studios SET
    rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.studio_reviews WHERE studio_id = NEW.studio_id),
    reviews_count = (SELECT COUNT(*) FROM public.studio_reviews WHERE studio_id = NEW.studio_id)
  WHERE id = NEW.studio_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_review_update_studio_rating
AFTER INSERT ON public.studio_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_studio_rating();
