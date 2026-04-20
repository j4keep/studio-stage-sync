-- Partial unique index for idempotent upsert: one participant row per user per session
CREATE UNIQUE INDEX idx_lsp_unique_user_session
  ON public.live_session_participants (live_session_id, user_id)
  WHERE user_id IS NOT NULL;