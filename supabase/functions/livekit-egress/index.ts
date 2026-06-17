// Start/stop LiveKit RTMP egress for fan-out streaming to YouTube/Twitch/Custom RTMP.
// Uses the LiveKit server SDK. Action = "start" | "stop".
import { createClient } from "npm:@supabase/supabase-js@2";
import { EgressClient, EncodedFileType, EncodingOptionsPreset } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { action, episodeId, egressId } = (await req.json()) as {
      action: "start" | "stop";
      episodeId?: string;
      egressId?: string;
    };
    if (action !== "start" && action !== "stop") return json({ error: "Invalid action" }, 400);

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "stop") {
      if (egressId && apiKey && apiSecret && url) {
        const httpHost = url.replace(/^wss?:\/\//, "https://");
        const egress = new EgressClient(httpHost, apiKey, apiSecret);
        await egress.stopEgress(egressId);
      }
      if (episodeId) {
        await supabase.from("podcast_episodes").update({ is_streaming: false, status: "lobby" }).eq("id", episodeId);
      }
      return json({ ok: true });
    }

    if (!episodeId) return json({ error: "episodeId required" }, 400);
    const { data: ep } = await supabase
      .from("podcast_episodes")
      .select("id, livekit_room")
      .eq("id", episodeId)
      .maybeSingle();
    if (!ep) return json({ error: "Episode not found" }, 404);

    const { data: dests } = await supabase
      .from("podcast_stream_destinations")
      .select("rtmp_url, stream_key, enabled")
      .eq("episode_id", episodeId)
      .eq("enabled", true);

    const urls = (dests ?? []).map((d) =>
      d.rtmp_url.endsWith("/") ? `${d.rtmp_url}${d.stream_key}` : `${d.rtmp_url}/${d.stream_key}`,
    );
    if (urls.length === 0) {
      await supabase.from("podcast_episodes").update({ is_streaming: true, status: "live" }).eq("id", episodeId);
      return json({ ok: true, inAppOnly: true, message: "Live on WHEUAT. Add an RTMP destination to simulcast." });
    }
    if (!apiKey || !apiSecret || !url) return json({ error: "RTMP streaming is not configured yet, but your in-app live room is still available." });

    // LiveKit's EgressClient expects an https host, not the wss one used by clients.
    const httpHost = url.replace(/^wss?:\/\//, "https://");
    const egress = new EgressClient(httpHost, apiKey, apiSecret);

    const info = await egress.startRoomCompositeEgress(
      ep.livekit_room,
      { stream: { protocol: 0 /* RTMP */, urls } } as never,
      { layout: "grid", encodingOptions: EncodingOptionsPreset.H264_1080P_30 },
    );

    await supabase.from("podcast_episodes").update({ is_streaming: true }).eq("id", episodeId);
    return json({ ok: true, egressId: info.egressId, info });
  } catch (e) {
    console.error("egress error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
