-- Gig lifecycle: worker assignment + mutual completion
ALTER TABLE public.gig_listings
  ADD COLUMN IF NOT EXISTS worker_id uuid,
  ADD COLUMN IF NOT EXISTS poster_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS gig_listings_worker_id_idx ON public.gig_listings (worker_id);
CREATE INDEX IF NOT EXISTS gig_listings_poster_id_idx ON public.gig_listings (poster_id);

-- Claim an open gig as helper (first interested user)
DROP POLICY IF EXISTS "gig_listings claim worker" ON public.gig_listings;
CREATE POLICY "gig_listings claim worker"
  ON public.gig_listings FOR UPDATE TO authenticated
  USING (worker_id IS NULL AND status IN ('open', 'in_progress') AND auth.uid() IS NOT NULL AND auth.uid() <> poster_id)
  WITH CHECK (worker_id = auth.uid());

-- Workers can update their own completion / status fields on assigned gigs
DROP POLICY IF EXISTS "gig_listings worker update" ON public.gig_listings;
CREATE POLICY "gig_listings worker update"
  ON public.gig_listings FOR UPDATE TO authenticated
  USING (auth.uid() = worker_id)
  WITH CHECK (auth.uid() = worker_id);

-- Raters can update their own ratings (upsert)
DROP POLICY IF EXISTS "ur_update_self" ON public.user_ratings;
CREATE POLICY "ur_update_self"
  ON public.user_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

-- Participants can always read their gigs (even if not open)
DROP POLICY IF EXISTS "gig_listings public read open" ON public.gig_listings;
CREATE POLICY "gig_listings public read open"
  ON public.gig_listings FOR SELECT
  USING (
    status IN ('open', 'in_progress')
    OR auth.uid() = poster_id
    OR auth.uid() = worker_id
  );

-- Fix is_blocked stub so blocks actually work app-wide
CREATE OR REPLACE FUNCTION public.is_blocked(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated, anon;

-- Allow reading blocks where you are either side (needed for unblock lists / checks)
DROP POLICY IF EXISTS "Users manage their own blocks" ON public.blocks;
CREATE POLICY "Users manage their own blocks"
  ON public.blocks FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can see blocks involving them" ON public.blocks;
CREATE POLICY "Users can see blocks involving them"
  ON public.blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

-- Complaints / reports on gigs to YAJ
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

-- Notify the other party when one side marks complete
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
BEGIN
  IF NEW.poster_completed_at IS NOT DISTINCT FROM OLD.poster_completed_at
     AND NEW.worker_completed_at IS NOT DISTINCT FROM OLD.worker_completed_at THEN
    RETURN NEW;
  END IF;

  IF NEW.poster_completed_at IS NOT NULL AND OLD.poster_completed_at IS NULL THEN
    actor := NEW.poster_id;
    recipient := NEW.worker_id;
    title := 'Please complete this gig';
    body := 'The customer marked "' || NEW.title || '" complete. Tap Complete so you can rate each other.';
  ELSIF NEW.worker_completed_at IS NOT NULL AND OLD.worker_completed_at IS NULL THEN
    actor := NEW.worker_id;
    recipient := NEW.poster_id;
    title := 'Please complete this gig';
    body := 'The helper marked "' || NEW.title || '" complete. Tap Complete so you can rate each other.';
  ELSE
    RETURN NEW;
  END IF;

  IF recipient IS NULL OR actor IS NULL THEN
    RETURN NEW;
  END IF;

  -- Both sides done → mark completed
  IF NEW.poster_completed_at IS NOT NULL AND NEW.worker_completed_at IS NOT NULL THEN
    NEW.status := 'completed';
    title := 'Gig completed — rate each other';
    body := '"' || NEW.title || '" is complete. Leave a rating for the other person.';
    -- notify both
    INSERT INTO public.notifications (user_id, title, message, body, reference_type, reference_id, type)
    VALUES
      (NEW.poster_id, title, body, body, 'gig', NEW.id, 'gig'),
      (NEW.worker_id, title, body, body, 'gig', NEW.id, 'gig');
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, body, reference_type, reference_id, type)
  VALUES (recipient, title, body, body, 'gig', NEW.id, 'gig');

  IF NEW.status = 'open' AND NEW.worker_id IS NOT NULL THEN
    NEW.status := 'in_progress';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gig_listings_complete_notify ON public.gig_listings;
CREATE TRIGGER gig_listings_complete_notify
  BEFORE UPDATE ON public.gig_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_gig_party_complete();
