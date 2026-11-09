import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) throw new Error("Server configuration missing");

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const accountId = userData.user.id;

    // Remove stale follow edges and public profile *before* deleting Auth.
    // This prevents a newly registered account with the same email from being
    // shown alongside the deleted identity in follower lists and statistics.
    // Fail closed: don't claim successful deletion if cleanup is blocked.
    const { error: followingErr } = await admin.from("follows").delete().eq("follower_id", accountId);
    if (followingErr) throw new Error("Could not clean up outgoing follows: " + followingErr.message);
    const { error: followerErr } = await admin.from("follows").delete().eq("following_id", accountId);
    if (followerErr) throw new Error("Could not clean up incoming follows: " + followerErr.message);

    const { error: deleteErr } = await admin.auth.admin.deleteUser(accountId);
    if (deleteErr) throw deleteErr;

    // Profiles might be cascaded by the Auth FK; make sure any standalone
    // profile row is removed even if that foreign key doesn't cascade.
    const { error: profileErr } = await admin.from("profiles").delete().eq("user_id", accountId);
    if (profileErr) {
      console.error("[delete-account] Orphan profile cleanup needed:", profileErr.message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Could not delete account" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
