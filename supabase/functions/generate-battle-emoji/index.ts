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

    const imagePrompt = `Generate a single vivid, high-energy illustration of: "${prompt}". Style: bold neon colors, glowing edges, comic book energy lines radiating outward, dynamic action pose. The object/character should fill the entire frame and look powerful and alive with motion. Use bright saturated colors like orange, cyan, magenta, electric blue. Place it on a PURE WHITE #FFFFFF background with absolutely nothing else. NO text, NO words, NO letters, NO watermarks. Just the single dramatic visual element.`;

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
        modalities: ["image", "text"],
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
    
    // Extract image from the response - new format uses message.images array
    let imageUrl = "";
    const choice = data.choices?.[0];
    
    if (choice?.message?.images && Array.isArray(choice.message.images)) {
      for (const img of choice.message.images) {
        if (img.type === "image_url" && img.image_url?.url) {
          imageUrl = img.image_url.url;
          break;
        }
      }
    }
    
    // Fallback: check content array format
    if (!imageUrl && Array.isArray(choice?.message?.content)) {
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
    }

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data).substring(0, 500));
      return new Response(JSON.stringify({ 
        type: "text",
        emoji: "🔥",
        description: prompt,
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
