
-- Create no_show_strikes table
CREATE TABLE public.no_show_strikes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID NOT NULL,
  booking_id UUID NOT NULL REFERENCES public.studio_bookings(id),
  studio_id UUID NOT NULL REFERENCES public.studios(id),
  reported_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one strike per booking
ALTER TABLE public.no_show_strikes ADD CONSTRAINT unique_strike_per_booking UNIQUE (booking_id);

-- Enable RLS
ALTER TABLE public.no_show_strikes ENABLE ROW LEVEL SECURITY;

-- Anyone can view strikes (transparency)
CREATE POLICY "Anyone can view no-show strikes"
ON public.no_show_strikes FOR SELECT
USING (true);

-- Artists can report no-shows for their own bookings
CREATE POLICY "Artists can report no-shows for their bookings"
ON public.no_show_strikes FOR INSERT
WITH CHECK (
  auth.uid() = reported_by
  AND booking_id IN (
    SELECT id FROM public.studio_bookings WHERE user_id = auth.uid()
  )
);

-- Add no_show_count to studios
ALTER TABLE public.studios ADD COLUMN no_show_count INTEGER DEFAULT 0;

-- Trigger to increment studio no_show_count
CREATE OR REPLACE FUNCTION public.increment_no_show_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.studios
  SET no_show_count = COALESCE(no_show_count, 0) + 1
  WHERE id = NEW.studio_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_no_show_strike_inserted
AFTER INSERT ON public.no_show_strikes
FOR EACH ROW
EXECUTE FUNCTION public.increment_no_show_count();
