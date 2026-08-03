import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BattleRow = {
  id: string;
  title: string | null;
  status: string | null;
  media_type: string | null;
  challenger_id: string;
  opponent_id: string | null;
  winner_id: string | null;
  expires_at: string | null;
  challenger_cover_url: string | null;
  challenger_media_url: string | null;
  challenger_title: string | null;
  opponent_cover_url: string | null;
  opponent_media_url: string | null;
  opponent_title: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { battleId?: string } = {};
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.json();
    }
  } catch {
    body = {};
  }

  // Prefer the SECURITY DEFINER RPC when available (handles completed live battles + backfill).
  if (body.battleId) {
    const { data, error } = await supabase.rpc("finalize_battle", { p_battle_id: body.battleId });
    if (!error) {
      return new Response(JSON.stringify({ source: "rpc", ...((data as object) || {}) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    const { data, error } = await supabase.rpc("finalize_expired_battles");
    if (!error) {
      return new Response(JSON.stringify({ source: "rpc", ...((data as object) || {}) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Fallback when RPC migration is not applied yet
  let query = supabase
    .from("battles")
    .select("*")
    .is("winner_id", null)
    .not("opponent_id", "is", null)
    .in("status", ["open", "active", "completed", "ended"]);

  if (body.battleId) {
    query = query.eq("id", body.battleId);
  } else {
    query = query.lte("expires_at", new Date().toISOString());
  }

  const { data: expiredBattles, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];

  for (const battle of (expiredBattles || []) as BattleRow[]) {
    if (battle.expires_at && new Date(battle.expires_at).getTime() > Date.now()) {
      continue;
    }

    const { data: existingWin } = await supabase
      .from("battle_wins")
      .select("id")
      .eq("battle_id", battle.id)
      .maybeSingle();
    if (existingWin?.id) continue;

    const { data: votes } = await supabase
      .from("battle_votes")
      .select("voted_for, user_id")
      .eq("battle_id", battle.id);

    const countableVotes = (votes || []).filter((v: any) => {
      if (!v.user_id || !v.voted_for) return false;
      if (v.user_id === battle.challenger_id && v.voted_for === battle.challenger_id) return false;
      if (battle.opponent_id && v.user_id === battle.opponent_id && v.voted_for === battle.opponent_id) {
        return false;
      }
      return true;
    });

    const challengerVotes = countableVotes.filter((v: any) => v.voted_for === battle.challenger_id).length;
    const opponentVotes = countableVotes.filter((v: any) => v.voted_for === battle.opponent_id).length;

    if (!battle.opponent_id || (challengerVotes === 0 && opponentVotes === 0) || challengerVotes === opponentVotes) {
      await supabase.from("battles").update({ status: "expired" }).eq("id", battle.id);
      continue;
    }

    const challengerWins = challengerVotes > opponentVotes;
    const winnerId = challengerWins ? battle.challenger_id : battle.opponent_id!;
    const loserId = challengerWins ? battle.opponent_id! : battle.challenger_id;
    const winnerVoteCount = challengerWins ? challengerVotes : opponentVotes;
    const loserVoteCount = challengerWins ? opponentVotes : challengerVotes;
    const winnerCover = challengerWins ? battle.challenger_cover_url : battle.opponent_cover_url;
    const winnerMedia = challengerWins ? battle.challenger_media_url : battle.opponent_media_url;
    const winnerTitle = challengerWins ? battle.challenger_title : battle.opponent_title;

    await supabase
      .from("battles")
      .update({ winner_id: winnerId, status: "completed" })
      .eq("id", battle.id);

    await supabase.from("battle_wins").insert({
      battle_id: battle.id,
      winner_id: winnerId,
      loser_id: loserId,
      battle_title: battle.title || "Battle",
      winner_votes: winnerVoteCount,
      loser_votes: loserVoteCount,
      media_type: battle.media_type || "audio",
      winner_cover_url: winnerCover,
      winner_media_url: winnerMedia,
      winner_title: winnerTitle,
    });

    await supabase.from("notifications").insert({
      user_id: winnerId,
      type: "battle_win",
      title: "🏆 You Won!",
      body: `You won the battle "${battle.title || "Battle"}" with ${winnerVoteCount} votes!`,
      reference_id: battle.id,
      reference_type: "battle",
    });

    results.push({ battleId: battle.id, winnerId, challengerVotes, opponentVotes });
  }

  return new Response(JSON.stringify({ source: "fallback", processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
