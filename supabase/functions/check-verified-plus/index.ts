import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VERIFIED_PLUS_PRODUCT_ID = "prod_Tw94I9oS6LDjV8";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      // No Stripe customer - fall back to DB subscription validity check
      const nowIso = new Date().toISOString();
      const { data: legacySubs } = await supabaseClient
        .from("user_subscriptions")
        .select("end_date")
        .eq("user_id", user.id)
        .eq("plan_type", "verified_plus")
        .eq("status", "active")
        .lte("start_date", nowIso);

      const hasActiveLegacySub = (legacySubs ?? []).some((sub) => {
        if (!sub.end_date) return true;
        return new Date(sub.end_date).getTime() > Date.now();
      });

      if (hasActiveLegacySub) {
        return new Response(JSON.stringify({ subscribed: true, legacy: true, payment_status: "ok" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      await supabaseClient
        .from("user_subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", user.id)
        .eq("plan_type", "verified_plus")
        .eq("status", "active");

      return new Response(JSON.stringify({ subscribed: false, payment_status: "none" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;

    // Check for active subscriptions first
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    // Also check for past_due and unpaid subscriptions
    const pastDueSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "past_due",
      limit: 10,
    });

    const unpaidSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "unpaid",
      limit: 10,
    });

    // Check active subs for Verified+ product
    let hasVerifiedPlus = false;
    let subscriptionEnd = null;

    for (const sub of activeSubscriptions.data) {
      for (const item of sub.items.data) {
        if (item.price.product === VERIFIED_PLUS_PRODUCT_ID) {
          hasVerifiedPlus = true;
          subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
          
          await supabaseClient
            .from("user_subscriptions")
            .upsert({
              user_id: user.id,
              plan_type: "verified_plus",
              status: "active",
              start_date: new Date(sub.current_period_start * 1000).toISOString(),
              end_date: subscriptionEnd,
              auto_renew: !sub.cancel_at_period_end,
              amount: 9.99,
              platform: "stripe",
            }, { onConflict: "user_id" });
          
          break;
        }
      }
      if (hasVerifiedPlus) break;
    }

    if (hasVerifiedPlus) {
      return new Response(JSON.stringify({
        subscribed: true,
        payment_status: "ok",
        subscription_end: subscriptionEnd,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if there's a past_due or unpaid subscription for Verified+
    const problemSubs = [...pastDueSubscriptions.data, ...unpaidSubscriptions.data];
    let hasPausedSubscription = false;

    for (const sub of problemSubs) {
      for (const item of sub.items.data) {
        if (item.price.product === VERIFIED_PLUS_PRODUCT_ID) {
          hasPausedSubscription = true;

          // Mark DB subscription as paused
          await supabaseClient
            .from("user_subscriptions")
            .upsert({
              user_id: user.id,
              plan_type: "verified_plus",
              status: "past_due",
              start_date: new Date(sub.current_period_start * 1000).toISOString(),
              end_date: new Date(sub.current_period_end * 1000).toISOString(),
              auto_renew: !sub.cancel_at_period_end,
              amount: 9.99,
              platform: "stripe",
            }, { onConflict: "user_id" });

          break;
        }
      }
      if (hasPausedSubscription) break;
    }

    if (hasPausedSubscription) {
      return new Response(JSON.stringify({
        subscribed: false,
        payment_status: "past_due",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // No active or past_due subscription - mark as canceled
    await supabaseClient
      .from("user_subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id)
      .eq("status", "active");

    return new Response(JSON.stringify({
      subscribed: false,
      payment_status: "none",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error checking subscription:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
