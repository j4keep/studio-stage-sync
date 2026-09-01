-- Multi / motor live layout mode for circle + public lives.
-- 'live' = classic single-host; 'multi' = Bigo-style dynamic guest grid;
-- 'virtual' reserved (treated like live until virtual stage ships).

ALTER TABLE public.circle_live_sessions
  ADD COLUMN IF NOT EXISTS layout_mode text NOT NULL DEFAULT 'live'
  CHECK (layout_mode IN ('live', 'multi', 'virtual'));
