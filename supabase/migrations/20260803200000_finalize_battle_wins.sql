-- Permanently record battle winners when the voting window ends.
-- Client + cron can call these; SECURITY DEFINER bypasses RLS safely.

CREATE OR REPLACE FUNCTION public._record_battle_win(p_battle public.battles)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenger_votes integer := 0;
  v_opponent_votes integer := 0;
  v_winner_id uuid;
  v_loser_id uuid;
  v_winner_votes integer;
  v_loser_votes integer;
  v_winner_cover text;
  v_winner_media text;
  v_winner_title text;
BEGIN
  IF p_battle.id IS NULL THEN
    RETURN false;
  END IF;

  -- Already permanently recorded
  IF EXISTS (SELECT 1 FROM public.battle_wins bw WHERE bw.battle_id = p_battle.id) THEN
    IF p_battle.winner_id IS NULL THEN
      UPDATE public.battles b
      SET winner_id = (
            SELECT bw.winner_id FROM public.battle_wins bw WHERE bw.battle_id = p_battle.id LIMIT 1
          ),
          status = CASE
            WHEN b.status IN ('open', 'active') THEN 'completed'
            ELSE b.status
          END
      WHERE b.id = p_battle.id;
    END IF;
    RETURN false;
  END IF;

  -- Need an opponent
  IF p_battle.opponent_id IS NULL THEN
    UPDATE public.battles
    SET status = 'expired'
    WHERE id = p_battle.id AND winner_id IS NULL;
    RETURN false;
  END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE v.voted_for = p_battle.challenger_id
        AND NOT (v.user_id = p_battle.challenger_id AND v.voted_for = p_battle.challenger_id)
    ),
    COUNT(*) FILTER (
      WHERE v.voted_for = p_battle.opponent_id
        AND NOT (
          p_battle.opponent_id IS NOT NULL
          AND v.user_id = p_battle.opponent_id
          AND v.voted_for = p_battle.opponent_id
        )
    )
  INTO v_challenger_votes, v_opponent_votes
  FROM public.battle_votes v
  WHERE v.battle_id = p_battle.id
    AND v.user_id IS NOT NULL
    AND v.voted_for IS NOT NULL;

  -- Prefer an already-declared winner_id (backfill path)
  IF p_battle.winner_id IS NOT NULL
     AND (
       p_battle.winner_id = p_battle.challenger_id
       OR p_battle.winner_id = p_battle.opponent_id
     ) THEN
    v_winner_id := p_battle.winner_id;
    IF v_winner_id = p_battle.challenger_id THEN
      v_loser_id := p_battle.opponent_id;
      v_winner_votes := v_challenger_votes;
      v_loser_votes := v_opponent_votes;
      v_winner_cover := p_battle.challenger_cover_url;
      v_winner_media := p_battle.challenger_media_url;
      v_winner_title := p_battle.challenger_title;
    ELSE
      v_loser_id := p_battle.challenger_id;
      v_winner_votes := v_opponent_votes;
      v_loser_votes := v_challenger_votes;
      v_winner_cover := p_battle.opponent_cover_url;
      v_winner_media := p_battle.opponent_media_url;
      v_winner_title := p_battle.opponent_title;
    END IF;
  ELSE
    -- No votes or exact tie → close without a recorded win
    IF (v_challenger_votes = 0 AND v_opponent_votes = 0)
       OR v_challenger_votes = v_opponent_votes THEN
      UPDATE public.battles
      SET status = CASE
        WHEN status IN ('open', 'active') THEN 'expired'
        ELSE status
      END
      WHERE id = p_battle.id AND winner_id IS NULL;
      RETURN false;
    END IF;

    IF v_challenger_votes > v_opponent_votes THEN
      v_winner_id := p_battle.challenger_id;
      v_loser_id := p_battle.opponent_id;
      v_winner_votes := v_challenger_votes;
      v_loser_votes := v_opponent_votes;
      v_winner_cover := p_battle.challenger_cover_url;
      v_winner_media := p_battle.challenger_media_url;
      v_winner_title := p_battle.challenger_title;
    ELSE
      v_winner_id := p_battle.opponent_id;
      v_loser_id := p_battle.challenger_id;
      v_winner_votes := v_opponent_votes;
      v_loser_votes := v_challenger_votes;
      v_winner_cover := p_battle.opponent_cover_url;
      v_winner_media := p_battle.opponent_media_url;
      v_winner_title := p_battle.opponent_title;
    END IF;

    UPDATE public.battles
    SET
      winner_id = v_winner_id,
      status = CASE
        WHEN status IN ('open', 'active', 'expired') THEN 'completed'
        ELSE status
      END
    WHERE id = p_battle.id;
  END IF;

  INSERT INTO public.battle_wins (
    battle_id,
    winner_id,
    loser_id,
    battle_title,
    winner_votes,
    loser_votes,
    media_type,
    winner_cover_url,
    winner_media_url,
    winner_title,
    declared_at
  ) VALUES (
    p_battle.id,
    v_winner_id,
    v_loser_id,
    COALESCE(NULLIF(p_battle.title, ''), 'Battle'),
    v_winner_votes,
    v_loser_votes,
    COALESCE(NULLIF(p_battle.media_type, ''), 'audio'),
    v_winner_cover,
    v_winner_media,
    v_winner_title,
    COALESCE(p_battle.expires_at, now())
  );

  -- Avoid duplicate win notifications on backfill
  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = v_winner_id
      AND n.type = 'battle_win'
      AND n.reference_id = p_battle.id
  ) THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      reference_id,
      reference_type
    ) VALUES (
      v_winner_id,
      'battle_win',
      '🏆 You Won!',
      format(
        'You won the battle "%s" with %s votes!',
        COALESCE(NULLIF(p_battle.title, ''), 'Battle'),
        v_winner_votes
      ),
      p_battle.id,
      'battle'
    );
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_battle(p_battle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.battles;
  recorded boolean := false;
BEGIN
  IF p_battle_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_id');
  END IF;

  SELECT * INTO b FROM public.battles WHERE id = p_battle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Already recorded
  IF EXISTS (SELECT 1 FROM public.battle_wins bw WHERE bw.battle_id = b.id) THEN
    RETURN jsonb_build_object('ok', true, 'recorded', false, 'reason', 'already_recorded');
  END IF;

  -- Voting window still open (unless winner already set and we're backfilling)
  IF b.winner_id IS NULL AND b.expires_at IS NOT NULL AND b.expires_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'voting_open');
  END IF;

  recorded := public._record_battle_win(b);
  RETURN jsonb_build_object(
    'ok', true,
    'recorded', recorded,
    'battle_id', p_battle_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_expired_battles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.battles;
  processed integer := 0;
  recorded integer := 0;
  did boolean;
BEGIN
  -- Expired battles missing a permanent win row
  FOR b IN
    SELECT *
    FROM public.battles
    WHERE opponent_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.battle_wins bw WHERE bw.battle_id = battles.id
      )
      AND (
        winner_id IS NOT NULL
        OR (
          status IN ('open', 'active', 'completed', 'ended', 'expired')
          AND expires_at IS NOT NULL
          AND expires_at <= now()
        )
      )
    ORDER BY created_at ASC
    LIMIT 150
  LOOP
    processed := processed + 1;
    did := public._record_battle_win(b);
    IF did THEN
      recorded := recorded + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', processed,
    'recorded', recorded
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_battle(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_expired_battles() TO authenticated, anon, service_role;

CREATE INDEX IF NOT EXISTS idx_battle_wins_loser ON public.battle_wins(loser_id);

-- One permanent record per battle
CREATE UNIQUE INDEX IF NOT EXISTS idx_battle_wins_battle_unique
  ON public.battle_wins(battle_id)
  WHERE battle_id IS NOT NULL;
