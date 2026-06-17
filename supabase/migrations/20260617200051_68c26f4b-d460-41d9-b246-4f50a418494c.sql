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
  auto_accept BOOLEAN NOT NULL DEFAULT false,
  no_show_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studios TO authenticated;
GRANT ALL ON public.studios TO service_role;
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view studios" ON public.studios FOR SELECT USING (true);
CREATE POLICY "Users can create their own studios" ON public.studios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own studios" ON public.studios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own studios" ON public.studios FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.studio_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_photos TO authenticated;
GRANT ALL ON public.studio_photos TO service_role;
ALTER TABLE public.studio_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view studio photos" ON public.studio_photos FOR SELECT USING (true);
CREATE POLICY "Studio owners can insert photos" ON public.studio_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));
CREATE POLICY "Studio owners can delete photos" ON public.studio_photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.studio_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_booked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_availability TO authenticated;
GRANT ALL ON public.studio_availability TO service_role;
ALTER TABLE public.studio_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view availability" ON public.studio_availability FOR SELECT USING (true);
CREATE POLICY "Studio owners can manage availability" ON public.studio_availability FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));
CREATE POLICY "Studio owners can update availability" ON public.studio_availability FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));
CREATE POLICY "Studio owners can delete availability" ON public.studio_availability FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.studios WHERE id = studio_id AND user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.studio_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  booking_date DATE NOT NULL,
  hours INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  session_code TEXT UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  session_status TEXT NOT NULL DEFAULT 'pending',
  approval_deadline TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_fee NUMERIC NOT NULL DEFAULT 0,
  payout_status TEXT NOT NULL DEFAULT 'held',
  engineer_completed_at TIMESTAMPTZ,
  artist_confirmed BOOLEAN,
  artist_responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_studio_bookings_session_code ON public.studio_bookings(session_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_bookings TO authenticated;
GRANT ALL ON public.studio_bookings TO service_role;
ALTER TABLE public.studio_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own bookings" ON public.studio_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookings" ON public.studio_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Studio owners can view bookings for their studios" ON public.studio_bookings FOR SELECT USING (
  studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid())
);
CREATE POLICY "Users can look up bookings by session code" ON public.studio_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Studio owners can update bookings" ON public.studio_bookings FOR UPDATE USING (
  studio_id IN (SELECT id FROM public.studios WHERE user_id = auth.uid())
);
CREATE POLICY "Artists can update own bookings" ON public.studio_bookings FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.studio_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  booking_id UUID NOT NULL REFERENCES public.studio_bookings(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(booking_id)
);
GRANT SELECT ON public.studio_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_reviews TO authenticated;
GRANT ALL ON public.studio_reviews TO service_role;
ALTER TABLE public.studio_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.studio_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews for their bookings" ON public.studio_reviews FOR INSERT WITH CHECK (
  auth.uid() = user_id AND booking_id IN (SELECT id FROM public.studio_bookings WHERE user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.update_studio_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.studios SET
    rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.studio_reviews WHERE studio_id = NEW.studio_id),
    reviews_count = (SELECT COUNT(*) FROM public.studio_reviews WHERE studio_id = NEW.studio_id)
  WHERE id = NEW.studio_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_review_update_studio_rating AFTER INSERT ON public.studio_reviews FOR EACH ROW EXECUTE FUNCTION public.update_studio_rating();

CREATE TABLE IF NOT EXISTS public.recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  beat_url TEXT,
  beat_name TEXT,
  cover_url TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recording_sessions TO authenticated;
GRANT ALL ON public.recording_sessions TO service_role;
ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.recording_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.recording_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.recording_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.recording_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.recording_takes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Take 1',
  audio_url TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  muted BOOLEAN NOT NULL DEFAULT false,
  solo BOOLEAN NOT NULL DEFAULT false,
  trim_start INTEGER NOT NULL DEFAULT 0,
  trim_end INTEGER NOT NULL DEFAULT 100,
  waveform_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recording_takes TO authenticated;
