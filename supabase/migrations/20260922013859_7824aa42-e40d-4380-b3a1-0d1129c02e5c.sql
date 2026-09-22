DROP VIEW IF EXISTS public.employer_profiles_public;

CREATE OR REPLACE FUNCTION public.yaj_employer_public_profiles(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, company_name text, logo_url text, description text, website text, verified boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ep.user_id, ep.company_name, ep.logo_url, ep.description, ep.website, ep.verified
  FROM public.employer_profiles ep
  WHERE ep.user_id = ANY(p_user_ids)
$$;

REVOKE ALL ON FUNCTION public.yaj_employer_public_profiles(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.yaj_employer_public_profiles(uuid[]) TO anon, authenticated;