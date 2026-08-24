-- Circle notifications: the requester needs to notify the owner, and the owner needs to
-- notify the approved member — both are cross-user inserts, which the notifications
-- table's RLS ("Only service role can insert notifications", actually auth.uid() = user_id)
-- rejects from a plain client insert. SECURITY DEFINER functions do the insert after
-- validating the caller actually has standing to trigger it, so this can't be used to spam
-- arbitrary notifications at other users.

CREATE OR REPLACE FUNCTION public.notify_circle_join_request(p_circle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_circle_name text;
  v_notify boolean;
  v_requester_name text;
BEGIN
  SELECT owner_id, name, notify_new_requests INTO v_owner_id, v_circle_name, v_notify
  FROM public.circles WHERE id = p_circle_id;

  IF v_owner_id IS NULL OR v_owner_id = auth.uid() OR NOT COALESCE(v_notify, true) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = auth.uid() AND status = 'pending'
  ) THEN
    RETURN;
  END IF;

  SELECT display_name INTO v_requester_name FROM public.profiles WHERE user_id = auth.uid();

  INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
  VALUES (
    v_owner_id,
    'New request to join ' || v_circle_name,
    COALESCE(v_requester_name, 'Someone') || ' wants to join your Circle.',
    'circle',
    'circle_request',
    p_circle_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_circle_join_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_circle_join_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_circle_join_approved(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_circle_id uuid;
  v_member_user_id uuid;
  v_circle_name text;
  v_notify boolean;
BEGIN
  SELECT circle_id, user_id INTO v_circle_id, v_member_user_id FROM public.circle_members WHERE id = p_member_id;
  IF v_circle_id IS NULL OR NOT public.is_social_circle_admin(v_circle_id, auth.uid()) THEN
    RETURN;
  END IF;

  SELECT name, notify_new_members INTO v_circle_name, v_notify FROM public.circles WHERE id = v_circle_id;
  IF NOT COALESCE(v_notify, true) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
  VALUES (
    v_member_user_id,
    'You''re in!',
    'Your request to join ' || v_circle_name || ' was approved.',
    'circle',
    'circle_approved',
    v_circle_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_circle_join_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_circle_join_approved(uuid) TO authenticated;
