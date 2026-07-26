ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gig_experience_bio text;

CREATE TABLE IF NOT EXISTS public.gig_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gig_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  experience_bio text,
  status text NOT NULL DEFAULT 'interested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, user_id)
);

CREATE INDEX IF NOT EXISTS gig_interests_gig_id_idx ON public.gig_interests (gig_id);
CREATE INDEX IF NOT EXISTS gig_interests_user_id_idx ON public.gig_interests (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_interests TO authenticated;
GRANT ALL ON public.gig_interests TO service_role;
ALTER TABLE public.gig_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gig_interests read parties" ON public.gig_interests;
CREATE POLICY "gig_interests read parties"
  ON public.gig_interests FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.gig_listings g
      WHERE g.id = gig_id AND g.poster_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "gig_interests insert self" ON public.gig_interests;
CREATE POLICY "gig_interests insert self"
  ON public.gig_interests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gig_interests update self or poster" ON public.gig_interests;
CREATE POLICY "gig_interests update self or poster"
  ON public.gig_interests FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.gig_listings g
      WHERE g.id = gig_id AND g.poster_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.gig_listings g
      WHERE g.id = gig_id AND g.poster_id = auth.uid()
    )
  );

CREATE TRIGGER update_gig_interests_updated_at
  BEFORE UPDATE ON public.gig_interests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "gig_listings claim worker" ON public.gig_listings;

DROP POLICY IF EXISTS "gig_listings public read open" ON public.gig_listings;
CREATE POLICY "gig_listings public read open"
  ON public.gig_listings FOR SELECT
  USING (
    status = 'open'
    OR auth.uid() = poster_id
    OR auth.uid() = assigned_to
  );