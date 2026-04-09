
-- Add dispute-related columns to studio_bookings
ALTER TABLE public.studio_bookings
  ADD COLUMN engineer_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN artist_confirmed BOOLEAN DEFAULT NULL,
  ADD COLUMN artist_responded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Function: when artist disputes (artist_confirmed = false while engineer marked complete)
-- auto-create support ticket and notify both parties
CREATE OR REPLACE FUNCTION public.handle_session_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  studio_rec RECORD;
  artist_name TEXT;
  engineer_name TEXT;
  ticket_id UUID;
BEGIN
  -- Only fire when artist_confirmed changes to false and engineer had marked complete
  IF NEW.artist_confirmed = false AND NEW.engineer_completed_at IS NOT NULL THEN
    -- Get studio info
    SELECT s.name, s.user_id INTO studio_rec FROM studios s WHERE s.id = NEW.studio_id LIMIT 1;
    SELECT display_name INTO artist_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    SELECT display_name INTO engineer_name FROM profiles WHERE user_id = studio_rec.user_id LIMIT 1;

    -- Set booking to disputed, keep payment held
    NEW.session_status := 'disputed';
    NEW.payout_status := 'held';

    -- Auto-create support ticket from the artist
    INSERT INTO support_tickets (user_id, subject, message, status)
    VALUES (
      NEW.user_id,
      '⚖️ Session Dispute — ' || COALESCE(studio_rec.name, 'Studio'),
      'Automatic dispute: ' || COALESCE(artist_name, 'Artist') || ' reported a no-show for booking #' || LEFT(NEW.id::text, 8)
        || ' at ' || COALESCE(studio_rec.name, 'a studio')
        || ', but engineer ' || COALESCE(engineer_name, 'the engineer') || ' marked the session as completed.'
        || ' Booking date: ' || NEW.booking_date::text
        || ' | Amount: $' || NEW.total_amount::text
        || ' | Session code: ' || COALESCE(NEW.session_code, 'N/A')
        || '. Please review and resolve.',
      'open'
    ) RETURNING id INTO ticket_id;

    -- Notify artist
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.user_id, 'booking', '⚖️ Session Disputed',
      'Your no-show report for ' || COALESCE(studio_rec.name, 'a studio') || ' is under review. A support ticket has been created.',
      ticket_id, 'ticket');

    -- Notify engineer
    IF studio_rec.user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      VALUES (studio_rec.user_id, 'booking', '⚖️ Session Disputed',
        COALESCE(artist_name, 'An artist') || ' disputed your completed session at ' || COALESCE(studio_rec.name, 'your studio') || '. Payment is held pending review.',
        ticket_id, 'ticket');
    END IF;
  END IF;

  -- When artist confirms completion
  IF NEW.artist_confirmed = true AND NEW.engineer_completed_at IS NOT NULL THEN
    NEW.session_status := 'completed';
    NEW.payout_status := 'released';

    -- Notify engineer of confirmed completion
    SELECT s.name, s.user_id INTO studio_rec FROM studios s WHERE s.id = NEW.studio_id LIMIT 1;
    SELECT display_name INTO artist_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    
    IF studio_rec.user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      VALUES (studio_rec.user_id, 'booking', '✅ Session Confirmed & Paid',
        COALESCE(artist_name, 'The artist') || ' confirmed the session at ' || COALESCE(studio_rec.name, 'your studio') || '. Payment released!',
        NEW.id, 'booking');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_artist_session_response
BEFORE UPDATE ON public.studio_bookings
FOR EACH ROW
WHEN (OLD.artist_confirmed IS DISTINCT FROM NEW.artist_confirmed)
EXECUTE FUNCTION public.handle_session_dispute();
