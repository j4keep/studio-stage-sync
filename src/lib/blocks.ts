import { supabase } from "@/integrations/supabase/client";

/** Block another user across YAJ: insert block + unfollow both directions. */
export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error("You can't block yourself");

  const { error } = await supabase.from("blocks").insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw error;

  // Unfollow both ways (follows table is the live one)
  await Promise.all([
    supabase.from("follows").delete().eq("follower_id", blockerId).eq("following_id", blockedId),
    supabase.from("follows").delete().eq("follower_id", blockedId).eq("following_id", blockerId),
  ]);
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function isBlockedBetween(userA: string, userB: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("is_blocked", {
    user_a: userA,
    user_b: userB,
  });
  if (error) {
    // Fallback direct query if RPC fails
    const { data: rows } = await supabase
      .from("blocks")
      .select("id")
      .or(
        `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
      )
      .limit(1);
    return Boolean(rows?.length);
  }
  return Boolean(data);
}

export type BlockedProfile = {
  block_id: string;
  blocked_id: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
};

/** All user IDs blocked either direction relative to `userId`. */
export async function listBlockedPeerIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  const ids = new Set<string>();
  for (const row of data || []) {
    ids.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
  }
  return ids;
}

export async function listBlockedUsers(blockerId: string): Promise<BlockedProfile[]> {
  const { data: rows, error } = await supabase
    .from("blocks")
    .select("id, blocked_id, created_at")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!rows?.length) return [];

  const ids = rows.map((r) => r.blocked_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", ids);
  const map = new Map((profiles || []).map((p) => [p.user_id, p]));

  return rows.map((r) => {
    const p = map.get(r.blocked_id);
    return {
      block_id: r.id,
      blocked_id: r.blocked_id,
      created_at: r.created_at,
      display_name: p?.display_name || "User",
      avatar_url: p?.avatar_url || null,
    };
  });
}
