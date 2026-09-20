-- YAJ.TV streaming redesign: richer catalog metadata + per-user watchlist.
-- Everything here is additive/backward-compatible; existing tv_posts rows
-- keep working with their current columns untouched.

-- CATALOG METADATA
ALTER TABLE public.tv_posts
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS genre text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_original boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_media boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS release_date date,
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating numeric(3,1),
  ADD COLUMN IF NOT EXISTS maturity_rating text,
  ADD COLUMN IF NOT EXISTS poster_url text,
  ADD COLUMN IF NOT EXISTS backdrop_url text;

CREATE INDEX IF NOT EXISTS tv_posts_category_idx ON public.tv_posts (category);
CREATE INDEX IF NOT EXISTS tv_posts_featured_idx ON public.tv_posts (is_featured) WHERE is_featured;
CREATE INDEX IF NOT EXISTS tv_posts_trending_idx ON public.tv_posts (is_trending) WHERE is_trending;
CREATE INDEX IF NOT EXISTS tv_posts_original_idx ON public.tv_posts (is_original) WHERE is_original;
CREATE INDEX IF NOT EXISTS tv_posts_views_idx ON public.tv_posts (views DESC);
CREATE INDEX IF NOT EXISTS tv_posts_rating_idx ON public.tv_posts (rating DESC);

-- View counter, callable by anyone (anon or signed-in) without granting
-- direct UPDATE access to the whole row.
CREATE OR REPLACE FUNCTION public.increment_tv_post_views(p_post_id uuid)
RETURNS void AS $$
  UPDATE public.tv_posts SET views = views + 1 WHERE id = p_post_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_tv_post_views(uuid) TO anon, authenticated;

-- WATCHLIST ("My List")
CREATE TABLE IF NOT EXISTS public.tv_watchlist (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.tv_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.tv_watchlist TO authenticated;
GRANT ALL ON public.tv_watchlist TO service_role;
ALTER TABLE public.tv_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_watchlist self read" ON public.tv_watchlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tv_watchlist self insert" ON public.tv_watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tv_watchlist self delete" ON public.tv_watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS tv_watchlist_post_idx ON public.tv_watchlist (post_id);

-- YAJ ORIGINALS: a fixed system creator profile + a small demo catalog so
-- the new streaming home doesn't launch empty. These are seeded/demo
-- entries only (has_media = false): no real video files exist yet, so the
-- player shows a "Coming soon" state instead of a broken stream. Poster
-- art is intentionally left null — the client renders an original YAJ
-- gradient placeholder for any card with no poster/thumbnail, never a
-- copyrighted or stock image.
INSERT INTO public.profiles (id, user_id, display_name, avatar_url, bio)
VALUES (
  '00000000-0000-4000-8000-0000000000f1',
  '00000000-0000-4000-8000-0000000000f1',
  'YAJ Originals',
  NULL,
  'The official YAJ.TV Originals catalog — short films, documentaries, interviews and music content produced by the YAJ network.'
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.tv_posts (
  user_id, kind, title, description, video_url, video_key, thumb_url,
  category, genre, is_featured, is_trending, is_original, has_media,
  release_date, views, rating, maturity_rating
)
SELECT * FROM (VALUES
  (
    '00000000-0000-4000-8000-0000000000f1'::uuid, 'short-film', 'After Midnight',
    'A short drama about the hours between last call and sunrise, and the strangers who share them.',
    '', NULL, NULL,
    'drama', 'Drama', true, true, true, false,
    (CURRENT_DATE - INTERVAL '5 days')::date, 4820, 4.4, '13+'
  ),
  (
    '00000000-0000-4000-8000-0000000000f1'::uuid, 'short-film', 'Corner Store Stories',
    'A mini-documentary following the owners keeping neighborhood corner stores alive.',
    '', NULL, NULL,
    'documentaries', 'Documentary', false, true, true, false,
    (CURRENT_DATE - INTERVAL '12 days')::date, 3110, 4.6, 'All'
  ),
  (
    '00000000-0000-4000-8000-0000000000f1'::uuid, 'podcast', 'Next Up',
    'A creator interview series spotlighting rising talent across the YAJ network.',
    '', NULL, NULL,
    'interviews', 'Interview', false, false, true, false,
    (CURRENT_DATE - INTERVAL '2 days')::date, 2260, 4.1, 'All'
  ),
  (
    '00000000-0000-4000-8000-0000000000f1'::uuid, 'short-film', 'The Session',
    'A music/recording short film capturing one song, start to finish, in a single take.',
    '', NULL, NULL,
    'music-videos', 'Music', false, false, true, false,
    (CURRENT_DATE - INTERVAL '20 days')::date, 5390, 4.7, 'All'
  ),
  (
    '00000000-0000-4000-8000-0000000000f1'::uuid, 'short-film', 'Behind the Beat',
    'A music documentary going behind the scenes of the producers shaping the YAJ sound.',
    '', NULL, NULL,
    'documentaries', 'Music Documentary', false, false, true, false,
    (CURRENT_DATE - INTERVAL '30 days')::date, 1870, 4.2, '13+'
  ),
  (
    '00000000-0000-4000-8000-0000000000f1'::uuid, 'short-film', 'YAJ Spotlight',
    'An artist showcase series highlighting standout work from the YAJ creator community.',
    '', NULL, NULL,
    'creator-originals', 'Showcase', true, false, true, false,
    (CURRENT_DATE - INTERVAL '1 days')::date, 980, 4.0, 'All'
  )
) AS seed(user_id, kind, title, description, video_url, video_key, thumb_url,
          category, genre, is_featured, is_trending, is_original, has_media,
          release_date, views, rating, maturity_rating)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tv_posts WHERE title = seed.title AND is_original = true
);
