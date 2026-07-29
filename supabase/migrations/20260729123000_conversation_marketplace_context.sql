-- Persist chat context so Marketplace DMs open Marketplace profiles (not YAJ artist pages).
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS context text;

COMMENT ON COLUMN public.conversations.context IS
  'Optional origin: marketplace | local_help | null (general)';

CREATE INDEX IF NOT EXISTS conversations_context_idx
  ON public.conversations (context)
  WHERE context IS NOT NULL;
