import { useEffect, useState, useRef } from "react";
import { Heart, MessageCircle, Share2, Trash2, MoreHorizontal, Bookmark, Send, Eye, Edit3 } from "lucide-react";
import { incrementPostViews } from "@/hooks/use-likes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PostCommentsSheet from "./PostCommentsSheet";
import CreatePostSheet from "./CreatePostSheet";
import ExpandedPostView from "./ExpandedPostView";

interface Props {
  post: any;
  currentUserId?: string;
  fullScreen?: boolean;
}

const FeedPostCard = ({ post, currentUserId, fullScreen }: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

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

  // Check follow status
  useEffect(() => {
    if (!user || user.id === post.user_id) return;
    (supabase as any).from("follows").select("id").eq("follower_id", user.id).eq("following_id", post.user_id).maybeSingle()
      .then(({ data }: any) => setIsFollowing(!!data));
  }, [user, post.user_id]);

  const toggleFollow = async () => {
    if (!user) return toast.error("Sign in to follow");
    if (user.id === post.user_id) return;
    if (isFollowing) {
      await (supabase as any).from("follows").delete().eq("follower_id", user.id).eq("following_id", post.user_id);
      setIsFollowing(false);
      toast.success("Unfollowed");
    } else {
      await (supabase as any).from("follows").insert({ follower_id: user.id, following_id: post.user_id });
      setIsFollowing(true);
      toast.success("Following!");
    }
  };

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Not authenticated");
      const { data: existingLike } = await (supabase as any)
        .from("likes").select("id").eq("user_id", currentUserId).eq("content_id", post.id).eq("content_type", "post").maybeSingle();
      if (existingLike) {
        await (supabase as any).from("likes").delete().eq("user_id", currentUserId).eq("content_id", post.id).eq("content_type", "post");
      } else {
        await (supabase as any).from("likes").insert({ user_id: currentUserId, content_id: post.id, content_type: "post" });
      }
    },
    onMutate: () => {
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikesCount((c: number) => (wasLiked ? Math.max(c - 1, 0) : c + 1));
      return { previousLiked: wasLiked, previousLikesCount: likesCount };
    },
    onError: (_error: any, _variables: any, context: any) => {
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
    const shareUrl = `${window.location.origin}/feed`;
    const shareText = post.caption || "Check this out!";
    try {
      await navigator.share?.({ title: shareText, url: shareUrl });
    } catch {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: false });

  /* ─── FULL-SCREEN TikTok-style layout ─── */
  if (fullScreen) {
    return (
      <>
        <div className="absolute inset-0 bg-black">
          {/* Media background */}
          {post.media_url && (
            post.media_type === "video" ? (
              <video
                ref={videoRef}
                src={post.media_url}
                className="absolute inset-0 w-full h-full object-cover"
                loop
                playsInline
                muted
                autoPlay
              />
            ) : (
              <img src={post.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )
          )}
          {!post.media_url && (
            <div className="absolute inset-0 bg-gradient-to-b from-card to-background flex items-center justify-center">
              <p className="text-foreground text-lg font-semibold px-8 text-center leading-relaxed">{post.caption}</p>
            </div>
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

          {/* Left-side action icons (unique placement — not right like TikTok) */}
          <div className="absolute left-3 bottom-48 flex flex-col items-center gap-5 z-40">
            {/* Profile avatar */}
            <button
              onClick={() => navigate(`/artist/${post.user_id}`)}
              className="relative"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary/50">
                {post.profile.avatar_url ? (
                  <img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/30 flex items-center justify-center text-white text-sm font-bold">
                    {(post.profile.display_name || "A")[0].toUpperCase()}
                  </div>
                )}
              </div>
              {user?.id !== post.user_id && !isFollowing && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <span className="text-[10px] text-white font-bold">+</span>
                </button>
              )}
            </button>

            {/* Like */}
            <button onClick={() => likeMutation.mutate()} className="flex flex-col items-center gap-0.5">
              <Heart className={`w-7 h-7 ${liked ? "text-red-500 fill-red-500" : "text-white"} drop-shadow-lg`} />
              <span className="text-[11px] font-semibold text-white drop-shadow">{formatCount(likesCount)}</span>
            </button>

            {/* Comment */}
            <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-0.5">
              <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
              <span className="text-[11px] font-semibold text-white drop-shadow">{post.comments_count || 0}</span>
            </button>

            {/* Bookmark */}
            <button className="flex flex-col items-center gap-0.5">
              <Bookmark className="w-6 h-6 text-white drop-shadow-lg" />
            </button>

            {/* Share */}
            <button onClick={handleShare} className="flex flex-col items-center gap-0.5">
              <Share2 className="w-6 h-6 text-white drop-shadow-lg" />
            </button>
          </div>

          {/* Bottom-right user info + caption (unique — opposite of TikTok) */}
          <div className="absolute right-0 bottom-28 left-16 pr-4 z-30">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => navigate(`/artist/${post.user_id}`)}
                className="text-[14px] font-bold text-white drop-shadow-lg hover:underline"
              >
                {post.profile.display_name || "Artist"}
              </button>
              {user?.id !== post.user_id && (
                <button
                  onClick={toggleFollow}
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                    isFollowing
                      ? "bg-white/20 text-white border border-white/30"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
              <span className="text-[10px] text-white/50">• {timeAgo}</span>
            </div>
            {post.caption && post.media_url && (
              <p className="text-[13px] text-white/90 leading-snug drop-shadow line-clamp-3">{post.caption}</p>
            )}
          </div>

          {/* Views counter bottom right */}
          <div className="absolute bottom-28 right-3 z-30 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-white/50" />
            <span className="text-[10px] text-white/50">{post.views || 0}</span>
          </div>

          {/* Owner menu */}
          {currentUserId === post.user_id && (
            <div className="absolute top-16 right-3 z-50">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
              >
                <MoreHorizontal className="w-5 h-5 text-white" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-11 z-50 bg-card border border-border rounded-xl shadow-2xl py-1 min-w-[150px]">
                    <button
                      onClick={() => { setShowMenu(false); setShowEdit(true); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
                    >
                      <Edit3 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); deleteMutation.mutate(); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-destructive hover:bg-secondary"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tap to expand (for detailed view with emojis) */}
          <button
            onClick={() => setShowExpanded(true)}
            className="absolute inset-0 z-20"
            aria-label="Expand post"
          />
        </div>

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
  }

  /* ─── COMPACT card layout (for profile feed, etc.) ─── */
  return (
    <>
      <div className="bg-card border-b border-border overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden flex-shrink-0 ring-1 ring-border">
            {post.profile.avatar_url ? (
              <img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                {(post.profile.display_name || "A")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">{post.profile.display_name || "Artist"}</p>
            <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
        {post.caption && <p className="px-3 pb-2 text-[13px] text-foreground">{post.caption}</p>}
        {post.media_url && (
          <button onClick={() => setShowExpanded(true)} className="w-full">
            {post.media_type === "video" ? (
              <video src={post.media_url} className="w-full object-cover max-h-[350px] bg-black" muted />
            ) : (
              <img src={post.media_url} alt="" className="w-full object-cover max-h-[350px]" />
            )}
          </button>
        )}
        <div className="flex items-center justify-around px-2 py-1.5 border-t border-border">
          <button onClick={() => likeMutation.mutate()} className={`flex items-center gap-1 py-1.5 px-2 ${liked ? "text-red-500" : "text-muted-foreground"}`}>
            <Heart className={`w-4 h-4 ${liked ? "fill-red-500" : ""}`} />
            <span className="text-[12px]">{formatCount(likesCount)}</span>
          </button>
          <button onClick={() => setShowComments(true)} className="flex items-center gap-1 py-1.5 px-2 text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
            <span className="text-[12px]">{post.comments_count || 0}</span>
          </button>
          <button onClick={handleShare} className="flex items-center gap-1 py-1.5 px-2 text-muted-foreground">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
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
