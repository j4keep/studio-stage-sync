import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "A prompt is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt: prompt.trim(),
        quality: "low",
        n: 1,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("image gen error:", resp.status, detail);
      const message =
        resp.status === 429
          ? "YAJ is getting a lot of requests right now. Try again in a moment."
          : resp.status === 402
            ? "Image generation is temporarily unavailable. Please try again later."
            : "Couldn't generate that image. Try rephrasing your idea.";
      return new Response(JSON.stringify({ error: message }), {
        status: resp.status === 429 || resp.status === 402 ? resp.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const item = data?.data?.[0] ?? {};
    const image: string | undefined = item.b64_json
      ? `data:image/png;base64,${item.b64_json}`
      : item.url;

    if (!image) {
      return new Response(JSON.stringify({ error: "No image was returned. Try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ image }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("yaj-image error:", e);
    return new Response(JSON.stringify({ error: "Image generation failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
