
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own blocks"
  ON public.blocks FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);
