import { useState } from "react";
import { Heart, MessageCircle, Share2, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import PostCommentsSheet from "./PostCommentsSheet";

interface Props {
  post: any;
  currentUserId?: string;
}

const FeedPostCard = ({ post, currentUserId }: Props) => {
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Not authenticated");
      if (liked) {
        await (supabase as any).from("likes").delete()
          .eq("user_id", currentUserId)
          .eq("content_id", post.id)
          .eq("content_type", "post");
      } else {
        await (supabase as any).from("likes").insert({
          user_id: currentUserId,
          content_id: post.id,
          content_type: "post",
        });
      }
    },
    onMutate: () => {
      setLiked(!liked);
      setLikesCount((c: number) => liked ? c - 1 : c + 1);
    },
    onError: () => {
      setLiked(liked);
      setLikesCount(post.likes_count);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Post deleted");
    },
  });

  const handleShare = async () => {
    try {
      await navigator.share?.({ title: post.caption || "Check this out!", url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <>
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        {/* Author Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden flex-shrink-0">
            {post.profile.avatar_url ? (
              <img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                {(post.profile.display_name || "A")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{post.profile.display_name || "Artist"}</p>
            <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
          </div>
          {currentUserId === post.user_id && (
            <button onClick={() => deleteMutation.mutate()} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="px-3 pb-2 text-sm text-foreground">{post.caption}</p>
        )}

        {/* Media */}
        {post.media_url && (
          post.media_type === "video" ? (
            <video src={post.media_url} controls className="w-full max-h-[400px] object-cover bg-black" />
          ) : (
            <img src={post.media_url} alt="" className="w-full max-h-[400px] object-cover" />
          )
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 px-3 py-2.5 border-t border-border">
          <button onClick={() => likeMutation.mutate()} className="flex items-center gap-1">
            <Heart className={`w-5 h-5 ${liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">{likesCount}</span>
          </button>
          <button onClick={() => setShowComments(true)} className="flex items-center gap-1">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{post.comments_count}</span>
          </button>
          <button onClick={handleShare} className="flex items-center gap-1 ml-auto">
            <Share2 className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <PostCommentsSheet postId={post.id} open={showComments} onClose={() => setShowComments(false)} />
    </>
  );
};

export default FeedPostCard;
