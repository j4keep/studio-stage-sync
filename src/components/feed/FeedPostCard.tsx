import { useEffect, useState, useRef, useCallback } from "react";
import { Heart, MessageCircle, Forward, Trash2, MoreHorizontal, Bookmark, Eye, Edit3 } from "lucide-react";
import { incrementPostViews } from "@/hooks/use-likes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PostCommentsSheet from "./PostCommentsSheet";
import CreatePostSheet from "./CreatePostSheet";

interface Props {
  post: any;
  currentUserId?: string;
}

const FeedPostCard = ({ post, currentUserId }: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const profile = post.profile || { display_name: "Artist", avatar_url: null };
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showHeart, setShowHeart] = useState(false);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const likeMutation = useMutation<void, Error, void>({
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

  // Single tap = play/pause video, Double tap = like
  const handleContentTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap — like
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      if (!liked) likeMutation.mutate();
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
      lastTapRef.current = 0;
    } else {
      // Single tap — wait to confirm it's not a double tap
      lastTapRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        // Single tap confirmed — toggle play/pause
        if (post.media_type === "video" && videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      }, DOUBLE_TAP_DELAY);
    }
  }, [liked, post.media_type]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/feed`;
    const shareText = post.caption || "Check this out!";
    try {
      await navigator.share?.({ title: shareText, text: shareText, url: shareUrl });
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

        {/* Tap area for play/pause & double-tap like */}
        <button
          onClick={handleContentTap}
          className="absolute inset-0 z-20"
          aria-label="Tap to play/pause, double tap to like"
        />

        {/* Double-tap heart animation */}
        {showHeart && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <Heart className="w-24 h-24 text-red-500 fill-red-500 animate-ping" />
          </div>
        )}

        {/* Right-side action icons (TikTok style) */}
        <div className="absolute right-3 bottom-44 flex flex-col items-center gap-5 z-40">
          {/* Profile avatar */}
          <button
            onClick={() => navigate(`/artist/${post.user_id}`)}
            className="relative"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white/40">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/30 flex items-center justify-center text-white text-sm font-bold">
                  {(profile.display_name || "A")[0].toUpperCase()}
                </div>
              )}
            </div>
            {user?.id !== post.user_id && !isFollowing && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
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

          {/* Share — curved arrow */}
          <button onClick={handleShare} className="flex flex-col items-center gap-0.5">
            <Forward className="w-7 h-7 text-white drop-shadow-lg" />
          </button>

          {/* Views */}
          <div className="flex flex-col items-center gap-0.5">
            <Eye className="w-5 h-5 text-white/70" />
            <span className="text-[10px] text-white/70">{post.views || 0}</span>
          </div>
        </div>

        {/* Bottom user info + caption */}
        <div className="absolute left-3 right-20 bottom-28 z-30">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => navigate(`/artist/${post.user_id}`)}
              className="text-[14px] font-bold text-white drop-shadow-lg hover:underline"
            >
              @{profile.display_name || "Artist"}
            </button>
            {user?.id !== post.user_id && (
              <button
                onClick={toggleFollow}
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                  isFollowing
                    ? "bg-white/20 text-white border border-white/30"
                    : "bg-red-500 text-white"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>
          {post.caption && (
            <p className="text-[13px] text-white/90 leading-snug drop-shadow line-clamp-2">{post.caption}</p>
          )}
          <span className="text-[10px] text-white/50 mt-1 block">{timeAgo} ago</span>
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
      </div>

      <PostCommentsSheet postId={post.id} open={showComments} onClose={() => setShowComments(false)} />
      <CreatePostSheet open={showEdit} onClose={() => setShowEdit(false)} postToEdit={post} />
    </>
  );
};

export default FeedPostCard;
