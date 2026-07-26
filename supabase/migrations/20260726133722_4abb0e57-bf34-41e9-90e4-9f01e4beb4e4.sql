ALTER TABLE public.gig_listings
  ADD COLUMN IF NOT EXISTS poster_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_completed_at timestamptz;

DROP POLICY IF EXISTS "gig_listings public read open" ON public.gig_listings;
CREATE POLICY "gig_listings read open or party" ON public.gig_listings
FOR SELECT USING (
  status = 'open' OR auth.uid() = poster_id OR auth.uid() = assigned_to
);

DROP POLICY IF EXISTS "gig_listings assigned update" ON public.gig_listings;
CREATE POLICY "gig_listings assigned update" ON public.gig_listings
FOR UPDATE TO authenticated
USING (auth.uid() = assigned_to)
WITH CHECK (auth.uid() = assigned_to);

DROP POLICY IF EXISTS "gig_listings claim open" ON public.gig_listings;
CREATE POLICY "gig_listings claim open" ON public.gig_listings
FOR UPDATE TO authenticated
USING (assigned_to IS NULL AND status = 'open' AND auth.uid() <> poster_id)
WITH CHECK (auth.uid() = assigned_to);

CREATE OR REPLACE FUNCTION public.gig_mutual_complete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.poster_completed_at IS NOT NULL AND NEW.worker_completed_at IS NOT NULL
     AND NEW.status <> 'completed' THEN
    NEW.status := 'completed';
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gig_mutual_complete ON public.gig_listings;
CREATE TRIGGER trg_gig_mutual_complete
BEFORE UPDATE ON public.gig_listings
FOR EACH ROW EXECUTE FUNCTION public.gig_mutual_complete();

DROP POLICY IF EXISTS ur_update_own ON public.user_ratings;
CREATE POLICY ur_update_own ON public.user_ratings
FOR UPDATE TO authenticated
USING (auth.uid() = rater_id) WITH CHECK (auth.uid() = rater_id);

DROP POLICY IF EXISTS ur_delete_own ON public.user_ratings;
CREATE POLICY ur_delete_own ON public.user_ratings
FOR DELETE TO authenticated
USING (auth.uid() = rater_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_listings TO authenticated;
GRANT SELECT ON public.gig_listings TO anon;
GRANT ALL ON public.gig_listings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ratings TO authenticated;
GRANT ALL ON public.user_ratings TO service_role;