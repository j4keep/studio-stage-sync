
-- Add likes_count to battles
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- Update the likes count trigger to handle battles
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.content_type = 'song' THEN
      UPDATE songs SET likes_count = likes_count + 1 WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'video' THEN
      UPDATE videos SET likes_count = likes_count + 1 WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'podcast' THEN
      UPDATE podcasts SET likes_count = likes_count + 1 WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'post' THEN
      UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'battle' THEN
      UPDATE battles SET likes_count = likes_count + 1 WHERE id = NEW.content_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.content_type = 'song' THEN
      UPDATE songs SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.content_id;
    ELSIF OLD.content_type = 'video' THEN
      UPDATE videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.content_id;
    ELSIF OLD.content_type = 'podcast' THEN
      UPDATE podcasts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.content_id;
    ELSIF OLD.content_type = 'post' THEN
      UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.content_id;
    ELSIF OLD.content_type = 'battle' THEN
      UPDATE battles SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.content_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
