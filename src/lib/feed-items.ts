import { supabase } from "@/integrations/supabase/client";
import { parsePostCaption } from "@/lib/post-editor";
import { listBlockedPeerIds } from "@/lib/blocks";

/** Classify a post row into the "reel" (short/fast) column or "post" (long) column. */
export function isReelItem(item: any): boolean {
  if (!item) return false;
  if (item.itemType && item.itemType !== "post") return false;
  const meta = parsePostCaption(item.caption).meta;
  if (meta?.isReel === true) return true;
  if (meta?.isReel === false) return false;
  // Backwards-compat fallback: images → Reels, videos → Posts.
  return item.media_type === "image";
}

export type FeedItem =
  | {
      itemType: "post";
      id: string;
      user_id: string;
      caption: string | null;
      media_url: string | null;
      media_type: string;
      likes_count: number;
      comments_count: number;
      created_at: string;
      updated_at: string;
      profile: {
        display_name: string;
        avatar_url: string | null;
      };
      isLiked: boolean;
    }
  | ({ itemType: "battle" } & Record<string, any>);

interface FetchFeedItemsOptions {
  currentUserId?: string;
  userId?: string;
}

export const fetchFeedItems = async ({ currentUserId, userId }: FetchFeedItemsOptions): Promise<FeedItem[]> => {
  const { data: postsData } = userId
    ? await (supabase as any).from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false })
    : await (supabase as any).from("posts").select("*").order("created_at", { ascending: false }).limit(50);

  const posts = postsData || [];
  const blockedIds =
    currentUserId && !userId ? await listBlockedPeerIds(currentUserId) : new Set<string>();

  const visiblePosts = (blockedIds.size
    ? posts.filter((post: any) => !blockedIds.has(post.user_id))
    : posts
  );

  if (visiblePosts.length === 0) return [];

  const postIds = visiblePosts.map((post: any) => post.id);
  const userIds = [...new Set(visiblePosts.map((post: any) => post.user_id))];

  const [{ data: profiles }, { data: postLikes }] = await Promise.all([
    (supabase as any).from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds),
    (supabase as any)
      .from("likes")
      .select("content_id, user_id")
      .eq("content_type", "post")
      .in("content_id", postIds),
  ]);

  const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
  const likeCounts = new Map<string, number>();
  const likedIds = new Set<string>();

  (postLikes || []).forEach((like: any) => {
    likeCounts.set(like.content_id, (likeCounts.get(like.content_id) || 0) + 1);
    if (currentUserId && like.user_id === currentUserId) likedIds.add(like.content_id);
  });

  return visiblePosts
    .map((post: any) => ({
      ...post,
      itemType: "post" as const,
      likes_count: likeCounts.get(post.id) || 0,
      profile: profileMap.get(post.user_id) || { display_name: "Artist", avatar_url: null },
      isLiked: likedIds.has(post.id),
    }))
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};
