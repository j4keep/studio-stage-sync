// Transcribe a podcast recording: download all chunks from R2, concatenate as one webm blob,
// and send to Lovable AI Gateway speech-to-text. Stores transcript text + raw segments.
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "wheuat-media";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "AI not configured" }, 500);
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    if (!accessKeyId || !secretAccessKey || !accountId) return json({ error: "R2 not configured" }, 500);

    const { recordingId } = (await req.json()) as { recordingId?: string };
    if (!recordingId) return json({ error: "recordingId required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rec, error: recErr } = await supabase
      .from("podcast_recordings")
      .select("id, episode_id, r2_prefix, mime_type, chunk_count, duration_seconds")
      .eq("id", recordingId)
      .maybeSingle();
    if (recErr || !rec) return json({ error: "Recording not found" }, 404);

    // Upsert transcript row
    const { data: tr, error: trErr } = await supabase
      .from("podcast_transcripts")
      .insert({ episode_id: rec.episode_id, recording_id: rec.id, status: "processing" })
      .select("id")
      .single();
    if (trErr) return json({ error: trErr.message }, 500);

    // Fire and forget the heavy work
    (async () => {
      try {
        const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
        const r2Base = `https://${accountId}.r2.cloudflarestorage.com/${BUCKET}`;
        const chunks: Uint8Array[] = [];
        const count = rec.chunk_count ?? 0;
        for (let i = 0; i < count; i++) {
          const key = `${rec.r2_prefix}${i.toString().padStart(6, "0")}.webm`;
          const r = await client.fetch(`${r2Base}/${key}`);
          if (!r.ok) {
            console.warn("missing chunk", key, r.status);
            continue;
          }
          chunks.push(new Uint8Array(await r.arrayBuffer()));
        }
        if (chunks.length === 0) throw new Error("No chunks found");
        const total = chunks.reduce((n, c) => n + c.byteLength, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { merged.set(c, off); off += c.byteLength; }

        const fd = new FormData();
        const ext = rec.mime_type?.includes("mp4") ? "mp4" : "webm";
        // Lovable AI Gateway supports OpenAI-compatible transcription models.
        fd.append("model", "openai/gpt-4o-mini-transcribe");
        fd.append("response_format", "verbose_json");
        fd.append("timestamp_granularities[]", "word");
        fd.append("timestamp_granularities[]", "segment");
        fd.append("file", new Blob([merged.buffer as ArrayBuffer], { type: rec.mime_type || "video/webm" }), `recording.${ext}`);

        let resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "edge-function" },
          body: fd,
        });
        if (!resp.ok) {
          const firstError = await resp.text().catch(() => "");
          console.warn("verbose transcription failed, retrying json", firstError);
          const retry = new FormData();
          retry.append("model", "openai/gpt-4o-mini-transcribe");
          retry.append("response_format", "json");
          retry.append("file", new Blob([merged.buffer as ArrayBuffer], { type: rec.mime_type || "video/webm" }), `recording.${ext}`);
          resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "edge-function" },
            body: retry,
          });
        }
        if (!resp.ok) throw new Error(`STT failed: ${resp.status} ${await resp.text().catch(() => "")}`);
        const data = await resp.json();

        // Build words array. If whisper didn't return per-word timings, fall back to splitting
        // each segment evenly across its tokens.
        type Word = { word: string; start: number; end: number };
        let words: Word[] = Array.isArray(data.words) ? data.words : [];
        if (!words.length && Array.isArray(data.segments)) {
          for (const s of data.segments) {
            const tokens = String(s.text || "").trim().split(/\s+/).filter(Boolean);
            if (!tokens.length) continue;
            const dur = (s.end - s.start) / tokens.length;
            tokens.forEach((t: string, i: number) => {
              words.push({ word: t, start: s.start + i * dur, end: s.start + (i + 1) * dur });
            });
          }
        }
        if (!words.length && data.text) {
          const tokens = String(data.text).trim().split(/\s+/).filter(Boolean);
          const duration = Math.max(1, Number(data.duration || rec.duration_seconds || tokens.length * 0.45));
          const step = duration / Math.max(1, tokens.length);
          words = tokens.map((word: string, i: number) => ({ word, start: i * step, end: (i + 1) * step }));
        }

        await supabase.from("podcast_transcripts").update({
          text: data.text || "",
          segments: data.segments ?? null,
          words,
          status: "ready",
        }).eq("id", tr.id);

        if (typeof data.duration === "number") {
          await supabase.from("podcast_recordings")
            .update({ duration_seconds: Math.round(data.duration) })
            .eq("id", rec.id);
        }
      } catch (e) {
        console.error("transcribe error", e);
        await supabase.from("podcast_transcripts").update({
          status: "failed",
          error: e instanceof Error ? e.message : "Unknown",
        }).eq("id", tr.id);
      }
    })();

    return json({ transcriptId: tr.id, status: "processing" });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
