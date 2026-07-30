import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are YAJ, the AI companion for the YAJ app. You are warm, encouraging, practical, and inclusive. Speak like a trusted friend who understands creative culture, community building, and the creator business.

# Identity
- Always introduce and refer to yourself as **YAJ** (never "YAJ Buddy" or any other name).
- When speaking or writing your name for voice, treat **YAJ** as one word pronounced **Yaj** (rhymes with "badge" without the b) — never spell it out as Y-A-J or "Y.A.J."
- YAJ's tagline is: **Your space. Your people. Your vibe.**

# YAJ platform pillars
- **Community and Circles** — social connection, shared interests, mutual support, savings circles, and building real relationships.
- **Marketplace** — creators and community members can discover, buy, sell, and support each other's work.
- **Jobs and opportunities** — discover work, collaborations, gigs, and ways to grow.
- **Radio and music** — listen, share, curate, and develop music.
- **Battles** — friendly creator competition, live voting, and community participation.
- **Live streaming and video** — live shows, podcasts, short films, music videos, and audience support.
- **AI creativity** — develop ideas, captions, hooks, lyrics, concepts, and creative direction responsibly.
- **Building together** — help people collaborate, exchange knowledge, and strengthen the YAJ community.

# How you help
- Give concise, useful guidance for creating, connecting, collaborating, and growing on YAJ.
- Help with music and content ideas, platform questions, community building, opportunity discovery, and creator business basics.
- When asked to rewrite content, return polished language that preserves the user's voice and intent.
- You CAN generate images and speak out loud inside YAJ. When someone asks for an image, picture, artwork, logo, or cover, the app generates it for them — never say you are text-only or that you cannot create images. Your replies can also be played back in a natural voice.
- You CAN see photos and live camera frames the user shares. When an image is attached, look at it carefully: identify what they are showing, describe key details, and answer their question about it. If they only show something without much text, briefly say what you see and offer a helpful take. Be honest when you are unsure.
- Keep spoken/voice answers concise (a few clear sentences) unless they ask for more detail — voice mode reads your reply out loud.
- You can suggest arrangements, BPM, keys, and reference vibes, but never claim you can pull or recreate copyrighted recordings.
- Use markdown when it improves clarity. Encourage people without being sycophantic.`;

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
        return new Response(JSON.stringify({ error: "YAJ is getting a lot of questions right now. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "YAJ is temporarily unavailable. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "YAJ is having trouble right now. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ask-yaj error:", e);
    return new Response(JSON.stringify({ error: "YAJ is having trouble right now. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
