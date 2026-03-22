import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FeedPostCard from "@/components/feed/FeedPostCard";

interface Props {
  userId: string;
  isOwner: boolean;
}

const ProfileFeedSection = ({ userId, isOwner }: Props) => {
  const { user } = useAuth();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["profile-posts", userId],
    queryFn: async () => {
      const { data: postsData } = await (supabase as any)
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!postsData || postsData.length === 0) return [];

      const ids = postsData.map((p: any) => p.id);
      const [{ data: profile }, { data: postLikes }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", userId)
          .single(),
        (supabase as any)
          .from("likes")
          .select("content_id, user_id")
          .eq("content_type", "post")
          .in("content_id", ids),
      ]);

      const likeCounts = new Map<string, number>();
      const likedIds = new Set<string>();

      (postLikes || []).forEach((like: any) => {
        likeCounts.set(like.content_id, (likeCounts.get(like.content_id) || 0) + 1);
        if (user && like.user_id === user.id) {
          likedIds.add(like.content_id);
        }
      });

      return postsData.map((p: any) => ({
        ...p,
        likes_count: likeCounts.get(p.id) || 0,
        isLiked: likedIds.has(p.id),
        profile: {
          display_name: profile?.display_name || "Artist",
          avatar_url: profile?.avatar_url || null,
        },
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm py-8">No posts yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((post: any) => (
        <FeedPostCard key={post.id} post={post} currentUserId={isOwner ? user?.id : undefined} />
      ))}
    </div>
  );
};

export default ProfileFeedSection;
