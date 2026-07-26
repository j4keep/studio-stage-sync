CREATE OR REPLACE FUNCTION public.notify_gig_lifecycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  helper_id uuid;
  poster_name text;
  helper_name text;
BEGIN
  helper_id := NEW.assigned_to;
  SELECT display_name INTO poster_name FROM profiles WHERE user_id = NEW.poster_id LIMIT 1;
  IF helper_id IS NOT NULL THEN
    SELECT display_name INTO helper_name FROM profiles WHERE user_id = helper_id LIMIT 1;
  END IF;

  IF helper_id IS NOT NULL AND OLD.assigned_to IS DISTINCT FROM helper_id THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (helper_id, 'gig', '✅ You were approved for a gig',
      COALESCE(poster_name, 'The host') || ' approved you for "' || NEW.title || '". Open the gig to message and start.',
      NEW.id, 'gig');
  END IF;

  IF NEW.poster_completed_at IS NOT NULL AND OLD.poster_completed_at IS NULL AND helper_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (helper_id, 'gig', '🏁 Host marked the gig complete',
      COALESCE(poster_name, 'The host') || ' completed "' || NEW.title || '". Press Complete on your side so you can both leave ratings.',
      NEW.id, 'gig');
  END IF;

  IF NEW.worker_completed_at IS NOT NULL AND OLD.worker_completed_at IS NULL THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.poster_id, 'gig', '🏁 Helper marked the gig complete',
      COALESCE(helper_name, 'Your helper') || ' completed "' || NEW.title || '". Press Complete on your side so you can both leave ratings.',
      NEW.id, 'gig');
  END IF;

  IF NEW.poster_completed_at IS NOT NULL AND NEW.worker_completed_at IS NOT NULL
     AND (OLD.poster_completed_at IS NULL OR OLD.worker_completed_at IS NULL)
     AND helper_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES
      (NEW.poster_id, 'gig', '⭐ Rate your helper', 'Both sides completed "' || NEW.title || '". Leave a rating and comment.', NEW.id, 'gig'),
      (helper_id, 'gig', '⭐ Rate the host', 'Both sides completed "' || NEW.title || '". Leave a rating and comment.', NEW.id, 'gig');
  END IF;

  RETURN NEW;
END; $function$;