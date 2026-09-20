-- YAJ.TV: episodes/series grouping, per-title subscriber-only gating, and
-- room for the expanded category list (Kids, Action, etc. — those are
-- free-text values in the existing `category` column, no schema change
-- needed for them).

ALTER TABLE public.tv_posts
  ADD COLUMN IF NOT EXISTS series_title text,
  ADD COLUMN IF NOT EXISTS episode_number integer,
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'free' CHECK (access_tier IN ('free', 'subscribers'));

CREATE INDEX IF NOT EXISTS tv_posts_series_idx ON public.tv_posts (user_id, series_title) WHERE series_title IS NOT NULL;

-- Per-creator subscriptions gate "Subscribers Only" titles. Free to subscribe
-- for now (preview/ledger only, same as tv_post_donations) — no payment
-- processor wired in yet, so this is a real access relationship, not a paid one.
CREATE TABLE IF NOT EXISTS public.tv_creator_subscriptions (
  subscriber_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscriber_id, creator_id)
);
GRANT SELECT, INSERT, DELETE ON public.tv_creator_subscriptions TO authenticated;
GRANT ALL ON public.tv_creator_subscriptions TO service_role;
ALTER TABLE public.tv_creator_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_creator_subscriptions read own side" ON public.tv_creator_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = subscriber_id OR auth.uid() = creator_id);
CREATE POLICY "tv_creator_subscriptions self insert" ON public.tv_creator_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = subscriber_id AND subscriber_id <> creator_id);
CREATE POLICY "tv_creator_subscriptions self delete" ON public.tv_creator_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = subscriber_id);
CREATE INDEX IF NOT EXISTS tv_creator_subscriptions_creator_idx ON public.tv_creator_subscriptions (creator_id);
