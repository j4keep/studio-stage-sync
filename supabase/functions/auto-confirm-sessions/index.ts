import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find bookings where engineer marked complete 48+ hours ago
    // and artist hasn't responded yet
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: staleBookings, error: fetchError } = await supabase
      .from("studio_bookings")
      .select("id, user_id, studio_id, total_amount, session_code")
      .eq("session_status", "awaiting_confirmation")
      .is("artist_confirmed", null)
      .lt("engineer_completed_at", cutoff);

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let autoConfirmed = 0;

    for (const booking of staleBookings || []) {
      const { error: updateError } = await supabase
        .from("studio_bookings")
        .update({
          artist_confirmed: true,
          artist_responded_at: new Date().toISOString(),
          session_status: "completed",
          payout_status: "released",
        })
        .eq("id", booking.id);

      if (!updateError) {
        autoConfirmed++;

        // Notify artist that it was auto-confirmed
        await supabase.from("notifications").insert({
          user_id: booking.user_id,
          type: "booking",
          title: "⏰ Session Auto-Confirmed",
          body: `Your session (code: ${booking.session_code || "N/A"}) was auto-confirmed after 48 hours. Payment has been released to the engineer.`,
          reference_id: booking.id,
          reference_type: "booking",
        });
      }
    }

    return new Response(
      JSON.stringify({ auto_confirmed: autoConfirmed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
