-- New applications start in Reviewing (not Applied).
ALTER TABLE public.job_applications ALTER COLUMN status SET DEFAULT 'reviewing';
UPDATE public.job_applications SET status = 'reviewing' WHERE status = 'applied';

-- Notify applicants when an employer updates application status.
CREATE OR REPLACE FUNCTION public.notify_job_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_title text;
  status_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT jl.title INTO job_title
  FROM public.job_listings jl
  WHERE jl.id = NEW.job_id
  LIMIT 1;

  status_label := CASE NEW.status
    WHEN 'applied' THEN 'Reviewing'
    WHEN 'reviewing' THEN 'Reviewing'
    WHEN 'interview' THEN 'Interview'
    WHEN 'offered' THEN 'Offered'
    WHEN 'hired' THEN 'Hired'
    WHEN 'rejected' THEN 'Rejected'
    WHEN 'withdrawn' THEN 'Withdrawn'
    ELSE initcap(replace(NEW.status, '_', ' '))
  END;

  INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    NEW.applicant_id,
    'job_application',
    'Application update — ' || status_label,
    'Your application for ' || COALESCE(job_title, 'a job') || ' is now: ' || status_label || '.',
    NEW.job_id,
    'job_application'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_application_status_change ON public.job_applications;
CREATE TRIGGER trg_notify_job_application_status_change
AFTER UPDATE OF status ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_job_application_status_change();

REVOKE EXECUTE ON FUNCTION public.notify_job_application_status_change() FROM PUBLIC, anon, authenticated;
