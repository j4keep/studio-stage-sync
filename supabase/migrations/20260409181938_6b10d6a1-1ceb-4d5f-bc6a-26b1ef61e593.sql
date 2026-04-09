
-- Add session_code and session_status to studio_bookings
ALTER TABLE public.studio_bookings 
ADD COLUMN IF NOT EXISTS session_code text UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
ADD COLUMN IF NOT EXISTS session_status text NOT NULL DEFAULT 'pending';

-- Create index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_studio_bookings_session_code ON public.studio_bookings(session_code);

-- Allow anyone authenticated to look up a booking by session_code (for joining sessions)
CREATE POLICY "Users can look up bookings by session code"
ON public.studio_bookings
FOR SELECT
TO authenticated
USING (true);

-- Function to generate unique session codes for new bookings
CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_code IS NULL THEN
    NEW.session_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_session_code
BEFORE INSERT ON public.studio_bookings
FOR EACH ROW
EXECUTE FUNCTION public.generate_session_code();
