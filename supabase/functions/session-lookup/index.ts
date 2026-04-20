import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsErr || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // --- Parse session_code from query string ---
  const url = new URL(req.url);
  const sessionCode = url.searchParams.get("code")?.trim().toUpperCase();
  if (!sessionCode || sessionCode.length < 4 || sessionCode.length > 12) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid ?code= parameter" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // --- Fetch session ---
  const { data: session, error: sessErr } = await supabase
    .from("live_sessions")
    .select("id, session_code, booking_id, status, created_by, started_at, ended_at, created_at")
    .eq("session_code", sessionCode)
    .maybeSingle();

  if (sessErr) {
    return new Response(
      JSON.stringify({ error: "DB error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Session not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // --- Fetch participants ---
  const { data: participants } = await supabase
    .from("live_session_participants")
    .select("id, user_id, role, display_name, is_live, mic_muted, joined_at, left_at, client_instance_id")
    .eq("live_session_id", session.id);

  return new Response(
    JSON.stringify({ session, participants: participants ?? [] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
