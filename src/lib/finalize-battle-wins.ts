import { supabase } from "@/integrations/supabase/client";
import {
  getBattleExpiresAt,
  isBattleVotingOpen,
  tallyBattleVotes,
} from "@/lib/battle-ui";

type BattleLike = {
  id: string;
  title?: string | null;
  status?: string | null;
  media_type?: string | null;
  challenger_id?: string | null;
  opponent_id?: string | null;
  winner_id?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  scheduled_start_at?: string | null;
  battle_background?: string | null;
  challenger_cover_url?: string | null;
  challenger_media_url?: string | null;
  challenger_title?: string | null;
  opponent_cover_url?: string | null;
  opponent_media_url?: string | null;
  opponent_title?: string | null;
};

type VoteLike = {
  voted_for?: string | null;
  user_id?: string | null;
  created_at?: string | null;
};

const inFlight = new Set<string>();
let bulkInFlight: Promise<unknown> | null = null;

async function battleWinExists(battleId: string): Promise<boolean> {
  const { data } = await (supabase as any)
    .from("battle_wins")
    .select("id")
    .eq("battle_id", battleId)
    .limit(1)
    .maybeSingle();
  return !!data?.id;
}

/** Best-effort: RPC first, then edge function, then per-battle participant writes. */
export async function finalizeExpiredBattles(userId?: string | null): Promise<void> {
  if (bulkInFlight) {
    await bulkInFlight;
    return;
  }
  bulkInFlight = (async () => {
    try {
      const { error: rpcError } = await (supabase as any).rpc("finalize_expired_battles");
      if (!rpcError) return;

      // Edge function fallback (service role) — ignore if not deployed.
      const { error: fnError } = await supabase.functions
        .invoke("declare-battle-winners", { body: {} })
        .catch(() => ({ error: true as const }));
      if (!fnError) return;

      // Last resort: finalize battles this user fought in (client RLS path).
      if (!userId) return;
      const { data: mine } = await (supabase as any)
        .from("battles")
        .select("*")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .not("opponent_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);
      for (const battle of mine || []) {
        await ensureBattleWinRecorded(battle as BattleLike, { userId });
      }
    } finally {
      bulkInFlight = null;
    }
  })();
  await bulkInFlight;
}

/**
 * Persist a permanent battle_wins row once voting has closed.
 * Safe to call repeatedly — no-ops when already recorded or still open.
 */
export async function ensureBattleWinRecorded(
  battle: BattleLike | null | undefined,
  opts?: {
    votes?: VoteLike[];
    userId?: string | null;
  },
): Promise<boolean> {
  if (!battle?.id || !battle.opponent_id) return false;
  if (inFlight.has(battle.id)) return false;

  // Still inside the voting window
  if (isBattleVotingOpen(battle) && !battle.winner_id) return false;
  if (!battle.winner_id && getBattleExpiresAt(battle).getTime() > Date.now()) return false;

  inFlight.add(battle.id);
  try {
    if (await battleWinExists(battle.id)) return false;

    // 1) Preferred: SECURITY DEFINER RPC
    const { data: rpcData, error: rpcError } = await (supabase as any).rpc("finalize_battle", {
      p_battle_id: battle.id,
    });
    if (!rpcError && rpcData) {
      if (await battleWinExists(battle.id)) return true;
    }

    // 2) Edge function (service role)
    const { error: fnError } = await supabase.functions.invoke("declare-battle-winners", {
      body: { battleId: battle.id },
    });
    if (!fnError && (await battleWinExists(battle.id))) return true;

    // 3) Participant client fallback (RLS: only winner can insert battle_wins)
    return await finalizeBattleAsParticipant(battle, opts?.votes || [], opts?.userId || null);
  } catch {
    return false;
  } finally {
    inFlight.delete(battle.id);
  }
}

async function finalizeBattleAsParticipant(
  battle: BattleLike,
  votes: VoteLike[],
  userId: string | null,
): Promise<boolean> {
  if (!userId || !battle.opponent_id || !battle.challenger_id) return false;
  const isParticipant = userId === battle.challenger_id || userId === battle.opponent_id;
  if (!isParticipant) return false;

  let voteRows = votes;
  if (!voteRows.length) {
    const { data } = await supabase
      .from("battle_votes")
      .select("voted_for, user_id, created_at")
      .eq("battle_id", battle.id);
    voteRows = (data || []) as VoteLike[];
  }

  const tally = tallyBattleVotes(voteRows, battle.challenger_id, battle.opponent_id);
  let winnerId = battle.winner_id || null;
  let loserId: string | null = null;
  let winnerVotes = 0;
  let loserVotes = 0;

  if (winnerId === battle.challenger_id) {
    loserId = battle.opponent_id;
    winnerVotes = tally.leftVotes;
    loserVotes = tally.rightVotes;
  } else if (winnerId === battle.opponent_id) {
    loserId = battle.challenger_id;
    winnerVotes = tally.rightVotes;
    loserVotes = tally.leftVotes;
  } else if (tally.winner === "left") {
    winnerId = battle.challenger_id;
    loserId = battle.opponent_id;
    winnerVotes = tally.leftVotes;
    loserVotes = tally.rightVotes;
  } else if (tally.winner === "right") {
    winnerId = battle.opponent_id;
    loserId = battle.challenger_id;
    winnerVotes = tally.rightVotes;
    loserVotes = tally.leftVotes;
  } else {
    // Tie / no votes — close without a win record
    if (!battle.winner_id) {
      await (supabase as any)
        .from("battles")
        .update({ status: "expired" })
        .eq("id", battle.id);
    }
    return false;
  }

  if (!battle.winner_id) {
    await (supabase as any)
      .from("battles")
      .update({ winner_id: winnerId, status: "completed" })
      .eq("id", battle.id);
  }

  // RLS only allows the winner to insert
  if (userId !== winnerId) return false;

  const winnerIsChallenger = winnerId === battle.challenger_id;
  const { error } = await (supabase as any).from("battle_wins").insert({
    battle_id: battle.id,
    winner_id: winnerId,
    loser_id: loserId,
    battle_title: battle.title || "Battle",
    winner_votes: winnerVotes,
    loser_votes: loserVotes,
    media_type: battle.media_type || "audio",
    winner_cover_url: winnerIsChallenger
      ? battle.challenger_cover_url
      : battle.opponent_cover_url,
    winner_media_url: winnerIsChallenger
      ? battle.challenger_media_url
      : battle.opponent_media_url,
    winner_title: winnerIsChallenger ? battle.challenger_title : battle.opponent_title,
    declared_at: new Date().toISOString(),
  });

  return !error;
}
