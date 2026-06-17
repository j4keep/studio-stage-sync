// Mint a LiveKit access token for a participant joining a podcast room.
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) {
      return json({ error: "LiveKit not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { episodeId, inviteToken } = body as { episodeId?: string; inviteToken?: string };
    if (!episodeId) return json({ error: "episodeId required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify the caller — host (auth header) or guest (invite token)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let displayName = "Guest";
    let role: "host" | "cohost" | "guest" | "producer" = "guest";

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await userClient.auth.getUser(token);
      userId = data.user?.id ?? null;
      displayName = data.user?.user_metadata?.display_name || data.user?.email?.split("@")[0] || "Host";
    }

    const { data: episode } = await supabase
      .from("podcast_episodes")
      .select("id, host_user_id, livekit_room, title")
      .eq("id", episodeId)
      .maybeSingle();
    if (!episode) return json({ error: "Episode not found" }, 404);

    if (userId && userId === episode.host_user_id) {
      role = "host";
    } else if (inviteToken) {
      const { data: participant } = await supabase
        .from("podcast_participants")
        .select("id, display_name, role, user_id")
        .eq("episode_id", episodeId)
        .eq("invite_token", inviteToken)
        .maybeSingle();
      if (!participant) return json({ error: "Invalid invite" }, 403);
      displayName = participant.display_name;
      role = (participant.role as typeof role) ?? "guest";
      if (userId && !participant.user_id) {
        await supabase.from("podcast_participants").update({ user_id: userId, joined_at: new Date().toISOString() }).eq("id", participant.id);
      }
    } else if (userId) {
      // Authenticated non-host viewer — must already be a participant
      const { data: participant } = await supabase
        .from("podcast_participants")
        .select("id, display_name, role")
        .eq("episode_id", episodeId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!participant) return json({ error: "Not invited" }, 403);
      displayName = participant.display_name;
      role = (participant.role as typeof role) ?? "guest";
    } else {
      return json({ error: "Auth or invite required" }, 401);
    }

    const identity = userId ?? `guest-${crypto.randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      video: {
        room: episode.livekit_room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      name: displayName,
      metadata: JSON.stringify({ role, episodeId, userId }),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(apiKey)
      .setSubject(identity)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 6)
      .setNotBefore(now - 10)
      .sign(new TextEncoder().encode(apiSecret));

    return json({ token: jwt, url, room: episode.livekit_room, identity, role, displayName });
  } catch (e) {
    console.error("livekit-token error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
