
-- TV POSTS
CREATE TABLE public.tv_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('podcast','short-film','music-video')),
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  video_key text,
  thumb_url text,
  mime text,
  ext text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tv_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_posts TO authenticated;
GRANT ALL ON public.tv_posts TO service_role;
ALTER TABLE public.tv_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_posts public read" ON public.tv_posts FOR SELECT USING (true);
CREATE POLICY "tv_posts owner insert" ON public.tv_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tv_posts owner update" ON public.tv_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tv_posts owner delete" ON public.tv_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER tv_posts_set_updated_at BEFORE UPDATE ON public.tv_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX tv_posts_created_at_idx ON public.tv_posts (created_at DESC);
CREATE INDEX tv_posts_user_id_idx ON public.tv_posts (user_id);

-- LIKES
CREATE TABLE public.tv_post_likes (
  post_id uuid NOT NULL REFERENCES public.tv_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.tv_post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.tv_post_likes TO authenticated;
GRANT ALL ON public.tv_post_likes TO service_role;
ALTER TABLE public.tv_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_post_likes public read" ON public.tv_post_likes FOR SELECT USING (true);
CREATE POLICY "tv_post_likes self insert" ON public.tv_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tv_post_likes self delete" ON public.tv_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- COMMENTS
CREATE TABLE public.tv_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.tv_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tv_post_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.tv_post_comments TO authenticated;
GRANT ALL ON public.tv_post_comments TO service_role;
ALTER TABLE public.tv_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_post_comments public read" ON public.tv_post_comments FOR SELECT USING (true);
CREATE POLICY "tv_post_comments self insert" ON public.tv_post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tv_post_comments self delete" ON public.tv_post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX tv_post_comments_post_idx ON public.tv_post_comments (post_id, created_at DESC);
