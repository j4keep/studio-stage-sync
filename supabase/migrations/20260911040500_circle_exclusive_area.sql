-- Exclusive area settings on Circles (section-level, not per-post).
-- exclusive_access: 'members' = free approved members; 'paid' = paid subscribers only.

ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS exclusive_access text NOT NULL DEFAULT 'paid'
    CHECK (exclusive_access IN ('members', 'paid'));

ALTER TABLE public.circle_live_sessions
  ADD COLUMN IF NOT EXISTS is_exclusive boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS circle_live_sessions_exclusive_idx
  ON public.circle_live_sessions (circle_id, is_exclusive)
  WHERE status = 'live';
