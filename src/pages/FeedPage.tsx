import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { MessageCircle, Plus } from "lucide-react";
import FeedPostCard from "@/components/feed/FeedPostCard";
import CreatePostSheet from "@/components/feed/CreatePostSheet";

const FeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (!data) return [];

      const postIds = data.map((p: any) => p.id);

      // Get profiles for all post authors
      const userIds = [...new Set(data.map((p: any) => p.user_id))];
      const [{ data: profiles }, { data: postLikes }] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", userIds),
        postIds.length
          ? (supabase as any)
              .from("likes")
              .select("content_id, user_id")
              .eq("content_type", "post")
              .in("content_id", postIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const likeCounts = new Map<string, number>();
      const userLikes = new Set<string>();

      (postLikes || []).forEach((like: any) => {
        likeCounts.set(like.content_id, (likeCounts.get(like.content_id) || 0) + 1);
        if (user && like.user_id === user.id) {
          userLikes.add(like.content_id);
        }
      });

      return data.map((post: any) => ({
        ...post,
        likes_count: likeCounts.get(post.id) || 0,
        profile: profileMap.get(post.user_id) || { display_name: "Artist", avatar_url: null },
        isLiked: userLikes.has(post.id),
      }));
    },
  });

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-display font-bold text-foreground">Feed</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/messages")}
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Create Post Button */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-sm text-muted-foreground">What's on your mind?</span>
        </button>
      </div>

      {/* Posts Feed */}
      <div className="mt-3 space-y-3 px-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">No posts yet. Be the first to share!</p>
          </div>
        ) : (
          posts.map((post: any) => (
            <FeedPostCard key={post.id} post={post} currentUserId={user?.id} />
          ))
        )}
      </div>

      <CreatePostSheet open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
};

export default FeedPage;
