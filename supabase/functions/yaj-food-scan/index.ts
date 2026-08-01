import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM = `You are YAJ Food Scan, a friendly wellness nutrition helper (NOT a doctor or dietitian).
Analyze the attached food photo and return STRICT JSON only — no markdown, no prose outside JSON.

Goals:
1) Identify what food is visible (snack, packaged item, or a full plate).
2) Rate overall wellness quality as "good", "moderate", or "limit".
3) Say whether they should eat it now: "yes", "in_moderation", or "better_choice".
4) Give a ballpark calorie estimate for the portion shown (range + midpoint).
5) List visible items with rough calorie estimates.
6) Keep tone warm, non-shaming, practical.

Rules:
- Ballpark only — never claim lab precision.
- If the image is not food, set is_food=false and explain briefly.
- Prefer everyday language ("chips", "rice and beans", "grilled chicken").
- Consider portion size visible in the photo.
- For mixed plates, estimate the whole plate and break down items.

Return JSON matching EXACTLY:
{
  "is_food": true,
  "title": "short name of the meal/snack",
  "summary": "1-2 sentence plain-language summary",
  "rating": "good" | "moderate" | "limit",
  "rating_label": "Good choice" | "Okay in moderation" | "Limit / occasional",
  "should_eat": "yes" | "in_moderation" | "better_choice",
  "should_eat_label": "short recommendation headline",
  "guidance": "2-3 sentences of practical advice (portion, balance, timing)",
  "calories": {
    "estimate": number,
    "low": number,
    "high": number,
    "confidence": "low" | "medium" | "high"
  },
  "items": [
    { "name": "item", "portion": "e.g. 1 cup / handful", "calories": number }
  ],
  "highlights": ["positive note", "..."],
  "watch_outs": ["optional concern", "..."],
  "better_swaps": ["optional healthier alternative", "..."],
  "disclaimer": "Ballpark estimate only — not medical or dietitian advice."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const images = (body.images || []) as string[];
    const notes = typeof body.notes === "string" ? body.notes : "";

    if (!images.length) {
      return new Response(JSON.stringify({ error: "Add a food photo to scan." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userParts: unknown[] = [
      {
        type: "text",
        text:
          `Analyze this food photo for a wellness check-in.\n` +
          `User notes: ${notes || "(none)"}\n` +
          `Return the food-scan JSON.`,
      },
      ...images.slice(0, 2).map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userParts },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit — try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Food scan failed", details: t }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = { raw };
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("yaj-food-scan error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
