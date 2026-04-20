import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const rawCode = url.searchParams.get("code")?.trim();
    if (!rawCode) {
      return new Response(JSON.stringify({ error: "Missing code query parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = rawCode.toUpperCase();
    if (code.length < 4 || code.length > 12) {
      return new Response(JSON.stringify({ error: "Invalid session code length" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: bookingErr } = await supabase
      .from("studio_bookings")
      .select("id, session_code, studio_id, user_id")
      .eq("session_code", code)
      .maybeSingle();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: studio } = await supabase
      .from("studios")
      .select("user_id")
      .eq("id", booking.studio_id)
      .maybeSingle();

    const engineerId = studio?.user_id;
    const isArtist = booking.user_id === user.id;
    const isEngineer = engineerId === user.id;
    if (!isArtist && !isEngineer) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sessionId: string | null = null;

    const { data: existing } = await supabase
      .from("live_sessions")
      .select("id")
      .eq("session_code", code)
      .maybeSingle();

    if (existing?.id) {
      sessionId = existing.id;
    } else {
      const ins = await supabase
        .from("live_sessions")
        .insert({
          session_code: code,
          booking_id: booking.id,
          status: "active",
          created_by: user.id,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (ins.error) {
        if (ins.error.code === "23505") {
          const { data: again } = await supabase
            .from("live_sessions")
            .select("id")
            .eq("session_code", code)
            .single();
          sessionId = again?.id ?? null;
        } else {
          console.error(ins.error);
          return new Response(JSON.stringify({ error: ins.error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        sessionId = ins.data?.id ?? null;
      }
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Could not create session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sessionRow, error: sessErr } = await supabase
      .from("live_sessions")
      .select("id, session_code, booking_id, status, created_by, started_at, ended_at, created_at")
      .eq("id", sessionId)
      .single();

    if (sessErr || !sessionRow) {
      return new Response(JSON.stringify({ error: "Session load failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: participants, error: partErr } = await supabase
      .from("live_session_participants")
      .select(
        "id, user_id, role, display_name, is_live, mic_muted, joined_at, left_at, client_instance_id",
      )
      .eq("live_session_id", sessionId)
      .order("joined_at", { ascending: true });

    if (partErr) {
      return new Response(JSON.stringify({ error: partErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        session: {
          id: sessionRow.id,
          session_code: sessionRow.session_code,
          booking_id: sessionRow.booking_id,
          status: sessionRow.status,
          created_by: sessionRow.created_by,
          started_at: sessionRow.started_at,
          ended_at: sessionRow.ended_at,
          created_at: sessionRow.created_at,
        },
        participants: participants ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
