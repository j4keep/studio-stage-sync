const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI is not configured" }, 500);

    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt?.trim()) return json({ error: "Prompt required" }, 400);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-1-mini",
        prompt: `Professional virtual background for a live video podcast. No people, no text, no logos. Clean depth, realistic lighting, suitable behind a speaker: ${prompt}`,
        size: "1024x1024",
        quality: "low",
        n: 1,
        stream: false,
      }),
    });

    if (!response.ok) return json({ error: `Image generation failed: ${response.status} ${await response.text().catch(() => "")}` }, 200);
    const body = await response.json();
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) return json({ error: "No background was generated" }, 200);

    return json({ imageUrl: `data:image/png;base64,${b64}` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}