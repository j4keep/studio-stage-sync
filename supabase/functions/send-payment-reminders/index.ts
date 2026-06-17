import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get tomorrow's date (for finding periods due in 1 day)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
    const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));

    console.log("Checking for periods due between:", tomorrowStart.toISOString(), "and", tomorrowEnd.toISOString());

    // Find all periods that are due tomorrow and are upcoming (not completed)
    const { data: upcomingPeriods, error: periodsError } = await supabase
      .from("savings_circle_periods")
      .select(`
        id,
        circle_id,
        period_number,
        due_date,
        status
      `)
      .gte("due_date", tomorrowStart.toISOString())
      .lte("due_date", tomorrowEnd.toISOString())
      .eq("status", "upcoming");

    if (periodsError) {
      console.error("Error fetching periods:", periodsError);
      throw periodsError;
    }

    console.log("Found", upcomingPeriods?.length || 0, "periods due tomorrow");

    if (!upcomingPeriods || upcomingPeriods.length === 0) {
      return new Response(
        JSON.stringify({ message: "No periods due tomorrow", notificationsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let notificationsSent = 0;

    for (const period of upcomingPeriods) {
      // Get the circle details
      const { data: circle, error: circleError } = await supabase
        .from("savings_circles")
        .select("id, name, amount_per_period, frequency, status, current_period")
        .eq("id", period.circle_id)
        .single();

      if (circleError || !circle) {
        console.error("Error fetching circle:", circleError);
        continue;
      }

      // Only send reminders for active circles and current period
      if (circle.status !== "active" || circle.current_period !== period.period_number) {
        console.log("Skipping period", period.period_number, "- circle status:", circle.status, "current_period:", circle.current_period);
        continue;
      }

      // Get all members of this circle
      const { data: members, error: membersError } = await supabase
        .from("savings_circle_members")
        .select("id, user_id, display_name, position")
        .eq("circle_id", period.circle_id);

      if (membersError || !members) {
        console.error("Error fetching members:", membersError);
        continue;
      }

      // Find who receives the payout this period
      const payoutRecipient = members.find(m => m.position === period.period_number);

      // Format the due date nicely
      const dueDate = new Date(period.due_date);
      const formattedDate = dueDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric"
      });

      // Send notification to each member
      for (const member of members) {
        const isRecipient = member.position === period.period_number;
        
        let title: string;
        let message: string;

        if (isRecipient) {
          // This member receives the payout
          title = "🎉 Your Payout is Tomorrow!";
          message = `Tomorrow is your day! You'll receive $${circle.amount_per_period * members.length} from "${circle.name}" on ${formattedDate}.`;
        } else {
          // This member needs to pay
          title = "💰 Payment Reminder";
          message = `Your payment of $${circle.amount_per_period} for "${circle.name}" is due ${formattedDate}. ${payoutRecipient?.display_name || "A member"} receives the payout.`;
        }

        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: member.user_id,
            title,
            message,
            type: "payment_reminder",
            link: `/m/savings-circles/${circle.id}`,
            read: false
          });

        if (notifError) {
          console.error("Error creating notification for user", member.user_id, ":", notifError);
        } else {
          notificationsSent++;
          console.log("Sent reminder to", member.display_name, "for circle", circle.name);
        }
      }
    }

    console.log("Total notifications sent:", notificationsSent);

    return new Response(
      JSON.stringify({ 
        message: "Payment reminders sent successfully", 
        notificationsSent,
        periodsProcessed: upcomingPeriods.length 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
