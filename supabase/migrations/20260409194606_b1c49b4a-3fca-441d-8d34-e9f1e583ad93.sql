
-- Change default status to pending so engineers must approve
ALTER TABLE public.studio_bookings ALTER COLUMN status SET DEFAULT 'pending';

-- Allow studio owners to update bookings for their studios (approve/reject)
CREATE POLICY "Studio owners can update bookings"
ON public.studio_bookings
FOR UPDATE
USING (
  studio_id IN (SELECT id FROM studios WHERE user_id = auth.uid())
);

-- Trigger: notify both parties on new booking
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
  SELECT s.name, s.user_id INTO studio_rec FROM studios s WHERE s.id = NEW.studio_id LIMIT 1;

  -- Notify the artist (booker)
  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (NEW.user_id, 'booking', '🎙️ Booking Submitted',
    'Your session at ' || COALESCE(studio_rec.name, 'a studio') || ' is pending approval',
    NEW.id, 'booking');

  -- Notify the engineer (studio owner)
  IF studio_rec.user_id IS NOT NULL AND studio_rec.user_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (studio_rec.user_id, 'booking', '📩 New Booking Request',
      COALESCE(artist_name, 'An artist') || ' requested a session at ' || COALESCE(studio_rec.name, 'your studio'),
      NEW.id, 'booking');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_booking
AFTER INSERT ON public.studio_bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_booking();

-- Trigger: notify artist when engineer approves or rejects
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  studio_name text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT s.name INTO studio_name FROM studios s WHERE s.id = NEW.studio_id LIMIT 1;

  IF NEW.status = 'confirmed' THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.user_id, 'booking', '✅ Booking Approved!',
      'Your booking at ' || COALESCE(studio_name, 'a studio') || ' has been approved!',
      NEW.id, 'booking');
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.user_id, 'booking', '❌ Booking Declined',
      'Your booking at ' || COALESCE(studio_name, 'a studio') || ' was declined',
      NEW.id, 'booking');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_booking_status_change
AFTER UPDATE ON public.studio_bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_status_change();
