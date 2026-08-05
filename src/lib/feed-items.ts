import { supabase } from "@/integrations/supabase/client";
import { parsePostCaption } from "@/lib/post-editor";
import { listBlockedPeerIds } from "@/lib/blocks";
import { isBattleOnFeed } from "@/lib/battle-ui";
import { isBattleArchivedForUser } from "@/lib/battle-contract";
import { isPurgedFeedVideoPost } from "@/lib/clear-feed-videos";

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
  const [postsResult, challengerBattlesResult, opponentBattlesResult] = await Promise.all([
    userId
      ? (supabase as any).from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false })
      : (supabase as any).from("posts").select("*").order("created_at", { ascending: false }).limit(50),
    userId
      ? (supabase as any).from("battles").select("*").eq("challenger_id", userId).order("created_at", { ascending: false })
      : (supabase as any).from("battles").select("*").order("created_at", { ascending: false }).limit(50),
    userId
      ? (supabase as any).from("battles").select("*").eq("opponent_id", userId).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const posts = postsResult.data || [];
  const battlesById = new Map<string, any>();
  for (const b of [...(challengerBattlesResult.data || []), ...(opponentBattlesResult.data || [])]) {
    battlesById.set(b.id, b);
  }
  const battles = [...battlesById.values()];

  const blockedIds =
    currentUserId && !userId ? await listBlockedPeerIds(currentUserId) : new Set<string>();

  const visiblePosts = (blockedIds.size
    ? posts.filter((p: any) => !blockedIds.has(p.user_id))
    : posts
  ).filter((p: any) => !isPurgedFeedVideoPost(p));
  // Homepage feed: launched battles only. Profile hides cancelled + that user's archives.
  const battlePool = userId
    ? battles.filter((b: any) => {
        if ((b.status || "").toLowerCase() === "cancelled") return false;
        // Owner viewing own profile: still show archived so they can unarchive.
        // Visitors: hide battles the profile owner archived.
        if (currentUserId === userId) return true;
        return !isBattleArchivedForUser(b, userId);
      })
    : battles.filter((b: any) => isBattleOnFeed(b));

  const visibleBattles = blockedIds.size
    ? battlePool.filter(
        (b: any) => !blockedIds.has(b.challenger_id) && !blockedIds.has(b.opponent_id),
      )
    : battlePool;

  let mappedPosts: FeedItem[] = [];
  let mappedBattles: FeedItem[] = [];

  if (visiblePosts.length > 0) {
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
      if (currentUserId && like.user_id === currentUserId) {
        likedIds.add(like.content_id);
      }
    });

    mappedPosts = visiblePosts.map((post: any) => ({
      ...post,
      itemType: "post",
      likes_count: likeCounts.get(post.id) || 0,
      profile: profileMap.get(post.user_id) || { display_name: "Artist", avatar_url: null },
      isLiked: likedIds.has(post.id),
    }));
  }

  if (visibleBattles.length > 0) {
    const battleIds = visibleBattles.map((battle: any) => battle.id);
    const { data: battleLikes } = await (supabase as any)
      .from("likes")
      .select("content_id, user_id")
      .eq("content_type", "battle")
      .in("content_id", battleIds);

    const battleLikeCounts = new Map<string, number>();
    const battleLikedIds = new Set<string>();

    (battleLikes || []).forEach((like: any) => {
      battleLikeCounts.set(like.content_id, (battleLikeCounts.get(like.content_id) || 0) + 1);
      if (currentUserId && like.user_id === currentUserId) {
        battleLikedIds.add(like.content_id);
      }
    });

    mappedBattles = visibleBattles.map((battle: any) => ({
      ...battle,
      itemType: "battle",
      likes_count: battleLikeCounts.get(battle.id) ?? battle.likes_count ?? 0,
      isLiked: battleLikedIds.has(battle.id),
    }));
  }

  // Newly accepted battles float up via updated_at; posts keep created_at.
  const feedTime = (item: any) => {
    if (item.itemType === "battle") {
      return new Date(item.updated_at || item.created_at).getTime();
    }
    return new Date(item.created_at).getTime();
  };

  return [...mappedPosts, ...mappedBattles].sort((a, b) => feedTime(b) - feedTime(a));
};