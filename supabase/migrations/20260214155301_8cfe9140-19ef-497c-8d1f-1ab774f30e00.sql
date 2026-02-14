
-- Fix songs SELECT policy to be public
DROP POLICY IF EXISTS "Users can view their own songs" ON public.songs;
DROP POLICY IF EXISTS "Anyone can view songs" ON public.songs;
CREATE POLICY "Anyone can view songs" ON public.songs FOR SELECT USING (true);

-- Fix videos SELECT policy to be public
DROP POLICY IF EXISTS "Users can view their own videos" ON public.videos;
DROP POLICY IF EXISTS "Anyone can view videos" ON public.videos;
CREATE POLICY "Anyone can view videos" ON public.videos FOR SELECT USING (true);

-- Fix podcasts SELECT policy to be public
DROP POLICY IF EXISTS "Users can view their own podcasts" ON public.podcasts;
DROP POLICY IF EXISTS "Anyone can view podcasts" ON public.podcasts;
CREATE POLICY "Anyone can view podcasts" ON public.podcasts FOR SELECT USING (true);
