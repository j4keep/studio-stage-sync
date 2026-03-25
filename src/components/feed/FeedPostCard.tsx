import { useEffect, useState, useRef, useCallback } from "react";
import {
  Heart,
  MessageCircle,
  Forward,
  Trash2,
  MoreHorizontal,
  Bookmark,
  Eye,
  Edit3,
  Volume2,
  VolumeX,
} from "lucide-react";
import { incrementPostViews } from "@/hooks/use-likes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PostCommentsSheet from "./PostCommentsSheet";
import CreatePostSheet from "./CreatePostSheet";
import FloatingEmojis, { EmojiBar } from "./FloatingEmojis";


interface Props {
  post: any;
  currentUserId?: string;
  isActive?: boolean;
}

const FeedPostCard = ({ post, currentUserId, isActive = false }: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const profile = post.profile || { display_name: "Artist", avatar_url: null };
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { spawnEmoji, FloatingLayer } = FloatingEmojis({ postId: post.id });

  useEffect(() => {
    setLiked(!!post.isLiked);
    setLikesCount(post.likes_count || 0);
  }, [post.id, post.isLiked, post.likes_count]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (post.media_type !== "video" || !videoRef.current) return;

    const video = videoRef.current;

    if (!isActive) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    const playVideo = async () => {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };

    playVideo();
  }, [isActive, post.media_type]);

  useEffect(() => {
    if (!viewCounted && isActive && post.id) {
      setViewCounted(true);
      incrementPostViews(post.id);
    }
  }, [isActive, post.id, viewCounted]);

  useEffect(() => {
    if (!user || user.id === post.user_id) return;
    (supabase as any)
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", post.user_id)
      .maybeSingle()
      .then(({ data }: any) => setIsFollowing(!!data));
  }, [user, post.user_id]);


  const toggleFollow = async () => {
    if (!user) return toast.error("Sign in to follow");
    if (user.id === post.user_id) return;

    if (isFollowing) {
      await (supabase as any)
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", post.user_id);
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
        .from("likes")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("content_id", post.id)
        .eq("content_type", "post")
        .maybeSingle();

      if (existingLike) {
        await (supabase as any)
          .from("likes")
          .delete()
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
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikesCount((count: number) => (wasLiked ? Math.max(count - 1, 0) : count + 1));
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

  const handleContentTap = useCallback(() => {
    const now = Date.now();
    const doubleTapDelay = 300;

    if (now - lastTapRef.current < doubleTapDelay) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      if (!liked) likeMutation.mutate();
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;
    tapTimerRef.current = setTimeout(() => {
      if (post.media_type === "video" && videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play();
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    }, doubleTapDelay);
  }, [liked, likeMutation, post.media_type]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/feed`;
    const shareText = post.caption || "Check this out!";

    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  const handleEmojiReaction = (emojiId: string) => {
    spawnEmoji(emojiId);
  };

  const formatCount = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return value.toString();
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: false });

  return (
    <>
      <div className="absolute inset-0 bg-black">
        {post.media_url &&
          (post.media_type === "video" ? (
            <video
              ref={videoRef}
              src={post.media_url}
              className="absolute inset-0 h-full w-full object-cover"
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <img src={post.media_url} alt={post.caption || "Feed post"} className="absolute inset-0 h-full w-full object-cover" />
          ))}

        {!post.media_url && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-card to-background">
            <p className="px-8 text-center text-lg font-semibold leading-relaxed text-foreground">{post.caption}</p>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
        <FloatingLayer />
        

        {post.media_type === "video" && (
          <button
            onClick={() => setIsMuted((value) => !value)}
            className="absolute top-16 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </button>
        )}

        <button
          onClick={handleContentTap}
          className="absolute inset-0 z-20"
          aria-label="Tap to play or pause, double tap to like"
        />

        {showHeart && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <Heart className="w-24 h-24 fill-red-500 text-red-500 animate-ping" />
          </div>
        )}

        <div className="absolute right-3 bottom-8 z-40 flex flex-col items-center gap-5">
          <button onClick={() => likeMutation.mutate()} className="flex flex-col items-center gap-0.5 z-50">
            <Heart className={`w-7 h-7 drop-shadow-lg ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
            <span className="text-[11px] font-semibold text-white drop-shadow">{formatCount(likesCount)}</span>
          </button>

          <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-0.5 z-50">
            <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
            <span className="text-[11px] font-semibold text-white drop-shadow">{post.comments_count || 0}</span>
          </button>

          <button className="flex flex-col items-center gap-0.5 z-50">
            <Bookmark className="w-6 h-6 text-white drop-shadow-lg" />
          </button>

          <button onClick={handleShare} className="flex flex-col items-center gap-0.5 z-50">
            <Forward className="w-7 h-7 text-white drop-shadow-lg" />
          </button>

          <div className="flex flex-col items-center gap-0.5 z-50">
            <Eye className="w-6 h-6 text-white drop-shadow-lg" />
            <span className="text-[11px] font-semibold text-white drop-shadow">{formatCount(post.views || 0)}</span>
          </div>
        </div>

        <div className="absolute left-3 right-20 bottom-20 z-40">
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => navigate(`/artist/${post.user_id}`)}
              className="z-50 text-[14px] font-bold text-white drop-shadow-lg hover:underline"
            >
              @{profile.display_name || "Artist"}
            </button>
            {user?.id !== post.user_id && (
              <button
                onClick={toggleFollow}
                className={`z-50 rounded-md px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                  isFollowing ? "border border-white/30 bg-white/20 text-white" : "bg-red-500 text-white"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          {post.caption && <p className="text-[13px] leading-snug text-white/90 drop-shadow line-clamp-2">{post.caption}</p>}
          <span className="mt-1 block text-[10px] text-white/50">{timeAgo} ago</span>

          <div className="z-50 mt-1.5">
            <EmojiBar onEmoji={handleEmojiReaction} postId={post.id} currentUserId={currentUserId} />
          </div>
          {post.media_type === "video" && !isPlaying && (
            <span className="mt-1 block text-[10px] text-white/70">Paused</span>
          )}
        </div>

        {currentUserId === post.user_id && (
          <div className="absolute top-16 right-3 z-50">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm"
            >
              <MoreHorizontal className="w-5 h-5 text-white" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-11 z-50 min-w-[150px] rounded-xl border border-border bg-card py-1 shadow-2xl">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowEdit(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
                  >
                    <Edit3 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      deleteMutation.mutate();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-secondary"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <PostCommentsSheet
        postId={post.id}
        open={showComments}
        onClose={() => setShowComments(false)}
        currentUserId={currentUserId}
        onEmojiReaction={handleEmojiReaction}
      />
      <CreatePostSheet open={showEdit} onClose={() => setShowEdit(false)} postToEdit={post} />
    </>
  );
};

export default FeedPostCard;
