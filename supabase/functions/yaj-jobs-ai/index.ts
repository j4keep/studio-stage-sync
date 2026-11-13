import { requireAiUser } from "../_shared/ai-guard.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

type Mode = "gig_assistant" | "resume_builder" | "cover_letter";

const PROMPTS: Record<Mode, string> = {
  gig_assistant: `You are YAJ Buddy, the preliminary job-scope assistant. Analyze the user's WRITTEN work description, any explicitly stated dimensions and prices, and optionally attached images. Text-only requests are fully valid: never require a photo. Images may be selected STILL FRAMES from a short video rather than the entire video. Return STRICT JSON only:
{"title":"short title <=80 chars","description":"clear provisional scope","category":"handyman|delivery|cleaning|moving|tech|design|tutoring|events|pets|general","tools":["..."],"estimated_hours":null,"budget_min":null,"budget_max":null,"urgency":"today|this_week|flexible","tips":"brief safety or inspection note","observations":["visible evidence, not diagnoses"],"materials":[{"name":"material","quantity":null,"unit":"bag|sq ft|ft|each|gallon|other","unit_cost":null,"extended_cost":null}],"measurements_needed":["length, width, depth, unit, etc."],"labor":{"hours_min":null,"hours_max":null,"hourly_rate":null,"subtotal_min":null,"subtotal_max":null},"other_costs":[],"confidence":"low|medium","inspection_required":true,"cost_basis":"not priced; user needs local quotes","assumptions":["..."]}.
Never infer exact dimensions, material quantities, labor prices, ZIP-based prices, or code/structural condition from pixels. Do not invent current supplier prices or claim a photo gives an accurate quote. Parse stated square footage, linear footage, depth, dimensions and units from WRITTEN notes. Calculate only values supported by these measurements, and clearly label any assumptions. If exact prices or labor rates are missing, leave those monetary fields and budget_min/budget_max null; tell the user which local rates are needed. Do not claim a trustworthy dollar estimate from size alone; do not assume the concrete calculator applies to other trades. Ask for missing dimensions/ZIP and suggest an on-site visit when needed. If dimensions, known yield and prices ARE supplied, you can show approximate arithmetic with clear assumptions and a wide range. For concrete cracks / spalling, do not assume a cosmetic patch is structurally adequate; mention settlement, depth, reinforcement and drainage risks when relevant. Do not recommend repair steps that could worsen unsafe electrical, gas, structural or hazardous material conditions. Limit arrays to <= 8 entries.`,
  resume_builder: `You are the YAJ Resume Builder. From the user's notes / raw text, produce a clean, ATS-friendly structured resume. Return STRICT JSON only:
{"summary":"2-3 sentence professional summary","skills":["skill", "..."],"experience":[{"title":"","company":"","location":"","start":"YYYY-MM","end":"YYYY-MM or Present","bullets":["achievement", "..."]}],"education":[{"school":"","degree":"","start":"YYYY","end":"YYYY"}],"certifications":["..."],"links":["..."]}`,
  cover_letter: `You are the YAJ Cover Letter writer. Given a job listing and the applicant's resume/notes, write a compelling, authentic cover letter in the applicant's voice. 180-260 words. Return STRICT JSON only:
{"cover_letter":"the full letter text with paragraph breaks as \\n\\n"}`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const guard = await requireAiUser(req, "yaj-jobs-ai", corsHeaders);
  if (guard instanceof Response) return guard;

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
      userParts.push({ type: "text", text: `Written project description from poster: ${notes || "(none)"}\n\nUse written measurements and any available images. If no image is attached, estimate scope from the written description alone. Return the structured JSON with unknown costs marked null.` });
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
