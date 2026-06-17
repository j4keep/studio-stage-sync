import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// You can set this in Cloud secrets to receive notifications
const ADMIN_EMAIL = Deno.env.get("SUPPORT_ADMIN_EMAIL");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, category, message, user_name, user_email } = await req.json();

    // If no email configuration, just log and return success
    if (!ADMIN_EMAIL || !RESEND_API_KEY) {
      console.log("New support ticket received (email not configured):");
      console.log({ subject, category, user_name, user_email, message });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Ticket logged (email notifications not configured)" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email notification using Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Atchup Support <support@atchup.app>",
        to: ADMIN_EMAIL,
        subject: `[Support Ticket] ${category}: ${subject}`,
        html: `
          <h2>New Support Ticket</h2>
          <p><strong>From:</strong> ${user_name} (${user_email})</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr />
          <h3>Message:</h3>
          <p style="white-space: pre-wrap;">${message}</p>
          <hr />
          <p><a href="https://atchup-daily-rise.lovable.app/m/support-admin">View in Admin Panel</a></p>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Email send failed:", errorText);
      throw new Error("Failed to send email notification");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in support-ticket-notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
