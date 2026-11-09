import { supabase } from "@/integrations/supabase/client";

/** Count social relationships only when the other participant still has a profile.
 * This excludes orphan follow rows left by older account deletion flows.
 * The server deletion function also removes edges for future deletions.
 */
export async function countActiveSocialFollows(userId: string): Promise<{ followers: number; following: number }> {
  const [{ data: inbound, error: incomingError }, { data: outbound, error: outgoingError }] = await Promise.all([
    (supabase as any).from("follows").select("follower_id").eq("following_id", userId),
    (supabase as any).from("follows").select("following_id").eq("follower_id", userId),
  ]);
  if (incomingError || outgoingError) throw incomingError || outgoingError;
  const incomingIds: string[] = (inbound || []).map((r: { follower_id: string }) => r.follower_id);
  const outgoingIds: string[] = (outbound || []).map((r: { following_id: string }) => r.following_id);
  const ids = [...new Set([...incomingIds, ...outgoingIds])];
  if (!ids.length) return { followers: 0, following: 0 };
  const existing = new Set<string>();
  // Keep batches small to avoid overly large PostgREST URL query parameters.
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from("profiles")
      .select("user_id")
      .in("user_id", ids.slice(i, i + 100));
    if (error) throw error;
    (data || []).forEach((p) => existing.add(p.user_id));
  }
  return {
    followers: incomingIds.filter((id) => existing.has(id)).length,
    following: outgoingIds.filter((id) => existing.has(id)).length,
  };
}
