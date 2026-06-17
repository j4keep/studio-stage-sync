-- Drop dependent triggers/functions first
DROP FUNCTION IF EXISTS public.notify_new_booking() CASCADE;
DROP FUNCTION IF EXISTS public.notify_booking_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.expire_pending_bookings() CASCADE;
DROP FUNCTION IF EXISTS public.handle_session_dispute() CASCADE;
DROP FUNCTION IF EXISTS public.update_studio_rating() CASCADE;
DROP FUNCTION IF EXISTS public.increment_no_show_count() CASCADE;
DROP FUNCTION IF EXISTS public.generate_session_code() CASCADE;

-- Drop studio/session/recording tables (WHEUAT pivot away from DAW/engineer bookings)
DROP TABLE IF EXISTS public.studio_reviews CASCADE;
DROP TABLE IF EXISTS public.studio_photos CASCADE;
DROP TABLE IF EXISTS public.studio_availability CASCADE;
DROP TABLE IF EXISTS public.studio_bookings CASCADE;
DROP TABLE IF EXISTS public.studios CASCADE;
DROP TABLE IF EXISTS public.no_show_strikes CASCADE;
DROP TABLE IF EXISTS public.live_session_participants CASCADE;
DROP TABLE IF EXISTS public.live_sessions CASCADE;
DROP TABLE IF EXISTS public.recording_exports CASCADE;
DROP TABLE IF EXISTS public.recording_takes CASCADE;
DROP TABLE IF EXISTS public.recording_sessions CASCADE;