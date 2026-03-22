
-- Posts table for social feed
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  caption text,
  media_url text,
  media_type text NOT NULL DEFAULT 'image',
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT TO public USING (true);
CREATE POLICY "Users can create own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Post comments table
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view post comments" ON public.post_comments FOR SELECT TO public USING (true);
CREATE POLICY "Users can comment" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update likes trigger to handle posts
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
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to update comments count
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_post_comment_change
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();
