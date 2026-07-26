ALTER TABLE public.gig_listings
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS gig_listings_assigned_to_idx ON public.gig_listings(assigned_to);
CREATE INDEX IF NOT EXISTS gig_listings_status_idx ON public.gig_listings(status);

CREATE OR REPLACE FUNCTION public.gig_lifecycle_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'assigned' AND NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    ELSIF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    ELSIF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN
      NEW.cancelled_at := now();
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gig_lifecycle_stamp_trg ON public.gig_listings;
CREATE TRIGGER gig_lifecycle_stamp_trg
BEFORE UPDATE ON public.gig_listings
FOR EACH ROW EXECUTE FUNCTION public.gig_lifecycle_stamp();

-- Blocking: real implementation
CREATE OR REPLACE FUNCTION public.is_blocked(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;

GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own blocks" ON public.blocks;
CREATE POLICY "Users manage their own blocks"
ON public.blocks FOR ALL TO authenticated
USING (auth.uid() = blocker_id)
WITH CHECK (auth.uid() = blocker_id);

CREATE UNIQUE INDEX IF NOT EXISTS blocks_unique_pair_idx ON public.blocks(blocker_id, blocked_id);

-- Hide gigs from users you've blocked or who blocked you
DROP POLICY IF EXISTS "Gigs hidden between blocked users" ON public.gig_listings;
CREATE POLICY "Gigs hidden between blocked users"
ON public.gig_listings FOR SELECT TO authenticated
USING (NOT public.is_blocked(auth.uid(), poster_id));