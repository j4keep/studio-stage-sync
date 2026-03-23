import { useEffect, useState, useRef } from "react";
import { Edit3, Eye, Heart, MessageCircle, Share2, Trash2 } from "lucide-react";
import { incrementPostViews } from "@/hooks/use-likes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import PostCommentsSheet from "./PostCommentsSheet";
import CreatePostSheet from "./CreatePostSheet";

interface Props {
  post: any;
  currentUserId?: string;
}

const FeedPostCard = ({ post, currentUserId }: Props) => {
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setLiked(!!post.isLiked);
    setLikesCount(post.likes_count || 0);
  }, [post.id, post.isLiked, post.likes_count]);

  // Count a view when the post card mounts (user scrolls to it)
  useEffect(() => {
    if (!viewCounted) {
      setViewCounted(true);
      incrementPostViews(post.id);
    }
  }, [post.id, viewCounted]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Not authenticated");
      const { data: existingLike, error: existingLikeError } = await (supabase as any)
        .from("likes").select("id").eq("user_id", currentUserId).eq("content_id", post.id).eq("content_type", "post").maybeSingle();
      if (existingLikeError) throw existingLikeError;
      if (existingLike) {
        const { error } = await (supabase as any).from("likes").delete().eq("user_id", currentUserId).eq("content_id", post.id).eq("content_type", "post");
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("likes").insert({ user_id: currentUserId, content_id: post.id, content_type: "post" });
        if (error) throw error;
      }
    },
    onMutate: () => {
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikesCount((c: number) => (wasLiked ? Math.max(c - 1, 0) : c + 1));
      return { previousLiked: wasLiked, previousLikesCount: likesCount };
    },
    onError: (_error, _variables, context) => {
      setLiked(context?.previousLiked ?? !!post.isLiked);
      setLikesCount(context?.previousLikesCount ?? (post.likes_count || 0));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
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
      <div className="rounded-xl bg-card border border-border overflow-hidden relative transition-all duration-300">

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
            <div className="flex items-center gap-2">
              <button onClick={() => setShowEdit(true)} className="text-muted-foreground hover:text-foreground">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => deleteMutation.mutate()} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="px-3 pb-2 text-sm text-foreground">{post.caption}</p>
        )}

        {/* Media */}
        {post.media_url && (
          <div className="relative overflow-hidden">
            {post.media_type === "video" ? (
              <video ref={videoRef} src={post.media_url} controls className="w-full object-cover bg-black max-h-[400px]" />
            ) : (
              <img src={post.media_url} alt="" className="w-full object-cover max-h-[400px]" />
            )}
          </div>
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
      <CreatePostSheet open={showEdit} onClose={() => setShowEdit(false)} postToEdit={post} />
    </>
  );
};

export default FeedPostCard;
