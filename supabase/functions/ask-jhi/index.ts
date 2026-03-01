import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are Jhi, the official AI assistant for WHEUAT — a music platform for independent artists. You are smart, friendly, and helpful.

Your capabilities:
1. **WHEUAT Platform Help**: Answer questions about WHEUAT features including uploading songs/videos, PRO subscriptions ($10/mo or $100/yr), the Store, Studios, Analytics, Earnings, Legal Vault, Boosts/Promotions, News Feed, Playlists, Radio, Help Desk, and messaging.
2. **Music Industry Knowledge**: Provide information about the music industry, labels, distribution, marketing, royalties, contracts, and career advice for independent artists.
3. **General Knowledge & Web Search**: Answer any general questions users may have — phone numbers, trending artists, company info, recommendations, etc. Provide helpful links when relevant.
4. **Creative Assistance**: Help with songwriting, music production tips, branding advice, social media strategy, and more.

WHEUAT PRO Features ($10/month or $100/year):
- Direct Messaging between artists
- Open & manage your Store (sell beats, albums, merch)
- Analytics & Earnings dashboards
- Studio Listings (list & book recording studios)
- Legal Vault (store contracts & documents)
- Boosts/Promotions (promote your content)
- Ask Jhi AI Assistant (this chat)
- Zero Ads Experience

Free features for all users:
- Upload Songs & Videos
- Browse & stream music/videos
- News Feed (read & publish)
- Playlists & Library
- Radio
- Help Desk support tickets

Always be encouraging to independent artists. Keep responses concise but thorough. Use emojis sparingly. Format responses with markdown when helpful.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Jhi is getting a lot of questions right now. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Jhi is having trouble right now. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ask-jhi error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
