-- Align mutual complete / reports with live Lovable columns (assigned_to + status stamps).
-- Live already has: assigned_to, assigned_at, completed_at, cancelled_at, is_blocked().

ALTER TABLE public.gig_listings
  ADD COLUMN IF NOT EXISTS poster_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS gig_listings_poster_id_idx ON public.gig_listings (poster_id);

-- If older worker_id rows exist, copy into assigned_to
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gig_listings' AND column_name = 'worker_id'
  ) THEN
    UPDATE public.gig_listings
    SET assigned_to = worker_id
    WHERE assigned_to IS NULL AND worker_id IS NOT NULL;
  END IF;
END $$;

-- Claim open gig as helper via assigned_to
DROP POLICY IF EXISTS "gig_listings claim worker" ON public.gig_listings;
CREATE POLICY "gig_listings claim worker"
  ON public.gig_listings FOR UPDATE TO authenticated
  USING (
    assigned_to IS NULL
    AND status IN ('open', 'in_progress')
    AND auth.uid() IS NOT NULL
    AND auth.uid() <> poster_id
  )
  WITH CHECK (assigned_to = auth.uid());

DROP POLICY IF EXISTS "gig_listings helper update" ON public.gig_listings;
DROP POLICY IF EXISTS "gig_listings worker update" ON public.gig_listings;
CREATE POLICY "gig_listings helper update"
  ON public.gig_listings FOR UPDATE TO authenticated
  USING (auth.uid() = assigned_to)
  WITH CHECK (auth.uid() = assigned_to);

DROP POLICY IF EXISTS "ur_update_self" ON public.user_ratings;
CREATE POLICY "ur_update_self"
  ON public.user_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

-- Parties can read their gigs; open/assigned stay publicly readable (block policy still applies)
DROP POLICY IF EXISTS "gig_listings public read open" ON public.gig_listings;
CREATE POLICY "gig_listings public read open"
  ON public.gig_listings FOR SELECT
  USING (
    status IN ('open', 'assigned', 'in_progress')
    OR auth.uid() = poster_id
    OR auth.uid() = assigned_to
  );

DROP POLICY IF EXISTS "Users can see blocks involving them" ON public.blocks;
CREATE POLICY "Users can see blocks involving them"
  ON public.blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE TABLE IF NOT EXISTS public.gig_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gig_listings(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reported_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.gig_reports TO authenticated;
GRANT ALL ON public.gig_reports TO service_role;
ALTER TABLE public.gig_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gig_reports insert self" ON public.gig_reports;
CREATE POLICY "gig_reports insert self"
  ON public.gig_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "gig_reports read self" ON public.gig_reports;
CREATE POLICY "gig_reports read self"
  ON public.gig_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- Mutual complete notifications (uses assigned_to as helper)
CREATE OR REPLACE FUNCTION public.notify_gig_party_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
  actor uuid;
  title text;
  body text;
  helper uuid;
BEGIN
  helper := COALESCE(NEW.assigned_to, NEW.worker_id);

  IF NEW.poster_completed_at IS NOT DISTINCT FROM OLD.poster_completed_at
     AND NEW.worker_completed_at IS NOT DISTINCT FROM OLD.worker_completed_at THEN
    RETURN NEW;
  END IF;

  IF NEW.poster_completed_at IS NOT NULL AND OLD.poster_completed_at IS NULL THEN
    actor := NEW.poster_id;
    recipient := helper;
    title := 'Please complete this gig';
    body := 'The customer marked "' || NEW.title || '" complete. Tap Complete so you can rate each other.';
  ELSIF NEW.worker_completed_at IS NOT NULL AND OLD.worker_completed_at IS NULL THEN
    actor := helper;
    recipient := NEW.poster_id;
    title := 'Please complete this gig';
    body := 'The helper marked "' || NEW.title || '" complete. Tap Complete so you can rate each other.';
  ELSE
    RETURN NEW;
  END IF;

  IF recipient IS NULL OR actor IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.poster_completed_at IS NOT NULL AND NEW.worker_completed_at IS NOT NULL THEN
    NEW.status := 'completed';
    title := 'Gig completed — rate each other';
    body := '"' || NEW.title || '" is complete. Leave a rating for the other person.';
    INSERT INTO public.notifications (user_id, title, message, body, reference_type, reference_id, type)
    VALUES
      (NEW.poster_id, title, body, body, 'gig', NEW.id, 'gig'),
      (helper, title, body, body, 'gig', NEW.id, 'gig');
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, body, reference_type, reference_id, type)
  VALUES (recipient, title, body, body, 'gig', NEW.id, 'gig');

  IF NEW.status = 'open' AND helper IS NOT NULL THEN
    NEW.status := 'assigned';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gig_listings_complete_notify ON public.gig_listings;
CREATE TRIGGER gig_listings_complete_notify
  BEFORE UPDATE ON public.gig_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_gig_party_complete();
