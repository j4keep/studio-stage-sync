-- Live debate battles: scheduled start + saved replay after the call ends
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS replay_media_url text;

COMMENT ON COLUMN public.battles.scheduled_start_at IS 'When a live battle call begins (after both sides accept).';
COMMENT ON COLUMN public.battles.replay_media_url IS 'Recorded live-battle replay URL shown after the debate ends.';
