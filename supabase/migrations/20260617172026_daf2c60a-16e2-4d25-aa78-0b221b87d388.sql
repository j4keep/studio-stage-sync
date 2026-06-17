-- ATCHUP IMPORT
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, name TEXT, username TEXT UNIQUE, username_lower TEXT UNIQUE,
  photo_url TEXT, tagline TEXT, bio TEXT, location TEXT,
  language TEXT DEFAULT 'English', privacy_show_email BOOLEAN DEFAULT false,
  has_payment_method BOOLEAN DEFAULT false, streak_count INTEGER DEFAULT 0,
  notification_payment_received BOOLEAN DEFAULT true,
  notification_member_joined BOOLEAN DEFAULT true,
  notification_payment_due BOOLEAN DEFAULT true,
  notification_message_sound BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_all" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert_self" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_self" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_atchup_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, name, username, username_lower)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    lower(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created_atchup ON auth.users;
CREATE TRIGGER on_auth_user_created_atchup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_atchup_user();

INSERT INTO public.users (id, email, name)
SELECT p.user_id, p.email, p.display_name FROM public.profiles p
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.savings_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, amount_per_period NUMERIC NOT NULL, frequency TEXT NOT NULL,
  max_members INTEGER NOT NULL, current_members INTEGER NOT NULL DEFAULT 1,
  current_period INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'forming',
  invite_code TEXT UNIQUE, start_date DATE,
  requires_verified_plus BOOLEAN DEFAULT false, allowed_payment_methods TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_circles TO authenticated;
GRANT ALL ON public.savings_circles TO service_role;
ALTER TABLE public.savings_circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "circles_read_auth" ON public.savings_circles FOR SELECT TO authenticated USING (true);
CREATE POLICY "circles_insert_owner" ON public.savings_circles FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "circles_update_owner" ON public.savings_circles FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "circles_delete_owner" ON public.savings_circles FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.savings_circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.savings_circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL, position INTEGER NOT NULL,
  has_received_pot BOOLEAN NOT NULL DEFAULT false, payment_method TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(circle_id, user_id), UNIQUE(circle_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_circle_members TO authenticated;
GRANT ALL ON public.savings_circle_members TO service_role;
ALTER TABLE public.savings_circle_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_read_auth" ON public.savings_circle_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert" ON public.savings_circle_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR auth.uid() IN (SELECT owner_id FROM public.savings_circles WHERE id = circle_id));
CREATE POLICY "members_update" ON public.savings_circle_members FOR UPDATE TO authenticated USING (auth.uid() = user_id OR auth.uid() IN (SELECT owner_id FROM public.savings_circles WHERE id = circle_id));
CREATE POLICY "members_delete" ON public.savings_circle_members FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() IN (SELECT owner_id FROM public.savings_circles WHERE id = circle_id));

