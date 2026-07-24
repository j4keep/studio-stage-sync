-- Applicants can always read jobs they applied to (even if closed), so compensation & details stay visible.
CREATE POLICY "job_listings applicants read applied"
  ON public.job_listings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.job_id = job_listings.id
        AND ja.applicant_id = auth.uid()
    )
  );

-- Allow employer job deletes to cascade-remove applications & saved rows under RLS.
CREATE POLICY "applications employer delete"
  ON public.job_applications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.job_listings jl
      WHERE jl.id = job_applications.job_id
        AND jl.employer_id = auth.uid()
    )
  );

CREATE POLICY "saved_jobs employer delete via listing"
  ON public.saved_jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.job_listings jl
      WHERE jl.id = saved_jobs.job_id
        AND jl.employer_id = auth.uid()
    )
  );

-- Notify applicants + people who saved the job before cascade delete removes their rows.
CREATE OR REPLACE FUNCTION public.notify_job_listing_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
BEGIN
  FOR recipient IN
    SELECT DISTINCT uid FROM (
      SELECT applicant_id AS uid FROM public.job_applications WHERE job_id = OLD.id
      UNION
      SELECT user_id AS uid FROM public.saved_jobs WHERE job_id = OLD.id
    ) people
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (
      recipient,
      'job_application',
      'Job removed',
      'The job "' || COALESCE(OLD.title, 'a role') || '" was removed by the employer. It will no longer appear in your applications or saved jobs.',
      OLD.id,
      'job'
    );
  END LOOP;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_listing_deleted ON public.job_listings;
CREATE TRIGGER trg_notify_job_listing_deleted
BEFORE DELETE ON public.job_listings
FOR EACH ROW
EXECUTE FUNCTION public.notify_job_listing_deleted();

REVOKE EXECUTE ON FUNCTION public.notify_job_listing_deleted() FROM PUBLIC, anon, authenticated;

-- So DELETE realtime events include filterable columns for employee devices
ALTER TABLE public.job_applications REPLICA IDENTITY FULL;
ALTER TABLE public.saved_jobs REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
