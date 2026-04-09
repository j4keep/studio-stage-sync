
-- 1. Add auto_accept to studios
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS auto_accept boolean NOT NULL DEFAULT false;

-- 2. Add booking management columns
ALTER TABLE public.studio_bookings 
  ADD COLUMN IF NOT EXISTS approval_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'held';

-- 3. Allow artists to update their own bookings (for cancellation)
CREATE POLICY "Artists can update own bookings"
ON public.studio_bookings
FOR UPDATE
USING (auth.uid() = user_id);

-- 4. Update the new booking trigger to handle auto-accept and set deadline
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  artist_name text;
  studio_rec record;
BEGIN
  SELECT display_name INTO artist_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
  SELECT s.name, s.user_id, s.auto_accept INTO studio_rec FROM studios s WHERE s.id = NEW.studio_id LIMIT 1;

  -- If studio has auto-accept, confirm immediately
  IF studio_rec.auto_accept = true THEN
    NEW.status := 'confirmed';
    NEW.approval_deadline := NULL;

    -- Notify artist: auto-approved
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.user_id, 'booking', '✅ Booking Auto-Approved!',
      'Your session at ' || COALESCE(studio_rec.name, 'a studio') || ' has been automatically approved!',
      NEW.id, 'booking');

    -- Notify engineer
    IF studio_rec.user_id IS NOT NULL AND studio_rec.user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      VALUES (studio_rec.user_id, 'booking', '📩 New Booking (Auto-Approved)',
        COALESCE(artist_name, 'An artist') || ' booked a session at ' || COALESCE(studio_rec.name, 'your studio') || ' (auto-approved)',
        NEW.id, 'booking');
    END IF;
  ELSE
    -- Set 10-minute approval deadline
    NEW.approval_deadline := now() + interval '10 minutes';

    -- Notify artist: pending
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.user_id, 'booking', '🎙️ Booking Submitted',
      'Your session at ' || COALESCE(studio_rec.name, 'a studio') || ' is pending approval (10 min window)',
      NEW.id, 'booking');

    -- Notify engineer: needs action
    IF studio_rec.user_id IS NOT NULL AND studio_rec.user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      VALUES (studio_rec.user_id, 'booking', '⏰ New Booking — Respond in 10 min!',
        COALESCE(artist_name, 'An artist') || ' requested a session at ' || COALESCE(studio_rec.name, 'your studio') || '. Approve within 10 minutes!',
        NEW.id, 'booking');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Need to change trigger to BEFORE INSERT so we can modify NEW
DROP TRIGGER IF EXISTS trg_notify_new_booking ON public.studio_bookings;
CREATE TRIGGER trg_notify_new_booking
BEFORE INSERT ON public.studio_bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_booking();

-- 5. Function to expire unanswered bookings
CREATE OR REPLACE FUNCTION public.expire_pending_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer := 0;
  booking_row record;
  studio_name text;
BEGIN
  FOR booking_row IN
    SELECT sb.*, s.name as s_name
    FROM studio_bookings sb
    JOIN studios s ON s.id = sb.studio_id
    WHERE sb.status = 'pending'
      AND sb.approval_deadline IS NOT NULL
      AND sb.approval_deadline < now()
  LOOP
    UPDATE studio_bookings SET status = 'expired' WHERE id = booking_row.id;
    
    -- Notify artist to find another engineer
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (booking_row.user_id, 'booking', '⏳ Booking Expired',
      'The engineer at ' || COALESCE(booking_row.s_name, 'the studio') || ' didn''t respond in time. Please try another studio.',
      booking_row.id, 'booking');
    
    expired_count := expired_count + 1;
  END LOOP;
  
  RETURN expired_count;
END;
$$;
