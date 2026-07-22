import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

type Mode = "gig_assistant" | "resume_builder" | "cover_letter";

const PROMPTS: Record<Mode, string> = {
  gig_assistant: `You are the YAJ Gig Assistant. Given photos of a task/situation and optional notes, produce a compelling gig listing. Be concrete and helpful. Return STRICT JSON only, no prose, matching:
{"title": "short catchy title (<= 80 chars)","description":"2-4 sentence clear description of the work needed","category":"one of: handyman, delivery, cleaning, moving, tech, design, tutoring, events, pets, general","tools":["tool or supply needed", "..."],"estimated_hours": number,"budget_min": number,"budget_max": number,"urgency":"today|this_week|flexible","tips":"one sentence tip for the poster"}`,
  resume_builder: `You are the YAJ Resume Builder. From the user's notes / raw text, produce a clean, ATS-friendly structured resume. Return STRICT JSON only:
{"summary":"2-3 sentence professional summary","skills":["skill", "..."],"experience":[{"title":"","company":"","location":"","start":"YYYY-MM","end":"YYYY-MM or Present","bullets":["achievement", "..."]}],"education":[{"school":"","degree":"","start":"YYYY","end":"YYYY"}],"certifications":["..."],"links":["..."]}`,
  cover_letter: `You are the YAJ Cover Letter writer. Given a job listing and the applicant's resume/notes, write a compelling, authentic cover letter in the applicant's voice. 180-260 words. Return STRICT JSON only:
{"cover_letter":"the full letter text with paragraph breaks as \\n\\n"}`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const mode = body.mode as Mode;
    if (!PROMPTS[mode]) {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user content
    const userParts: any[] = [];
    if (mode === "gig_assistant") {
      const { notes, images } = body as { notes?: string; images?: string[] };
      userParts.push({ type: "text", text: `Notes from poster: ${notes || "(none)"}\n\nAnalyze the attached photo(s) and generate the gig JSON.` });
      for (const url of images || []) {
        userParts.push({ type: "image_url", image_url: { url } });
      }
    } else if (mode === "resume_builder") {
      const { raw, existing } = body as { raw: string; existing?: any };
      userParts.push({ type: "text", text: `Raw input:\n${raw}\n\nExisting structured resume (if any):\n${JSON.stringify(existing || {})}\n\nProduce the structured resume JSON.` });
    } else {
      const { job, resume, notes } = body as { job: any; resume?: any; notes?: string };
      userParts.push({ type: "text", text: `Job listing:\n${JSON.stringify(job)}\n\nApplicant resume:\n${JSON.stringify(resume || {})}\n\nExtra notes:\n${notes || "(none)"}\n\nWrite the cover letter JSON.` });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: PROMPTS[mode] },
          { role: "user", content: userParts },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit — try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI request failed", details: t }), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = { raw }; }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("yaj-jobs-ai error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
