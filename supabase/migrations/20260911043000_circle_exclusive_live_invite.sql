-- Exclusive area: ensure section access + Exclusive live audience/invite columns.
-- Idempotent — safe if 20260911040500 already applied.

ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS exclusive_access text NOT NULL DEFAULT 'paid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'circles_exclusive_access_check'
  ) THEN
    ALTER TABLE public.circles
      ADD CONSTRAINT circles_exclusive_access_check
      CHECK (exclusive_access IN ('members', 'paid'));
  END IF;
END $$;

ALTER TABLE public.circle_live_sessions
  ADD COLUMN IF NOT EXISTS is_exclusive boolean NOT NULL DEFAULT false;

ALTER TABLE public.circle_live_sessions
  ADD COLUMN IF NOT EXISTS exclusive_audience text NOT NULL DEFAULT 'all';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'circle_live_sessions_exclusive_audience_check'
  ) THEN
    ALTER TABLE public.circle_live_sessions
      ADD CONSTRAINT circle_live_sessions_exclusive_audience_check
      CHECK (exclusive_audience IN ('all', 'invite'));
  END IF;
END $$;

ALTER TABLE public.circle_live_sessions
  ADD COLUMN IF NOT EXISTS invite_token text;

CREATE INDEX IF NOT EXISTS circle_live_sessions_exclusive_idx
  ON public.circle_live_sessions (circle_id, is_exclusive)
  WHERE status = 'live';

CREATE INDEX IF NOT EXISTS circle_live_sessions_invite_token_idx
  ON public.circle_live_sessions (invite_token)
  WHERE invite_token IS NOT NULL AND status = 'live';

-- Refresh PostgREST schema cache so exclusive_access is visible immediately.
NOTIFY pgrst, 'reload schema';