GRANT ALL ON public.recording_takes TO service_role;
ALTER TABLE public.recording_takes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own takes" ON public.recording_takes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own takes" ON public.recording_takes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own takes" ON public.recording_takes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own takes" ON public.recording_takes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.recording_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.recording_sessions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  artist_name TEXT,
  audio_url TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recording_exports TO authenticated;
GRANT ALL ON public.recording_exports TO service_role;
ALTER TABLE public.recording_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own exports" ON public.recording_exports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exports" ON public.recording_exports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own exports" ON public.recording_exports FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.session_code IS NULL THEN
    NEW.session_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  artist_name text;
  studio_rec record;
BEGIN
  SELECT display_name INTO artist_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
  SELECT s.name, s.user_id, s.auto_accept INTO studio_rec FROM studios s WHERE s.id = NEW.studio_id LIMIT 1;
  IF studio_rec.auto_accept = true THEN
    NEW.status := 'confirmed';
    NEW.approval_deadline := NULL;
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.user_id, 'booking', '✅ Booking Auto-Approved!',
      'Your session at ' || COALESCE(studio_rec.name, 'a studio') || ' has been automatically approved!',
      NEW.id, 'booking');
    IF studio_rec.user_id IS NOT NULL AND studio_rec.user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      VALUES (studio_rec.user_id, 'booking', '📩 New Booking (Auto-Approved)',
        COALESCE(artist_name, 'An artist') || ' booked a session at ' || COALESCE(studio_rec.name, 'your studio') || ' (auto-approved)',
        NEW.id, 'booking');
    END IF;
  ELSE
    NEW.approval_deadline := now() + interval '10 minutes';
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.user_id, 'booking', '🎙️ Booking Submitted',
      'Your session at ' || COALESCE(studio_rec.name, 'a studio') || ' is pending approval (10 min window)',
      NEW.id, 'booking');
    IF studio_rec.user_id IS NOT NULL AND studio_rec.user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      VALUES (studio_rec.user_id, 'booking', '⏰ New Booking — Respond in 10 min!',
        COALESCE(artist_name, 'An artist') || ' requested a session at ' || COALESCE(studio_rec.name, 'your studio') || '. Approve within 10 minutes!',
        NEW.id, 'booking');
    END IF;
  END IF;
  IF NEW.session_code IS NULL THEN
    NEW.session_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_new_booking BEFORE INSERT ON public.studio_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_new_booking();

CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE studio_name text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
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
CREATE TRIGGER trg_notify_booking_status_change AFTER UPDATE ON public.studio_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status_change();

CREATE OR REPLACE FUNCTION public.expire_pending_bookings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE expired_count integer := 0; booking_row record;
BEGIN
  FOR booking_row IN
    SELECT sb.*, s.name as s_name FROM studio_bookings sb JOIN studios s ON s.id = sb.studio_id
    WHERE sb.status = 'pending' AND sb.approval_deadline IS NOT NULL AND sb.approval_deadline < now()
  LOOP
    UPDATE studio_bookings SET status = 'expired' WHERE id = booking_row.id;
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (booking_row.user_id, 'booking', '⏳ Booking Expired',
      'The engineer at ' || COALESCE(booking_row.s_name, 'the studio') || ' didn''t respond in time. Please try another studio.',
      booking_row.id, 'booking');
    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END;
$$;

