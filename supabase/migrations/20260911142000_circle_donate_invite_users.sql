-- Allowlisted Exclusive invite guests (circle members checked by the host).
ALTER TABLE public.circle_live_sessions
  ADD COLUMN IF NOT EXISTS invited_user_ids text[] NOT NULL DEFAULT '{}';

-- Circle-level donations (Donation tab tips to the Circle owner).
CREATE TABLE IF NOT EXISTS public.circle_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_donations_circle_idx
  ON public.circle_donations (circle_id, created_at DESC);

ALTER TABLE public.circle_donations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'circle_donations' AND policyname = 'circle_donations_insert_own'
  ) THEN
    CREATE POLICY circle_donations_insert_own ON public.circle_donations
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = from_user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'circle_donations' AND policyname = 'circle_donations_select_participants'
  ) THEN
    CREATE POLICY circle_donations_select_participants ON public.circle_donations
      FOR SELECT TO authenticated
      USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
