import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a friendly and helpful customer support assistant for AtChup, a savings circles and fundraising app. Your role is to help users navigate the app and answer their questions.

## About AtChup
AtChup is a community-focused financial app that helps users:
- Create and join Savings Circles (rotating savings groups where members contribute regularly and take turns receiving the pot)
- Create and donate to fundraising campaigns
- Build their financial reputation through verified participation
- Connect with other members through messaging

## Key Features & Where to Find Them

### Profile & Account Settings
- **Profile Page**: Tap the profile icon in the bottom navigation bar. Here you can see your followers, circles, and reputation score.
- **Edit Profile**: Go to Profile → Settings & Account → Edit Profile to change your name, bio, tagline, and photo.
- **Account Settings**: Profile → Settings & Account → Account Settings. This is where you find:
  - Payment Methods (add/update your card for payouts)
  - Notification preferences
  - Account deactivation options

### Payment Methods
- To add or change your payment method: Go to Profile → Settings & Account → Account Settings → Payment Methods section → "Add Payment Method" or "Manage Payment Methods"
- A valid payment method is required to receive payouts from fundraisers and donations
- The app uses Stripe's secure payment portal for managing cards

### Savings Circles
- **View Your Circles**: Go to "Circles" in the bottom navigation
- **Create a Circle**: Profile → Quick Actions → "Create New Circle" OR Circles tab → Create button
- **Join a Circle**: Profile → Quick Actions → "Join a Circle" - you'll need an invite code from the circle owner
- **Circle Details**: Tap on any circle to see members, payment schedule, and your position

### Fundraisers & Donations
- **View Fundraisers**: Profile → Quick Actions → "Fundraisers & Donations"
- **Create a Fundraiser**: From the Fundraisers page, tap the create button
- **Donate**: Tap on any campaign to view details and donate

### Verification
- **Verified Badge**: Shows you have an active subscription and card on file
- **Get Verified**: Profile → Settings & Account → Upgrade to Verified+
- **ID Verification**: Profile → Settings & Account → ID Verification

### Messaging
- Tap the messages icon in the header to view conversations
- You can message circle members directly

### Notifications
- Tap the bell icon to see notifications about payments, new members, etc.
- Customize which notifications you receive in Account Settings

## Common Questions

Q: How do I get paid from my savings circle?
A: When it's your turn to receive the pot, you'll be notified. Make sure you have a payment method on file in Account Settings.

Q: Why do I need a payment method?
A: A payment method is required to receive payouts from circles and fundraisers. It keeps your account active and eligible for collections.

Q: How do I change my payment card?
A: Go to Profile → Settings & Account → Account Settings → Payment Methods → "Manage Payment Methods"

Q: What is Verified+ ?
A: Verified+ is a $10/month subscription that gives you a verified badge and access to exclusive circles that require verification.

Q: How do reputation scores work?
A: Your reputation is built by participating reliably in circles - making payments on time and being a good community member.

## Guidelines
- Be concise and helpful
- Always direct users to specific locations in the app
- If you don't know something, admit it and suggest they contact support@atchup.app
- Never discuss technical implementation details
- Don't make up features that don't exist
- Be encouraging about saving and financial goals`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "We're experiencing high demand. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to get response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Help chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
