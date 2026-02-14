
-- Create likes table for songs, videos, podcasts
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('song', 'video', 'podcast')),
  content_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_type, content_id)
);

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Everyone can read like counts
CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);

-- Authenticated users can like
CREATE POLICY "Authenticated users can like" ON public.likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can remove their own likes
CREATE POLICY "Users can unlike" ON public.likes FOR DELETE 
USING (auth.uid() = user_id);

-- Add likes_count columns to songs, videos, podcasts
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.podcasts ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

-- Function to increment plays for a song
CREATE OR REPLACE FUNCTION public.increment_song_plays(song_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE songs SET plays = (COALESCE(plays::integer, 0) + 1)::text WHERE id = song_id;
END;
$$;

-- Function to increment views for videos
CREATE OR REPLACE FUNCTION public.increment_video_views(video_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE videos SET views = (COALESCE(views::integer, 0) + 1)::text WHERE id = video_id;
END;
$$;

-- Function to increment views for podcasts  
CREATE OR REPLACE FUNCTION public.increment_podcast_plays(podcast_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE podcasts SET plays = (COALESCE(plays::integer, 0) + 1)::text WHERE id = podcast_id;
END;
$$;

-- Function to update likes_count on like/unlike (trigger)
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.content_type = 'song' THEN
      UPDATE songs SET likes_count = likes_count + 1 WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'video' THEN
      UPDATE videos SET likes_count = likes_count + 1 WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'podcast' THEN
      UPDATE podcasts SET likes_count = likes_count + 1 WHERE id = NEW.content_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.content_type = 'song' THEN
      UPDATE songs SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.content_id;
    ELSIF OLD.content_type = 'video' THEN
      UPDATE videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.content_id;
    ELSIF OLD.content_type = 'podcast' THEN
      UPDATE podcasts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.content_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_like_change
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- Index for fast lookups
CREATE INDEX idx_likes_content ON public.likes(content_type, content_id);
CREATE INDEX idx_likes_user ON public.likes(user_id, content_type);
