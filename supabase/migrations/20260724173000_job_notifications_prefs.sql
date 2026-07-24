-- Broader job application notifications (status + interview invite) with preference respect.
CREATE OR REPLACE FUNCTION public.notify_job_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_title text;
  status_label text;
  notify_pref text;
  status_changed boolean;
  interview_updated boolean;
  title_text text;
  body_text text;
BEGIN
  status_changed := OLD.status IS DISTINCT FROM NEW.status;
  interview_updated :=
    OLD.references_json IS DISTINCT FROM NEW.references_json
    AND NEW.references_json IS NOT NULL
    AND jsonb_typeof(NEW.references_json) = 'object'
    AND (NEW.references_json ? 'yaj_interview');

  IF NOT status_changed AND NOT interview_updated THEN
    RETURN NEW;
  END IF;

  -- Respect Job Preferences: notify_frequency = 'off' disables application update notifications
  SELECT jp.notify_frequency INTO notify_pref
  FROM public.job_preferences jp
  WHERE jp.user_id = NEW.applicant_id
  LIMIT 1;

  IF notify_pref = 'off' THEN
    RETURN NEW;
  END IF;

  SELECT jl.title INTO job_title
  FROM public.job_listings jl
  WHERE jl.id = NEW.job_id
  LIMIT 1;

  IF interview_updated AND (NEW.status = 'interview' OR status_changed) THEN
    title_text := 'Interview invite';
    body_text := 'You have an interview invite for ' || COALESCE(job_title, 'a job') ||
      '. Open My Jobs → Interviews to accept and join.';
  ELSE
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
    title_text := 'Job application — ' || status_label;
    body_text := 'Your application for ' || COALESCE(job_title, 'a job') || ' is now: ' || status_label || '.';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    NEW.applicant_id,
    'job',
    title_text,
    body_text,
    NEW.job_id,
    'job'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_application_status_change ON public.job_applications;
CREATE TRIGGER trg_notify_job_application_status_change
AFTER UPDATE OF status, references_json ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_job_application_status_change();

REVOKE EXECUTE ON FUNCTION public.notify_job_application_status_change() FROM PUBLIC, anon, authenticated;
