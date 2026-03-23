import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find expired battles that haven't been decided yet
  const { data: expiredBattles, error } = await supabase
    .from("battles")
    .select("*")
    .lte("expires_at", new Date().toISOString())
    .is("winner_id", null)
    .in("status", ["open", "active"]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];

  for (const battle of expiredBattles || []) {
    // Count votes for each side
    const { data: votes } = await supabase
      .from("battle_votes")
      .select("voted_for")
      .eq("battle_id", battle.id);

    const challengerVotes = (votes || []).filter((v: any) => v.voted_for === battle.challenger_id).length;
    const opponentVotes = (votes || []).filter((v: any) => v.voted_for === battle.opponent_id).length;

    // Need at least one vote and an opponent to declare winner
    if (!battle.opponent_id || (challengerVotes === 0 && opponentVotes === 0)) {
      // Mark as expired with no winner
      await supabase.from("battles").update({ status: "expired" }).eq("id", battle.id);
      continue;
    }

    let winnerId: string;
    let loserId: string;
    let winnerVoteCount: number;
    let loserVoteCount: number;
    let winnerCover: string | null;
    let winnerMedia: string | null;
    let winnerTitle: string | null;

    if (challengerVotes >= opponentVotes) {
      winnerId = battle.challenger_id;
      loserId = battle.opponent_id;
      winnerVoteCount = challengerVotes;
      loserVoteCount = opponentVotes;
      winnerCover = battle.challenger_cover_url;
      winnerMedia = battle.challenger_media_url;
      winnerTitle = battle.challenger_title;
    } else {
      winnerId = battle.opponent_id;
      loserId = battle.challenger_id;
      winnerVoteCount = opponentVotes;
      loserVoteCount = challengerVotes;
      winnerCover = battle.opponent_cover_url;
      winnerMedia = battle.opponent_media_url;
      winnerTitle = battle.opponent_title;
    }

    // Update battle with winner
    await supabase.from("battles").update({
      winner_id: winnerId,
      status: "completed",
    }).eq("id", battle.id);

    // Record win permanently
    await supabase.from("battle_wins").insert({
      battle_id: battle.id,
      winner_id: winnerId,
      loser_id: loserId,
      battle_title: battle.title,
      winner_votes: winnerVoteCount,
      loser_votes: loserVoteCount,
      media_type: battle.media_type,
      winner_cover_url: winnerCover,
      winner_media_url: winnerMedia,
      winner_title: winnerTitle,
    });

    // Notify winner
    const { data: winnerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", winnerId)
      .single();

    await supabase.from("notifications").insert({
      user_id: winnerId,
      type: "battle_win",
      title: "🏆 You Won!",
      body: `You won the battle "${battle.title}" with ${winnerVoteCount} votes!`,
      reference_id: battle.id,
      reference_type: "battle",
    });

    results.push({ battleId: battle.id, winnerId, challengerVotes, opponentVotes });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
