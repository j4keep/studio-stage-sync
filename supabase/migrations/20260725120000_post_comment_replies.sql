-- Threaded replies for feed post comments
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS post_comments_parent_id_idx
  ON public.post_comments (parent_id);

CREATE INDEX IF NOT EXISTS post_comments_post_id_created_at_idx
  ON public.post_comments (post_id, created_at);
