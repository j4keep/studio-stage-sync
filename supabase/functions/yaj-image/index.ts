import { requireAiUser } from "../_shared/ai-guard.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const guard = await requireAiUser(req, "yaj-image", corsHeaders);
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json().catch(() => null);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
    if (!prompt) return json({ error: "A prompt is required." }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "Image generation is not configured on the server." }, 500);

    const resp = await fetch(IMAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, quality: "low" }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("image gen error:", resp.status, detail);
      let message = "Couldn't generate that image. Try again shortly.";
      if (/moderation|safety/i.test(detail)) {
        message = "That request was blocked by the image safety filter. Try describing it differently.";
      } else if (resp.status === 429) {
        message = "YAJ is getting a lot of requests right now. Try again in a moment.";
      } else if (resp.status === 402) {
        message = "Image generation is out of AI credits right now. Please try again later.";
      } else if (resp.status === 401 || resp.status === 403) {
        message = "Image generation is not authorized on the server.";
      } else if (resp.status === 400) {
        message = "YAJ couldn't use that prompt. Try rewording it.";
      }
      const status = [400, 402, 403, 429].includes(resp.status) ? resp.status : 500;
      return json({ error: message }, status);
    }

    const data = await resp.json();
    const item = data?.data?.[0];
    const image: string | undefined = item?.b64_json
      ? `data:image/png;base64,${item.b64_json}`
      : item?.url;
    if (!image) return json({ error: "No image was returned. Try again." }, 502);
    return json({ image });
  } catch (e) {
    console.error("yaj-image error:", e);
    return json({ error: "Image generation failed. Please try again." }, 500);
  }
});
