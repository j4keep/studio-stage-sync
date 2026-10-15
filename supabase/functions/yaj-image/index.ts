import { requireAiUser } from "../_shared/ai-guard.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const guard = await requireAiUser(req, "yaj-image", corsHeaders);
  if (guard instanceof Response) return guard;

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

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt.trim() }],
        modalities: ["image", "text"],
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
            : resp.status === 401 || resp.status === 403
              ? "Image generation is not authorized on the server. Check the AI gateway configuration."
              : "Couldn't generate that image. Try again shortly.";
      return new Response(JSON.stringify({ error: message }), {
        status: resp.status === 429 || resp.status === 402 ? resp.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const message = data?.choices?.[0]?.message;
    const imagePart = message?.images?.find((part: { image_url?: { url?: string } }) => part?.image_url?.url);
    const contentImage = Array.isArray(message?.content)
      ? message.content.find((part: { type?: string; image_url?: { url?: string } }) => part?.type === "image_url" && part?.image_url?.url)?.image_url?.url
      : undefined;
    const image: string | undefined = imagePart?.image_url?.url || contentImage;

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
