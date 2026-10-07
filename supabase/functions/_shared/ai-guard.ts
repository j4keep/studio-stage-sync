import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Logs one AI usage event. Does NOT require sign-in (anonymous calls allowed).
 * Never blocks the request.
 */
export async function requireAiUser(
  req: Request,
  feature: string,
  _corsHeaders: Record<string, string>,
): Promise<Response | { userId: string | null }> {
  let userId: string | null = null;
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
      const { data } = await userClient.auth.getClaims(auth.slice(7));
      if (data?.claims?.role === "authenticated") userId = (data.claims.sub as string) ?? null;
    }
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (svc && userId) {
      await createClient(url, svc).from("ai_usage_events").insert({ user_id: userId, feature });
    }
  } catch (e) {
    console.error("usage log failed", e);
  }
  return { userId };
}
