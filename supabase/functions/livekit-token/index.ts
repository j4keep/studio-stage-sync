// Mints a LiveKit join token for an authenticated user.
// POST { room: string, identity?: string, name?: string, canPublish?: boolean }
// -> { token, url, identity }

import { AccessToken } from "npm:livekit-server-sdk@2.9.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const url = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const room = String(body?.room ?? "").trim();
    if (!room || room.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(room)) {
      return new Response(JSON.stringify({ error: "Invalid room" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const identity = String(body?.identity ?? user.id).slice(0, 128);
    const displayName = String(
      body?.name ?? user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Guest"
    ).slice(0, 64);
    const canPublish = body?.canPublish !== false;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
      ttl: 60 * 60 * 4, // 4h
    });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();

    return new Response(JSON.stringify({ token, url, identity, name: displayName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
