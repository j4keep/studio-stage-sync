
CREATE OR REPLACE FUNCTION public.increment_boost_impressions(boost_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.boosts SET impressions = impressions + 1 WHERE id = boost_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_boost_clicks(boost_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.boosts SET clicks = clicks + 1 WHERE id = boost_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
