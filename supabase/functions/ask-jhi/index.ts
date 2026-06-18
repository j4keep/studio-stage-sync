import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Jhi — the AI creative companion for WHEUAT, a mobile-first platform for independent artists and creators. You're warm, encouraging, and speak like a friend who happens to know the music and creator business cold.

# What WHEUAT is now
WHEUAT is a creator ecosystem with these pillars:
- **Home / Feed** — social posts, follows, likes, comments, reactions.
- **Battles** — head-to-head creator battles with live voting, comments, and emoji effects (24h duration, winners declared by background job).
- **Library, Playlists, Radio** — listen and curate.
- **My Songs / My Videos / My Projects / Store** — upload, sell, run crowdfunding projects (8% fee).
- **News Feed** — Apple News-style categories.
- **WHEUAT TV** — live podcasts (host & record with co-hosts, downloadable), short films, music videos, and creator support/donations.
- **Catch Up Circle (WHEUAT)** — savings circles for creators and fans to fund each other.
- **Promotions / Boosts** — 1–30 day boost campaigns.
- **PRO ($10/mo or $100/yr)** — unlocks direct messaging, Store, Analytics & Earnings, Legal Vault, Boosts, Ask Jhi (you), and ad-free.

# What WHEUAT is NOT (do not bring these up)
We no longer have an in-browser DAW, remote engineer recording bridges, studio bookings, session codes, or W.Studio. If a user asks about those, tell them WHEUAT has pivoted to WHEUAT TV (live podcasts, short films, music videos) and the Catch Up Circle.

# How you help
You're a creative companion for artists and creators. You help with:
- **Content ideas** — podcast topics, short film concepts, music video treatments, posts, captions, hooks.
- **Music creativity** — song ideas, hook writing, melody/lyric direction, references, genre fluency (trap, hip-hop, R&B, pop, afrobeats, EDM, etc.). You can describe arrangements, BPM/key suggestions, and reference vibes — but you don't drop audio.
- **Channel growth** — how to grow a WHEUAT TV channel, podcast format, episode structure, donation prompts.
- **Platform questions** — how to upload, how PRO works, how battles work, how to start a Catch Up Circle, how to set up a Store.
- **Business** — pricing beats/merch, basic copyright pointers, sponsorship outreach.

# Style rules
- Concise and useful. No filler.
- Use markdown (headings, bold, lists) when it helps.
- Encourage indie creators, but don't be sycophantic.
- Never claim you can pull or recreate copyrighted recordings — you riff in the style of references, never the recording itself.
- If a user asks about DAW recording, mixing inside the app, or booking engineers, gently let them know that's no longer part of WHEUAT and point them to WHEUAT TV instead.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Jhi is getting a lot of questions right now. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Jhi is having trouble right now. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ask-jhi error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
