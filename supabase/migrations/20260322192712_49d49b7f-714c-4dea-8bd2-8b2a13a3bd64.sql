-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  reference_id uuid,
  reference_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_battle_challenge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenger_name text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.opponent_id IS NOT NULL THEN
    SELECT display_name INTO challenger_name FROM profiles WHERE user_id = NEW.challenger_id LIMIT 1;
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.opponent_id, 'battle_challenge', '🥊 Battle Challenge!', 
      COALESCE(challenger_name, 'Someone') || ' challenged you to a battle: ' || NEW.title,
      NEW.id, 'battle');
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.opponent_media_url IS NOT NULL AND (OLD.opponent_media_url IS NULL) AND NEW.opponent_id IS NOT NULL THEN
    SELECT display_name INTO challenger_name FROM profiles WHERE user_id = NEW.opponent_id LIMIT 1;
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (NEW.challenger_id, 'battle_accepted', '⚔️ Challenge Accepted!',
      COALESCE(challenger_name, 'Someone') || ' accepted your battle: ' || NEW.title,
      NEW.id, 'battle');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_battle_update_notify
  AFTER INSERT OR UPDATE ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.notify_battle_challenge();

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  recipient record;
BEGIN
  SELECT display_name INTO sender_name FROM profiles WHERE user_id = NEW.sender_id LIMIT 1;
  FOR recipient IN
    SELECT user_id FROM conversation_participants WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (recipient.user_id, 'message', '💬 New Message',
      COALESCE(sender_name, 'Someone') || ' sent you a message',
      NEW.conversation_id, 'message');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

CREATE OR REPLACE FUNCTION public.notify_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_name text;
  product record;
BEGIN
  SELECT display_name INTO buyer_name FROM profiles WHERE user_id = NEW.buyer_id LIMIT 1;
  SELECT title, user_id INTO product FROM store_products WHERE id = NEW.product_id LIMIT 1;
  IF product.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (product.user_id, 'purchase', '💰 New Sale!',
      COALESCE(buyer_name, 'Someone') || ' purchased ' || product.title,
      NEW.id, 'purchase');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_purchase_notify
  AFTER INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.notify_purchase();

CREATE OR REPLACE FUNCTION public.notify_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poster_name text;
  follower record;
BEGIN
  SELECT display_name INTO poster_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1;
  FOR follower IN
    SELECT follower_id FROM follows WHERE following_id = NEW.user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (follower.follower_id, 'new_post', '📸 New Post',
      COALESCE(poster_name, 'An artist') || ' shared a new post',
      NEW.id, 'post');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_post_notify
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_post();