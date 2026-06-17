// AI picks the best ~5 viral moments from an episode's transcripts and creates clip rows.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI not configured" }, 500);
    const { episodeId, count = 5 } = (await req.json()) as { episodeId?: string; count?: number };
    if (!episodeId) return json({ error: "episodeId required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: transcripts } = await supabase
      .from("podcast_transcripts")
      .select("text, segments")
      .eq("episode_id", episodeId)
      .eq("status", "ready");

    const combined = (transcripts ?? []).map((t) => t.text).filter(Boolean).join("\n\n").slice(0, 60000);
    if (!combined.trim()) return json({ error: "No transcript yet — transcribe first." }, 400);

    const prompt = `You are an expert podcast clipper. From the transcript below, pick the ${count} MOST viral, quotable, share-worthy moments (30-90 seconds each). For each clip return: a punchy title, the verbatim quote, and approximate start/end timestamps in seconds (estimate evenly across transcript length: total runtime is roughly ${Math.round(combined.length / 15)} seconds — distribute your picks across the timeline).

Return STRICT JSON: { "clips": [ { "title": string, "quote": string, "start_seconds": number, "end_seconds": number } ] }

Transcript:
"""
${combined}
"""`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return json({ error: `AI error: ${resp.status} ${await resp.text().catch(() => "")}` }, resp.status);
    const body = await resp.json();
    const parsed = JSON.parse(body?.choices?.[0]?.message?.content ?? "{}");
    const clips: Array<{ title: string; quote: string; start_seconds: number; end_seconds: number }> = parsed.clips ?? [];

    if (clips.length > 0) {
      await supabase.from("podcast_clips").insert(
        clips.map((c) => ({
          episode_id: episodeId,
          title: c.title?.slice(0, 200) ?? "Clip",
          start_seconds: Math.max(0, c.start_seconds ?? 0),
          end_seconds: Math.max((c.start_seconds ?? 0) + 1, c.end_seconds ?? (c.start_seconds ?? 0) + 30),
          format: "9x16",
        })),
      );
    }
    return json({ ok: true, count: clips.length, clips });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
