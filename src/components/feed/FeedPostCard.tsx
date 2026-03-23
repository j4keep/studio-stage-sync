import { useEffect, useState, useRef } from "react";
import { Edit3, Eye, Heart, MessageCircle, Share2, Trash2, ThumbsUp, MoreHorizontal, Globe, Bookmark } from "lucide-react";
import { incrementPostViews } from "@/hooks/use-likes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import PostCommentsSheet from "./PostCommentsSheet";
import CreatePostSheet from "./CreatePostSheet";
import ExpandedPostView from "./ExpandedPostView";

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
  const [showExpanded, setShowExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);

  useEffect(() => {
    setLiked(!!post.isLiked);
    setLikesCount(post.likes_count || 0);
  }, [post.id, post.isLiked, post.likes_count]);

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

  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };

  return (
    <>
      <div className="bg-card border-b border-border overflow-hidden">
        {/* Author Header - Facebook style */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0 ring-1 ring-border">
            {post.profile.avatar_url ? (
              <img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                {(post.profile.display_name || "A")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
              {post.profile.display_name || "Artist"}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>{timeAgo}</span>
              <span>·</span>
              <Globe className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {currentUserId === post.user_id && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-9 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={() => { setShowMenu(false); setShowEdit(true); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-secondary"
                      >
                        <Edit3 className="w-4 h-4" /> Edit Post
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); deleteMutation.mutate(); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-secondary"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="px-3 pb-2 text-[14px] text-foreground leading-snug">{post.caption}</p>
        )}

        {/* Media - tap to expand */}
        {post.media_url && (
          <button
            onClick={() => setShowExpanded(true)}
            className="w-full relative overflow-hidden"
          >
            {post.media_type === "video" ? (
              <video src={post.media_url} className="w-full object-cover bg-black max-h-[420px]" muted />
            ) : (
              <img src={post.media_url} alt="" className="w-full object-cover max-h-[420px]" />
            )}
          </button>
        )}

        {/* Reactions summary row */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-1">
            {likesCount > 0 && (
              <>
                <div className="flex -space-x-1">
                  <div className="w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center">
                    <ThumbsUp className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                  <div className="w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center">
                    <Heart className="w-2.5 h-2.5 text-white fill-white" />
                  </div>
                </div>
                <span className="text-[12px] text-muted-foreground ml-1">{formatCount(likesCount)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
            <span>{post.comments_count || 0} comments</span>
            <span>{post.views || 0} views</span>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-border" />

        {/* Action buttons - Facebook style */}
        <div className="flex items-center justify-around px-2 py-1">
          <button
            onClick={() => likeMutation.mutate()}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-md hover:bg-secondary transition-colors ${
              liked ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <ThumbsUp className={`w-[18px] h-[18px] ${liked ? "fill-primary" : ""}`} />
            <span className="text-[13px] font-medium">Like</span>
          </button>
          <button
            onClick={() => setShowComments(true)}
            className="flex items-center gap-1.5 py-2 px-3 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-medium">Comment</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 py-2 px-3 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
          >
            <Share2 className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-medium">Share</span>
          </button>
        </div>
      </div>

      {/* Expanded full-screen view */}
      {showExpanded && (
        <ExpandedPostView
          post={post}
          liked={liked}
          likesCount={likesCount}
          onLike={() => likeMutation.mutate()}
          onComment={() => { setShowExpanded(false); setShowComments(true); }}
          onShare={handleShare}
          onClose={() => setShowExpanded(false)}
        />
      )}

      <PostCommentsSheet postId={post.id} open={showComments} onClose={() => setShowComments(false)} />
      <CreatePostSheet open={showEdit} onClose={() => setShowEdit(false)} postToEdit={post} />
    </>
  );
};

export default FeedPostCard;
