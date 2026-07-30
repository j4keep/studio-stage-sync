import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Speech-to-text: accepts { audio: "data:audio/wav;base64,..." } → { text } */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audio } = await req.json();
    if (!audio || typeof audio !== "string") {
      return new Response(JSON.stringify({ error: "No audio received." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const match = /^data:(audio\/[a-z0-9.+-]+);base64,(.*)$/i.exec(audio);
    if (!match) {
      return new Response(JSON.stringify({ error: "Unsupported audio payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mime = match[1].toLowerCase();
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    if (bytes.length < 2048) {
      return new Response(JSON.stringify({ error: "That recording was empty — please try again." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext =
      mime.includes("wav") ? "wav" :
      mime.includes("mpeg") || mime.includes("mp3") ? "mp3" :
      mime.includes("mp4") || mime.includes("m4a") ? "mp4" :
      mime.includes("webm") ? "webm" : "wav";

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: mime }), `recording.${ext}`);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: form,
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("stt error:", resp.status, detail);
      return new Response(
        JSON.stringify({ error: resp.status === 429 ? "Too many requests — try again shortly." : "Couldn't hear that. Try recording again." }),
        { status: resp.status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    return new Response(JSON.stringify({ text: (data?.text ?? "").trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("yaj-transcribe error:", e);
    return new Response(JSON.stringify({ error: "Transcription failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
