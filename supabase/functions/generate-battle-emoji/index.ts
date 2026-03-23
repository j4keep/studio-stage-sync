import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use Gemini image generation to create an animated-style emoji
    const imagePrompt = `Create a large, vibrant, animated-style emoji or effect of: "${prompt}". Make it a single expressive character or effect with dynamic motion lines, energy trails, and action poses. Cartoon/anime style with bold colors and glowing effects. Transparent background, no text, centered composition. The image should look like it's in motion - add speed lines, sparkles, flames, or energy effects as appropriate. Make it dramatic and eye-catching.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: imagePrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many effects! Wait a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Failed to generate effect" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract image from the response - Gemini image models return inline_data
    let imageUrl = "";
    const choice = data.choices?.[0];
    if (choice?.message?.content) {
      // Check if content is an array (multimodal response)
      if (Array.isArray(choice.message.content)) {
        for (const part of choice.message.content) {
          if (part.type === "image_url" && part.image_url?.url) {
            imageUrl = part.image_url.url;
            break;
          }
          if (part.inline_data) {
            imageUrl = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
            break;
          }
        }
      } else if (typeof choice.message.content === "string") {
        // Check if it contains a base64 image or URL
        const urlMatch = choice.message.content.match(/https?:\/\/[^\s"]+\.(png|jpg|jpeg|gif|webp)[^\s"]*/i);
        if (urlMatch) imageUrl = urlMatch[0];
      }
    }

    if (!imageUrl) {
      // Fallback: return a text-based emoji description for the client to render
      return new Response(JSON.stringify({ 
        type: "text",
        emoji: prompt,
        description: choice?.message?.content || prompt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      type: "image",
      imageUrl,
      prompt,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-battle-emoji error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
