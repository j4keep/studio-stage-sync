-- 1) battles: public social content should be readable by anonymous visitors too
DROP POLICY IF EXISTS "Anyone can view battles" ON public.battles;
CREATE POLICY "Anyone can view battles" ON public.battles FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.battles TO anon;

-- 2) circle_members: block self-approval / role spoofing on insert
DROP POLICY IF EXISTS "Users request to join circles" ON public.circle_members;
CREATE POLICY "Users request to join circles" ON public.circle_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND (
    status = 'pending'
    OR (
      status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.circles c
        WHERE c.id = circle_id AND c.requires_approval = false
      )
    )
  )
);

-- 3) employer_profiles: full rows owner-only, public-safe fields via a view
DROP POLICY IF EXISTS "employer_profiles readable by authenticated" ON public.employer_profiles;

CREATE OR REPLACE VIEW public.employer_profiles_public AS
SELECT id, user_id, company_name, logo_url, description, website, verified, created_at
FROM public.employer_profiles;

GRANT SELECT ON public.employer_profiles_public TO anon, authenticated;

-- 4) job_applications: employers get masked access only (honours anonymous_mode)
DROP POLICY IF EXISTS "applications read by applicant or employer" ON public.job_applications;
CREATE POLICY "applications read own" ON public.job_applications
FOR SELECT TO authenticated USING (auth.uid() = applicant_id);

CREATE OR REPLACE FUNCTION public.yaj_mask_application(_row public.job_applications)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(_row.anonymous_mode, false) = false THEN to_jsonb(_row)
    ELSE to_jsonb(_row)
      || jsonb_build_object(
        'full_name', 'Anonymous applicant',
        'email', NULL,
        'phone', NULL,
        'address', NULL,
        'linkedin_url', NULL,
        'portfolio_url', NULL,
        'resume_url', NULL,
        'resume_snapshot', NULL,
        'references_json', NULL,
        'expected_salary', NULL,
        'target_pay_rate', NULL
      )
  END
$$;

CREATE OR REPLACE FUNCTION public.yaj_employer_applications(p_job_id uuid)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.job_listings jl WHERE jl.id = p_job_id AND jl.employer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not your job listing';
  END IF;
  RETURN QUERY
    SELECT public.yaj_mask_application(ja)
    FROM public.job_applications ja
    WHERE ja.job_id = p_job_id
    ORDER BY ja.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.yaj_employer_application_counts(p_job_ids uuid[])
RETURNS TABLE(job_id uuid, total integer, new_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ja.job_id,
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE ja.status IN ('applied','reviewing'))::int
  FROM public.job_applications ja
  JOIN public.job_listings jl ON jl.id = ja.job_id
  WHERE jl.employer_id = auth.uid()
    AND ja.job_id = ANY(p_job_ids)
  GROUP BY ja.job_id
$$;

CREATE OR REPLACE FUNCTION public.yaj_job_application_detail(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.job_applications;
  is_employer boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO r FROM public.job_applications WHERE id = p_id;
  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.job_listings jl WHERE jl.id = r.job_id AND jl.employer_id = auth.uid()
  ) INTO is_employer;
  IF r.applicant_id = auth.uid() THEN
    RETURN to_jsonb(r);
  ELSIF is_employer THEN
    RETURN public.yaj_mask_application(r);
  END IF;
  RAISE EXCEPTION 'Not allowed';
END;
$$;

REVOKE ALL ON FUNCTION public.yaj_employer_applications(uuid) FROM public;
REVOKE ALL ON FUNCTION public.yaj_employer_application_counts(uuid[]) FROM public;
REVOKE ALL ON FUNCTION public.yaj_job_application_detail(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.yaj_employer_applications(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.yaj_employer_application_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.yaj_job_application_detail(uuid) TO authenticated;

-- 5) resumes: owner only, plus the employer who received it via an application
DROP POLICY IF EXISTS "resumes public to authenticated if visible" ON public.resumes;
CREATE POLICY "resumes readable by employer of application" ON public.resumes
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.job_applications ja
    JOIN public.job_listings jl ON jl.id = ja.job_id
    WHERE ja.resume_id = resumes.id AND jl.employer_id = auth.uid()
  )
);