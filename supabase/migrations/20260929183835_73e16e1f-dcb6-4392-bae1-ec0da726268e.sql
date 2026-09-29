GRANT SELECT ON public.radio_station_audio TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radio_station_audio TO authenticated;
GRANT ALL ON public.radio_station_audio TO service_role;
notify pgrst, 'reload schema';