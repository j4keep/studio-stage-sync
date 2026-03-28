import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, mode, instrumental, mood, genre, gender, recording, voiceId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build a rich prompt for the AI to generate song metadata
    let systemPrompt = `You are a professional music producer AI. Based on the user's description, generate a complete song concept including title, lyrics, and production notes.`;

    let userPrompt = prompt || "Create a song";
    if (mode === "lyrics") {
      userPrompt = `The user provided lyrics:\n${prompt}\n\nGenerate a song title, genre suggestion, and production notes for these lyrics.`;
    } else if (mode === "cover") {
      userPrompt = `Generate an AI cover concept for: ${prompt}. Voice ID: ${voiceId}. Provide the cover title, style notes, and production approach.`;
    } else {
      userPrompt = `Song description: ${prompt}`;
    }

    if (mood) userPrompt += `\nMood: ${mood}`;
    if (genre) userPrompt += `\nGenre: ${genre}`;
    if (gender) userPrompt += `\nVocal gender: ${gender}`;
    if (recording) userPrompt += `\nRecording style: ${recording}`;
    if (instrumental) userPrompt += `\nThis should be an instrumental track (no vocals).`;

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
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_song",
            description: "Create a song with the generated metadata",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Song title" },
                lyrics: { type: "string", description: "Complete lyrics" },
                genre: { type: "string", description: "Music genre" },
                mood: { type: "string", description: "Song mood/vibe" },
                production_notes: { type: "string", description: "Production and arrangement notes" },
                bpm: { type: "number", description: "Beats per minute" },
                key: { type: "string", description: "Musical key" },
              },
              required: ["title", "lyrics", "genre", "mood"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_song" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let songData = { title: "Untitled", lyrics: "", genre: "Pop", mood: "Chill" };

    if (toolCall?.function?.arguments) {
      try {
        songData = JSON.parse(toolCall.function.arguments);
      } catch { /* use defaults */ }
    }

    return new Response(JSON.stringify({
      success: true,
      title: songData.title,
      lyrics: songData.lyrics,
      genre: songData.genre,
      mood: songData.mood,
      production_notes: songData.production_notes,
      bpm: songData.bpm,
      key: songData.key,
      message: `Generated "${songData.title}" — a ${songData.genre} track with a ${songData.mood} vibe.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-music error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
