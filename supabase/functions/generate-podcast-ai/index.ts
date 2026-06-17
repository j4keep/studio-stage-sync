// Generate AI summary, chapters, title ideas, soundbites, and show notes for a podcast episode
// based on the combined transcript text. Uses Lovable AI Gateway (Gemini).
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

    const { episodeId } = (await req.json()) as { episodeId?: string };
    if (!episodeId) return json({ error: "episodeId required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: transcripts } = await supabase
      .from("podcast_transcripts")
      .select("text")
      .eq("episode_id", episodeId)
      .eq("status", "ready");

    const combined = (transcripts ?? []).map((t) => t.text).filter(Boolean).join("\n\n").slice(0, 60000);
    if (!combined.trim()) return json({ error: "Transcribe a recording first." });

    const prompt = `You are an audio podcast producer. Given the transcript below, produce:
1. A 2-3 paragraph SUMMARY.
2. CHAPTERS as a JSON array of { "title": string, "start_seconds": number } (estimate start_seconds evenly across the transcript by line position; 8-12 chapters).
3. TITLES — 5 catchy episode title ideas.
4. SOUNDBITES — 5 short, punchy quote-worthy snippets pulled verbatim from the transcript.
5. SHOW_NOTES — a markdown blob with summary, chapter list, and 3-5 key takeaways.

Return STRICT JSON: { "summary": string, "chapters": [...], "titles": [string], "soundbites": [string], "show_notes": string }

Transcript:
"""
${combined}
"""`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return json({ error: `AI error: ${resp.status} ${t}` }, resp.status);
    }
    const body = await resp.json();
    const content = body?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { parsed = { summary: content }; }

    await supabase.from("podcast_episodes").update({
      ai_summary: parsed.summary ?? null,
      ai_chapters: parsed.chapters ?? null,
      ai_titles: parsed.titles ?? null,
      ai_soundbites: parsed.soundbites ?? null,
      ai_show_notes: parsed.show_notes ?? null,
    }).eq("id", episodeId);

    return json({ ok: true, ...parsed });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
