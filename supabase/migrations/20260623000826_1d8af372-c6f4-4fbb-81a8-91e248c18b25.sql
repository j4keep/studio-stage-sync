GRANT SELECT ON public.songs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;

GRANT SELECT ON public.podcasts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.podcasts TO authenticated;
GRANT ALL ON public.podcasts TO service_role;

DROP POLICY IF EXISTS "Anyone can view songs" ON public.songs;
CREATE POLICY "Anyone can view songs" ON public.songs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view podcasts" ON public.podcasts;
CREATE POLICY "Anyone can view podcasts" ON public.podcasts FOR SELECT TO anon, authenticated USING (true);