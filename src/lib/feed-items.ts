import { supabase } from "@/integrations/supabase/client";

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
  const [postsResult, battlesResult] = await Promise.all([
    userId
      ? (supabase as any).from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false })
      : (supabase as any).from("posts").select("*").order("created_at", { ascending: false }).limit(50),
    userId
      ? (supabase as any).from("battles").select("*").eq("challenger_id", userId).order("created_at", { ascending: false })
      : (supabase as any).from("battles").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  const posts = postsResult.data || [];
  const battles = battlesResult.data || [];

  let mappedPosts: FeedItem[] = [];
  let mappedBattles: FeedItem[] = [];

  if (posts.length > 0) {
    const postIds = posts.map((post: any) => post.id);
    const userIds = [...new Set(posts.map((post: any) => post.user_id))];

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

    mappedPosts = posts.map((post: any) => ({
      ...post,
      itemType: "post",
      likes_count: likeCounts.get(post.id) || 0,
      profile: profileMap.get(post.user_id) || { display_name: "Artist", avatar_url: null },
      isLiked: likedIds.has(post.id),
    }));
  }

  if (battles.length > 0) {
    const battleIds = battles.map((battle: any) => battle.id);
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

    mappedBattles = battles.map((battle: any) => ({
      ...battle,
      itemType: "battle",
      likes_count: battleLikeCounts.get(battle.id) ?? battle.likes_count ?? 0,
      isLiked: battleLikedIds.has(battle.id),
    }));
  }

  return [...mappedPosts, ...mappedBattles].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};