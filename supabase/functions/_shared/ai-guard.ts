import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Requires a signed-in user for paid AI features and logs one usage event.
 * Returns a Response (401) to send back when the caller is not signed in.
 */
export async function requireAiUser(
  req: Request,
  feature: string,
  corsHeaders: Record<string, string>,
): Promise<Response | { userId: string }> {
  const deny = (msg: string) =>
    new Response(JSON.stringify({ error: msg }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return deny("Please sign in to use this feature.");
  const token = auth.slice(7);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data, error } = await userClient.auth.getClaims(token);
  const userId = data?.claims?.sub as string | undefined;
  const role = data?.claims?.role as string | undefined;
  if (error || !userId || role !== "authenticated") return deny("Please sign in to use this feature.");

  try {
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (svc) {
      const admin = createClient(url, svc);
      await admin.from("ai_usage_events").insert({ user_id: userId, feature });
    }
  } catch (e) {
    console.error("usage log failed", e);
  }
  return { userId };
}
