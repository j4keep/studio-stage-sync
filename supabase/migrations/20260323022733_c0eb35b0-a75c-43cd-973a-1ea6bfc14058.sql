
-- Add views columns to posts and battles
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;

-- Increment post views RPC
CREATE OR REPLACE FUNCTION public.increment_post_views(post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts SET views = views + 1 WHERE id = post_id;
END;
$$;

-- Increment battle views RPC
CREATE OR REPLACE FUNCTION public.increment_battle_views(battle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE battles SET views = views + 1 WHERE id = battle_id;
END;
$$;
