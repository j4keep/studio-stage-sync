-- Battle "contract" lifecycle + content reports for Customer Relations moderation.

-- 1) Battle archive / mutual-cancel columns
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS cancel_requested_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS challenger_archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS opponent_archived_at timestamptz;

-- 2) Hard delete only before acceptance (pending/open, no opponent entry, no votes).
--    After accept, battles stay in Arena history unless an admin removes them.
DROP POLICY IF EXISTS "Users can delete their own battles" ON public.battles;
DROP POLICY IF EXISTS "Creators can delete pending battles only" ON public.battles;
DROP POLICY IF EXISTS "Admins can delete any battle" ON public.battles;

CREATE POLICY "Creators can delete pending battles only"
  ON public.battles FOR DELETE TO authenticated
  USING (
    auth.uid() = challenger_id
    AND lower(coalesce(status, '')) IN ('open', 'pending')
    AND (
      opponent_id IS NULL
      OR (opponent_media_url IS NULL AND opponent_cover_url IS NULL)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.battle_votes v WHERE v.battle_id = battles.id
    )
  );

CREATE POLICY "Admins can delete any battle"
  ON public.battles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Admin hard-delete for posts (Customer Relations moderation)
DROP POLICY IF EXISTS "Admins can delete any post" ON public.posts;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'posts'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can delete any post"
        ON public.posts FOR DELETE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
    $p$;
  END IF;
END $$;

-- 4) Mutual cancel after accept (before first vote)
CREATE OR REPLACE FUNCTION public.request_or_confirm_battle_cancel(p_battle_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.battles%ROWTYPE;
  vote_count integer;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO b FROM public.battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'battle not found';
  END IF;

  IF uid IS DISTINCT FROM b.challenger_id AND uid IS DISTINCT FROM b.opponent_id THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  IF lower(coalesce(b.status, '')) = 'cancelled' THEN
    RETURN 'already_cancelled';
  END IF;

  -- Pending/open must use hard delete by creator — not this path.
  IF lower(coalesce(b.status, '')) IN ('open', 'pending')
     AND (b.opponent_media_url IS NULL AND b.opponent_cover_url IS NULL) THEN
    RAISE EXCEPTION 'pending battles must be deleted by the creator';
  END IF;

  SELECT count(*)::integer INTO vote_count
  FROM public.battle_votes
  WHERE battle_id = p_battle_id;

  IF vote_count > 0 THEN
    RAISE EXCEPTION 'battle is locked after the first vote';
  END IF;

  IF b.cancel_requested_by IS NULL THEN
    UPDATE public.battles
    SET cancel_requested_by = uid,
        cancel_requested_at = now(),
        updated_at = now()
    WHERE id = p_battle_id;
    RETURN 'requested';
  END IF;

  IF b.cancel_requested_by = uid THEN
    RETURN 'already_requested';
  END IF;

  -- Second participant agrees → cancel (keep row for history, hide from feed via status).
  UPDATE public.battles
  SET status = 'cancelled',
      cancel_requested_at = now(),
      updated_at = now()
  WHERE id = p_battle_id;
  RETURN 'cancelled';
END;
$$;

REVOKE ALL ON FUNCTION public.request_or_confirm_battle_cancel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_or_confirm_battle_cancel(uuid) TO authenticated, service_role;

-- 5) Content reports (battles, posts, etc.) for Customer Relations
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('battle', 'post', 'other')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  admin_notes text
);

CREATE INDEX IF NOT EXISTS content_reports_status_idx ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_target_idx ON public.content_reports (target_type, target_id);

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can file content reports" ON public.content_reports;
DROP POLICY IF EXISTS "Users can view own content reports" ON public.content_reports;
DROP POLICY IF EXISTS "Admins manage content reports" ON public.content_reports;

CREATE POLICY "Users can file content reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own content reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage content reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete content reports"
  ON public.content_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
