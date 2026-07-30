import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Text-to-speech: returns { audio: "data:audio/mpeg;base64,..." } */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, voice } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Nothing to speak." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Keep the request within a sane length for a spoken reply.
    const spoken = text.replace(/[*_`#>]/g, "").slice(0, 4000);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: spoken,
        voice: typeof voice === "string" && voice ? voice : "alloy",
        response_format: "mp3",
        instructions: "Warm, friendly, natural and conversational — like a supportive creative friend.",
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("tts error:", resp.status, detail);
      const message =
        resp.status === 429
          ? "Voice is busy right now. Try again in a moment."
          : resp.status === 402
            ? "Voice is temporarily unavailable. Please try again later."
            : "Couldn't generate the voice reply.";
      return new Response(JSON.stringify({ error: message }), {
        status: resp.status === 429 || resp.status === 402 ? resp.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await resp.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    return new Response(JSON.stringify({ audio: `data:audio/mpeg;base64,${base64}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("yaj-voice error:", e);
    return new Response(JSON.stringify({ error: "Voice failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
