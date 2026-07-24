-- Ensure applicants get notified when employers change application status.
-- Callable from the client (belt-and-suspenders) and from the trigger.

CREATE OR REPLACE FUNCTION public.notify_job_applicant(p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app record;
  job_title text;
  notify_pref text;
  status_label text;
  title_text text;
  body_text text;
  has_interview boolean;
  caller uuid := auth.uid();
BEGIN
  SELECT ja.*
  INTO app
  FROM public.job_applications ja
  WHERE ja.id = p_application_id
  LIMIT 1;

  IF app.id IS NULL THEN
    RETURN false;
  END IF;

  -- Applicant self-updates (e.g. withdraw) should not notify / must not error the update
  IF caller IS NOT NULL AND caller = app.applicant_id THEN
    RETURN false;
  END IF;

  -- Employer who owns the listing (or trigger/service with no jwt) may notify
  IF caller IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.job_listings jl
      WHERE jl.id = app.job_id
        AND jl.employer_id = caller
    ) THEN
      RAISE EXCEPTION 'not authorized to notify applicant';
    END IF;
  END IF;

  SELECT jp.notify_frequency INTO notify_pref
  FROM public.job_preferences jp
  WHERE jp.user_id = app.applicant_id
  LIMIT 1;

  IF notify_pref IS NOT NULL AND lower(notify_pref) = 'off' THEN
    RETURN false;
  END IF;

  SELECT jl.title INTO job_title
  FROM public.job_listings jl
  WHERE jl.id = app.job_id
  LIMIT 1;

  has_interview :=
    app.references_json IS NOT NULL
    AND jsonb_typeof(app.references_json) = 'object'
    AND (app.references_json ? 'yaj_interview')
    AND app.status = 'interview';

  IF has_interview THEN
    title_text := 'Interview invite';
    body_text := 'You have an interview invite for ' || COALESCE(job_title, 'a job') ||
      '. Open My Jobs → Interviews to accept and join.';
  ELSE
    status_label := CASE app.status
      WHEN 'applied' THEN 'Reviewing'
      WHEN 'reviewing' THEN 'Reviewing'
      WHEN 'interview' THEN 'Interview'
      WHEN 'offered' THEN 'Offered'
      WHEN 'hired' THEN 'Hired'
      WHEN 'rejected' THEN 'Rejected'
      WHEN 'withdrawn' THEN 'Withdrawn'
      ELSE initcap(replace(app.status, '_', ' '))
    END;
    title_text := 'Job application — ' || status_label;
    body_text := 'Your application for ' || COALESCE(job_title, 'a job') || ' is now: ' || status_label || '.';
  END IF;

  -- Avoid double-send when both trigger and client RPC fire
  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = app.applicant_id
      AND n.reference_id = app.job_id
      AND n.type IN ('job', 'job_application')
      AND n.title = title_text
      AND n.created_at > now() - interval '20 seconds'
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    app.applicant_id,
    'job',
    title_text,
    body_text,
    app.job_id,
    'job'
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_job_applicant(uuid) TO authenticated;

-- Trigger uses the same function after status / interview JSON changes
CREATE OR REPLACE FUNCTION public.notify_job_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_changed boolean;
  interview_updated boolean;
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

  PERFORM public.notify_job_applicant(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_application_status_change ON public.job_applications;
CREATE TRIGGER trg_notify_job_application_status_change
AFTER UPDATE OF status, references_json ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_job_application_status_change();

REVOKE EXECUTE ON FUNCTION public.notify_job_application_status_change() FROM PUBLIC, anon, authenticated;