CREATE TABLE public.savings_circle_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.savings_circles(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL, due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  UNIQUE(circle_id, period_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_circle_periods TO authenticated;
GRANT ALL ON public.savings_circle_periods TO service_role;
ALTER TABLE public.savings_circle_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periods_read_auth" ON public.savings_circle_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "periods_write" ON public.savings_circle_periods FOR ALL TO authenticated USING (
  auth.uid() IN (SELECT user_id FROM public.savings_circle_members WHERE circle_id = savings_circle_periods.circle_id)
  OR auth.uid() IN (SELECT owner_id FROM public.savings_circles WHERE id = savings_circle_periods.circle_id)
) WITH CHECK (true);

CREATE TABLE public.savings_circle_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.savings_circles(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL, member_id UUID NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false, paid_at TIMESTAMPTZ,
  UNIQUE(circle_id, period_number, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_circle_payments TO authenticated;
GRANT ALL ON public.savings_circle_payments TO service_role;
ALTER TABLE public.savings_circle_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_read_auth" ON public.savings_circle_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_write" ON public.savings_circle_payments FOR ALL TO authenticated USING (
  auth.uid() IN (SELECT user_id FROM public.savings_circle_members WHERE circle_id = savings_circle_payments.circle_id)
  OR auth.uid() IN (SELECT owner_id FROM public.savings_circles WHERE id = savings_circle_payments.circle_id)
) WITH CHECK (true);

CREATE TABLE public.savings_circle_terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_circle_terms_acceptance TO authenticated;
GRANT ALL ON public.savings_circle_terms_acceptance TO service_role;
ALTER TABLE public.savings_circle_terms_acceptance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "terms_read_self" ON public.savings_circle_terms_acceptance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "terms_insert_self" ON public.savings_circle_terms_acceptance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.savings_circle_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.savings_circles(id) ON DELETE CASCADE,
  donor_member_id UUID NOT NULL, recipient_member_id UUID NOT NULL,
  period_number INTEGER NOT NULL, amount NUMERIC NOT NULL, reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_circle_donations TO authenticated;
GRANT ALL ON public.savings_circle_donations TO service_role;
ALTER TABLE public.savings_circle_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cd_read_auth" ON public.savings_circle_donations FOR SELECT TO authenticated USING (true);
CREATE POLICY "cd_insert_member" ON public.savings_circle_donations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.savings_circle_members WHERE circle_id = savings_circle_donations.circle_id)
);

CREATE TABLE public.fundraiser_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL,
  goal_amount NUMERIC NOT NULL, raised_amount NUMERIC NOT NULL DEFAULT 0,
  cover_image TEXT, expires_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fundraiser_campaigns TO authenticated;
GRANT ALL ON public.fundraiser_campaigns TO service_role;
ALTER TABLE public.fundraiser_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fund_read_auth" ON public.fundraiser_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "fund_insert_self" ON public.fundraiser_campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fund_update_self" ON public.fundraiser_campaigns FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fund_delete_self" ON public.fundraiser_campaigns FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.fundraiser_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.fundraiser_campaigns(id) ON DELETE CASCADE,
  donor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL, message TEXT, anonymous BOOLEAN NOT NULL DEFAULT false,
  stripe_session_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fundraiser_donations TO authenticated;
GRANT ALL ON public.fundraiser_donations TO service_role;
ALTER TABLE public.fundraiser_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fd_read_auth" ON public.fundraiser_donations FOR SELECT TO authenticated USING (true);
CREATE POLICY "fd_insert_self" ON public.fundraiser_donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = donor_user_id);

CREATE TABLE public.followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followers TO authenticated;
GRANT ALL ON public.followers TO service_role;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "f_read_all" ON public.followers FOR SELECT TO authenticated USING (true);
CREATE POLICY "f_insert_self" ON public.followers FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "f_delete_self" ON public.followers FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE TABLE public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_ids UUID[] NOT NULL,
  circle_id UUID REFERENCES public.savings_circles(id) ON DELETE CASCADE,
  is_group BOOLEAN DEFAULT false, group_name TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "th_read_part" ON public.threads FOR SELECT TO authenticated USING (auth.uid() = ANY(participant_ids));
CREATE POLICY "th_insert_part" ON public.threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = ANY(participant_ids));
CREATE POLICY "th_update_part" ON public.threads FOR UPDATE TO authenticated USING (auth.uid() = ANY(participant_ids));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS receiver_id UUID,
  ADD COLUMN IF NOT EXISTS images TEXT[],
  ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT false;
$$;

CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'verified_plus',
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT, stripe_subscription_id TEXT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ, payment_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "us_read_auth" ON public.user_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "us_insert_self" ON public.user_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "us_update_self" ON public.user_subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ratee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL, context_id UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT, tags TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ratee_id, rater_id, context_type, context_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ratings TO authenticated;
GRANT ALL ON public.user_ratings TO service_role;
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_read_auth" ON public.user_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ur_insert_self" ON public.user_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = rater_id);

CREATE TABLE public.user_reputation_summary (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reliability_score INTEGER NOT NULL DEFAULT 100,
  savings_score NUMERIC NOT NULL DEFAULT 5.0,
  savings_ratings_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_reputation_summary TO authenticated;
GRANT ALL ON public.user_reputation_summary TO service_role;
ALTER TABLE public.user_reputation_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep_read_auth" ON public.user_reputation_summary FOR SELECT TO authenticated USING (true);
CREATE POLICY "rep_write_auth" ON public.user_reputation_summary FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS admin_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_by UUID,
  ADD COLUMN IF NOT EXISTS images TEXT[],
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_circles_updated BEFORE UPDATE ON public.savings_circles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fundraisers_updated BEFORE UPDATE ON public.fundraiser_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();