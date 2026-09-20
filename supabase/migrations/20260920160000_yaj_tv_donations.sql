-- YAJ.TV creator support ("Donate" tab). Preview/ledger only — no real
-- payment processor wired in yet, mirrors the existing Circle donation
-- preview pattern. Scoped to uploaded/original content only; the Live TV
-- feature intentionally has no donation path.
CREATE TABLE IF NOT EXISTS public.tv_post_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tv_posts(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tv_post_donations TO authenticated;
GRANT ALL ON public.tv_post_donations TO service_role;
ALTER TABLE public.tv_post_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_post_donations sender/recipient read" ON public.tv_post_donations
  FOR SELECT TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "tv_post_donations self insert" ON public.tv_post_donations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id AND from_user_id <> to_user_id);
CREATE INDEX IF NOT EXISTS tv_post_donations_post_idx ON public.tv_post_donations (post_id);
CREATE INDEX IF NOT EXISTS tv_post_donations_to_user_idx ON public.tv_post_donations (to_user_id);
