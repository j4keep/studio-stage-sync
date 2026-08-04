import { supabase } from "@/integrations/supabase/client";

/** Existing clutter video posts — hidden immediately until the DB wipe lands. */
export const LEGACY_FEED_VIDEO_POST_IDS = new Set<string>([
  "9e71e99c-e927-4216-b2b5-b25bd1678c12",
  "20e3df98-e589-43d6-946c-e413a7d0b7c0",
  "c5f27f3c-cbde-4773-9de4-152f7b00da89",
  "0febf6b6-1ab7-45c4-b1f8-4cd109118845",
  "79a92609-4acb-45fb-8cf5-5070c3ae1b88",
  "343769da-ad5a-4d8a-9210-90c032bcc2fc",
  "025a93c0-fb96-41a4-adfc-7a234c209e05",
]);

/** Hide every feed video created at/before this moment (Posts + Reels clutter purge). */
export const FEED_VIDEO_PURGE_BEFORE_MS = Date.parse("2026-08-04T00:30:00.000Z");

const STORAGE_KEY = "yaj:feed-videos-cleared:v1";

/** True when this post should be stripped from homepage Posts/Reels during the purge. */
export function isPurgedFeedVideoPost(post: { id?: string; media_type?: string; created_at?: string } | null): boolean {
  if (!post || post.media_type !== "video") return false;
  if (post.id && LEGACY_FEED_VIDEO_POST_IDS.has(post.id)) return true;
  const created = post.created_at ? Date.parse(post.created_at) : NaN;
  return Number.isFinite(created) && created <= FEED_VIDEO_PURGE_BEFORE_MS;
}

/**
 * Best-effort wipe of feed video posts.
 * Tries service-role edge paths first, then deletes the signed-in user's own
 * video posts via RLS so cleanup still happens without a fresh function deploy.
 * @returns true when any wipe path succeeded.
 */
export async function clearFeedVideosOnce(userId?: string | null): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return false;
  } catch {
    /* ignore */
  }

  try {
    // Prefer dedicated function; fall back to declare-battle-winners action
    // (already deployed) so cleanup still works before a new function ships.
    let data: unknown = null;
    let error: unknown = null;
    ({ data, error } = await supabase.functions.invoke("clear-feed-videos", { body: {} }));
    if (error || data == null || typeof (data as { deleted?: number }).deleted !== "number") {
      ({ data, error } = await supabase.functions.invoke("declare-battle-winners", {
        body: { action: "clear-feed-videos" },
      }));
    }
    if (!error && data != null && typeof (data as { deleted?: number }).deleted === "number") {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      return true;
    }
  } catch {
    /* continue to owner RLS path */
  }

  if (!userId) return false;
  try {
    const { data: mine, error: listError } = await (supabase as any)
      .from("posts")
      .select("id")
      .eq("user_id", userId)
      .eq("media_type", "video");
    if (listError || !mine?.length) return false;
    const ids = mine.map((row: { id: string }) => row.id);
    await (supabase as any)
      .from("likes")
      .delete()
      .eq("content_type", "post")
      .in("content_id", ids);
    const { error: delError } = await (supabase as any)
      .from("posts")
      .delete()
      .eq("user_id", userId)
      .eq("media_type", "video");
    if (delError) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}
