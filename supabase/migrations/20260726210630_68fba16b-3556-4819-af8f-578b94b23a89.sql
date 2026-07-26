CREATE OR REPLACE FUNCTION public.notify_gig_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  helper_id uuid;
  poster_name text;
  helper_name text;
BEGIN
  helper_id := COALESCE(NEW.assigned_to, NEW.worker_id);
  SELECT display_name INTO poster_name FROM profiles WHERE user_id = NEW.poster_id LIMIT 1;
  IF helper_id IS NOT NULL THEN
    SELECT display_name INTO helper_name FROM profiles WHERE user_id = helper_id LIMIT 1;
  END IF;

  -- Helper approved by host
  IF helper_id IS NOT NULL
     AND COALESCE(OLD.assigned_to, OLD.worker_id) IS DISTINCT FROM helper_id THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (helper_id, 'gig', '✅ You were approved for a gig',
      COALESCE(poster_name, 'The host') || ' approved you for "' || NEW.title || '". Open the gig to message and start.',
      NEW.id, 'gig');
  END IF;

  -- One side pressed Complete
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

  -- Both done → rating unlocked
  IF NEW.poster_completed_at IS NOT NULL AND NEW.worker_completed_at IS NOT NULL
     AND (OLD.poster_completed_at IS NULL OR OLD.worker_completed_at IS NULL)
     AND helper_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES
      (NEW.poster_id, 'gig', '⭐ Rate your helper', 'Both sides completed "' || NEW.title || '". Leave a rating and comment.', NEW.id, 'gig'),
      (helper_id, 'gig', '⭐ Rate the host', 'Both sides completed "' || NEW.title || '". Leave a rating and comment.', NEW.id, 'gig');
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_gig_lifecycle ON public.gig_listings;
CREATE TRIGGER trg_notify_gig_lifecycle
AFTER UPDATE ON public.gig_listings
FOR EACH ROW EXECUTE FUNCTION public.notify_gig_lifecycle();

CREATE OR REPLACE FUNCTION public.notify_user_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE rater_name text;
BEGIN
  SELECT display_name INTO rater_name FROM profiles WHERE user_id = NEW.rater_id LIMIT 1;
  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (NEW.ratee_id, 'rating', '⭐ New review on your profile',
    COALESCE(rater_name, 'Someone') || ' left you ' || NEW.score || '/5' ||
      CASE WHEN NEW.comment IS NOT NULL AND length(trim(NEW.comment)) > 0 THEN ': "' || left(NEW.comment, 120) || '"' ELSE '.' END,
    NEW.context_id, 'rating');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_user_rating ON public.user_ratings;
CREATE TRIGGER trg_notify_user_rating
AFTER INSERT ON public.user_ratings
FOR EACH ROW EXECUTE FUNCTION public.notify_user_rating();