CREATE TABLE IF NOT EXISTS public.no_show_strikes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id UUID NOT NULL,
  booking_id UUID NOT NULL REFERENCES public.studio_bookings(id),
  studio_id UUID NOT NULL REFERENCES public.studios(id),
  reported_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_strike_per_booking UNIQUE (booking_id)
);
GRANT SELECT ON public.no_show_strikes TO anon;
GRANT SELECT, INSERT ON public.no_show_strikes TO authenticated;
GRANT ALL ON public.no_show_strikes TO service_role;
ALTER TABLE public.no_show_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view no-show strikes" ON public.no_show_strikes FOR SELECT USING (true);
CREATE POLICY "Artists can report no-shows for their bookings" ON public.no_show_strikes FOR INSERT WITH CHECK (
  auth.uid() = reported_by AND booking_id IN (SELECT id FROM public.studio_bookings WHERE user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.increment_no_show_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.studios SET no_show_count = COALESCE(no_show_count, 0) + 1 WHERE id = NEW.studio_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_no_show_strike_inserted AFTER INSERT ON public.no_show_strikes FOR EACH ROW EXECUTE FUNCTION public.increment_no_show_count();

CREATE OR REPLACE FUNCTION public.handle_session_dispute()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE studio_rec RECORD; artist_name TEXT; engineer_name TEXT; ticket_id UUID;
BEGIN
  IF NEW.artist_confirmed = false AND NEW.engineer_completed_at IS NOT NULL THEN
    SELECT s.name, s.user_id INTO studio_rec FROM studios s WHERE s.id = NEW.studio_id LIMIT 1;
    SELECT display_name INTO artist_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
    SELECT display_name INTO engineer_name FROM profiles WHERE user_id = studio_rec.user_id LIMIT 1;
    NEW.session_status := 'disputed';
    NEW.payout_status := 'held';
    INSERT INTO support_tickets (user_id, subject, message, status)
    VALUES (NEW.user_id, '⚖️ Session Dispute — ' || COALESCE(studio_rec.name, 'Studio'),
      'Automatic dispute: ' || COALESCE(artist_name, 'Artist') || ' reported a no-show for booking #' || LEFT(NEW.id::text, 8)
      || ' at ' || COALESCE(studio_rec.name, 'a studio') || ', but engineer ' || COALESCE(engineer_name, 'the engineer')
      || ' marked the session as completed. Booking date: ' || NEW.booking_date::text
      || ' | Amount: $' || NEW.total_amount::text || ' | Session code: ' || COALESCE(NEW.session_code, 'N/A')
      || '. Please review and resolve.', 'open') RETURNING id INTO ticket_id;
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.user_id, 'booking', '⚖️ Session Disputed',
      'Your no-show report for ' || COALESCE(studio_rec.name, 'a studio') || ' is under review. A support ticket has been created.',
      ticket_id, 'ticket');
    IF studio_rec.user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      VALUES (studio_rec.user_id, 'booking', '⚖️ Session Disputed',
        COALESCE(artist_name, 'An artist') || ' disputed your completed session at ' || COALESCE(studio_rec.name, 'your studio') || '. Payment is held pending review.',
        ticket_id, 'ticket');
    END IF;
  END IF;
  IF NEW.artist_confirmed = true AND NEW.engineer_completed_at IS NOT NULL THEN
    NEW.session_status := 'completed';
    NEW.payout_status := 'released';
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
CREATE TRIGGER on_artist_session_response BEFORE UPDATE ON public.studio_bookings FOR EACH ROW
  WHEN (OLD.artist_confirmed IS DISTINCT FROM NEW.artist_confirmed) EXECUTE FUNCTION public.handle_session_dispute();

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL UNIQUE,
  booking_id UUID REFERENCES public.studio_bookings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_live_sessions_code ON public.live_sessions (session_code);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions (status);

CREATE TABLE IF NOT EXISTS public.live_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT NOT NULL DEFAULT 'artist',
  display_name TEXT,
  client_instance_id TEXT,
  is_live BOOLEAN NOT NULL DEFAULT false,
  mic_muted BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('engineer', 'artist'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_session_participants TO authenticated;
GRANT ALL ON public.live_session_participants TO service_role;
ALTER TABLE public.live_session_participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lsp_session ON public.live_session_participants (live_session_id);
CREATE INDEX IF NOT EXISTS idx_lsp_user ON public.live_session_participants (user_id);

CREATE POLICY "Authenticated can select live_sessions" ON public.live_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creator can insert live_sessions" ON public.live_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or participant can update live_sessions" ON public.live_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM public.live_session_participants p WHERE p.live_session_id = id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Participants can view session members" ON public.live_session_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_session_participants p2 WHERE p2.live_session_id = live_session_participants.live_session_id AND p2.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_participants.live_session_id AND ls.created_by = auth.uid()));
CREATE POLICY "Users can join sessions" ON public.live_session_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users update own presence" ON public.live_session_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_live_sessions_updated_at BEFORE UPDATE ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lsp_updated_at BEFORE UPDATE ON public.live_session_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;