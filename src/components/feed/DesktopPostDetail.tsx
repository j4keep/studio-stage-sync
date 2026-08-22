import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Forward,
  HandHeart,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parsePostCaption } from "@/lib/post-editor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import yajLogo from "@/assets/yaj-logo.png";
import DesktopPostVideoPlayer from "@/components/feed/DesktopPostVideoPlayer";
import PostCommentsPanel from "@/components/feed/PostCommentsPanel";
import BattleFeedSlide from "@/components/feed/BattleFeedSlide";
import useFloatingEmojis, { FloatingEmojiLayer } from "@/components/feed/FloatingEmojis";
import { forceIosAudioSessionToPlayback, unlockFeedAudioSession } from "@/lib/feed-video-playback";

type Props = {
  items: any[];
  startIndex: number;
  onClose: () => void;
};

/** Desktop post theater: video-first like phone/FB — profile on media, comments on demand. */
export default function DesktopPostDetail({ items, startIndex, onClose }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { emojis, spawnEmoji } = useFloatingEmojis();
  const [index, setIndex] = useState(startIndex);
  const [showMore, setShowMore] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [saved, setSaved] = useState(false);
  const post = items[index];
  const profile = post?.profile || { display_name: "Artist", avatar_url: null, user_id: post?.user_id };
  const { caption } = useMemo(() => parsePostCaption(post?.caption), [post?.caption]);
  const [liked, setLiked] = useState(Boolean(post?.isLiked));
  const [likesCount, setLikesCount] = useState(post?.likes_count || 0);

  useEffect(() => {
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
  }, []);

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    setLiked(Boolean(post?.isLiked));
    setLikesCount(post?.likes_count || 0);
    setShowMore(false);
    setShowComments(false);
    setSaved(false);
  }, [post?.id, post?.isLiked, post?.likes_count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (showComments) setShowComments(false);
        else if (showMore) setShowMore(false);
        else onClose();
        return;
      }
      if (typing) return;
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(items.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose, showComments, showMore]);

  if (!post) return null;

  if (post.itemType === "battle") {
    return (
      <div className="fixed inset-0 z-[80] bg-black/95" onClick={onClose}>
        <div
          className="absolute left-4 top-4 z-[90] flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img src={yajLogo} alt="YAJ" className="h-12 w-auto object-contain drop-shadow-lg sm:h-14" />
        </div>

        <div
          className="flex h-full items-center justify-center gap-3 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div className="feed-viewer-root relative h-[min(92vh,920px)] w-[min(520px,56vw)] overflow-hidden rounded-2xl bg-black shadow-2xl">
            <BattleFeedSlide battle={post} currentUserId={user?.id} isActive />
          </div>

          {index < items.length - 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const toggleLike = async () => {
    if (!user) return toast.error("Sign in to like");
    const next = !liked;
    setLiked(next);
    setLikesCount((c: number) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        await (supabase as any).from("likes").insert({
          user_id: user.id,
          content_id: post.id,
          content_type: "post",
        });
      } else {
        await (supabase as any)
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", post.id)
          .eq("content_type", "post");
      }
    } catch {
      setLiked(!next);
      setLikesCount((c: number) => Math.max(0, c + (next ? -1 : 1)));
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/#/feed`;
    try {
      if (navigator.share) await navigator.share({ title: "YAJ post", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90" onClick={onClose}>
      {/* Facebook-style top-left: close + brand logo */}
      <div
        className="absolute left-4 top-4 z-[90] flex items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <img src={yajLogo} alt="YAJ" className="h-12 w-auto object-contain drop-shadow-lg sm:h-14" />
      </div>

      <div
        className={`flex h-full items-center justify-center gap-3 px-4 transition-all ${
          showComments ? "pr-[min(380px,34vw)]" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Tall media only — no white profile/caption panel under it */}
        <div className="relative h-[min(92vh,920px)] w-[min(480px,48vw)] overflow-hidden rounded-2xl bg-neutral-950 shadow-2xl">
          {post.media_type === "video" && post.media_url ? (
            <DesktopPostVideoPlayer src={post.media_url} title={caption || "YAJ post"} className="h-full" />
          ) : post.media_url ? (
            <img src={post.media_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/60">No media</div>
          )}

          <FloatingEmojiLayer emojis={emojis} />

          {/* Profile + caption overlaid on media (phone-style) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-12 z-[15] bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-6 pt-16">
            <button
              type="button"
              className="pointer-events-auto flex items-center gap-2 text-left"
              onClick={() => {
                onClose();
                navigate(`/artist/${profile.user_id || post.user_id}`);
              }}
            >
              <div className="h-9 w-9 overflow-hidden rounded-full bg-white/20">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                    {(profile.display_name || "?")[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-white">{profile.display_name || "Artist"}</span>
            </button>
            {caption && <p className="mt-2 line-clamp-3 text-sm text-white/90">{caption}</p>}
            <p className="mt-1 text-[11px] text-white/65">
              {likesCount} likes
              {typeof post.comments_count === "number" ? ` · ${post.comments_count} comments` : ""}
            </p>
          </div>
        </div>

        {/* Actions outside the card so nothing gets clipped */}
        <div className="relative z-[82] flex shrink-0 flex-col items-center self-center">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border bg-white/10 text-white ${
              showMore ? "border-sky-400 bg-sky-500/20" : "border-white/25"
            }`}
            aria-label="More options"
            title="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {showMore && (
            <div className="mt-2 flex max-h-[min(75vh,560px)] flex-col items-center gap-2.5 overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-black/90 px-2.5 py-2.5 shadow-2xl scrollbar-hide">
              <button type="button" onClick={toggleLike} className="flex flex-col items-center gap-0.5 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Heart className={`h-5 w-5 ${liked ? "fill-red-500 text-red-500" : ""}`} />
                </span>
                <span className="text-[10px] font-semibold">{likesCount || 0}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowComments((v) => !v);
                  setShowMore(false);
                }}
                className="flex flex-col items-center gap-0.5 text-white"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ${
                    showComments ? "text-primary" : ""
                  }`}
                >
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-semibold">{post.comments_count || 0}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaved((s) => !s);
                  toast.success(saved ? "Removed from saved" : "Saved");
                }}
                className="flex flex-col items-center gap-0.5 text-white"
                aria-label="Save"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Bookmark className={`h-5 w-5 ${saved ? "fill-white text-white" : ""}`} />
                </span>
              </button>
              <button type="button" onClick={share} className="flex flex-col items-center gap-0.5 text-white" aria-label="Share">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Forward className="h-5 w-5" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/circle");
                }}
                className="flex flex-col items-center gap-0.5 text-white"
                aria-label="Open My Circle"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Users className="h-5 w-5" />
                </span>
                <span className="text-[9px] font-semibold">My Circle</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/my-projects");
                }}
                className="flex flex-col items-center gap-0.5 text-white"
                aria-label="Support this artist"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <HandHeart className="h-5 w-5" />
                </span>
                <span className="text-[9px] font-semibold">Support</span>
              </button>
            </div>
          )}
        </div>

        {index < items.length - 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {showComments && (
        <aside
          className="absolute bottom-0 right-0 top-0 z-[81] flex w-[min(380px,34vw)] flex-col border-l border-white/10 bg-card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[14px] font-semibold text-foreground">Comments</p>
            <button
              type="button"
              onClick={() => setShowComments(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Hide comments"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <PostCommentsPanel
            postId={post.id}
            authorUserId={post.user_id}
            queryKey={["desktop-post-comments", post.id]}
            variant="panel"
            onEmojiComment={spawnEmoji}
          />
        </aside>
      )}
    </div>
  );
}
