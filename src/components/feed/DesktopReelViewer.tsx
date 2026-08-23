import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Forward,
  HandHeart,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parsePostCaption } from "@/lib/post-editor";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  applyFeedVideoAudio,
  armFeedAudioPlayback,
  forceIosAudioSessionToPlayback,
  playFeedVideo,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";
import yajLogo from "@/assets/yaj-logo.png";
import PostCommentsPanel from "@/components/feed/PostCommentsPanel";
import useFloatingEmojis, { FloatingEmojiLayer } from "@/components/feed/FloatingEmojis";

type Props = {
  items: any[];
  startIndex: number;
  onClose: () => void;
};

/** Desktop reel: tall video, actions behind ⋯, comments toggle, swipe/wheel for next. */
export default function DesktopReelViewer({ items, startIndex, onClose }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ y: number; active: boolean } | null>(null);
  const { emojis, spawnEmoji } = useFloatingEmojis();
  const [index, setIndex] = useState(startIndex);
  const [showComments, setShowComments] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [muted, setMuted] = useState(false);
  const [saved, setSaved] = useState(false);
  const post = items[index];
  const profile = post?.profile || { display_name: "Artist", avatar_url: null, user_id: post?.user_id };
  const { caption, meta: postMeta } = useMemo(() => parsePostCaption(post?.caption), [post?.caption]);
  const hasAddedSound = Boolean(postMeta?.music?.audioUrl);
  const showVolumeControl = post?.media_type === "video" || hasAddedSound;
  const [liked, setLiked] = useState(Boolean(post?.isLiked));
  const [likesCount, setLikesCount] = useState(post?.likes_count || 0);
  const [paused, setPaused] = useState(false);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(items.length - 1, i + 1));

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    setLiked(Boolean(post?.isLiked));
    setLikesCount(post?.likes_count || 0);
    setShowComments(false);
    setShowMore(false);
    setSaved(false);
    setPaused(false);
  }, [post?.id, post?.isLiked, post?.likes_count]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !post?.media_url || post.media_type !== "video") return;
    const meta = { title: caption || "YAJ", artist: profile.display_name || "YAJ" };
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    const cleanup = armFeedAudioPlayback(v, meta, 1);
    applyFeedVideoAudio(v, { muted: false, volume: 1 });
    v.currentTime = 0;
    setPaused(false);

    let cancelled = false;
    void (async () => {
      const ok = await playFeedVideo(v, meta, { muted: false });
      if (cancelled) return;
      if (ok && !v.muted) {
        setMuted(false);
        return;
      }
      applyFeedVideoAudio(v, { muted: true, volume: 1 });
      try {
        await v.play();
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      applyFeedVideoAudio(v, { muted: false, volume: 1 });
      setMuted(v.muted);
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [post?.id, post?.media_url, post?.media_type, caption, profile.display_name]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || post?.media_type !== "video") return;
    applyFeedVideoAudio(v, { muted, volume: muted ? 0 : 1 });
  }, [muted, post?.media_type]);

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
      if (e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      }
      if ((e.code === "Space" || e.key === " ") && post?.media_type === "video") {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
          forceIosAudioSessionToPlayback();
          unlockFeedAudioSession();
          applyFeedVideoAudio(v, { muted, volume: muted ? 0 : 1 });
          void v.play().then(() => setPaused(false)).catch(() => setPaused(true));
        } else {
          v.pause();
          setPaused(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose, showComments, showMore, post?.media_type, muted]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let locked = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 28) return;
      e.preventDefault();
      if (locked) return;
      locked = true;
      if (e.deltaY > 0) goNext();
      else goPrev();
      window.setTimeout(() => {
        locked = false;
      }, 420);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [items.length, index]);

  if (!post) return null;

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
      if (navigator.share) await navigator.share({ title: "YAJ reel", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* ignore */
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    swipeRef.current = { y: e.clientY, active: true };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start?.active) return;
    const dy = e.clientY - start.y;
    if (Math.abs(dy) < 64) return;
    if (dy < 0) goNext();
    else goPrev();
  };

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-[80] touch-none bg-black"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipeRef.current = null;
      }}
    >
      <div className="absolute left-4 top-4 z-[90] flex items-center gap-3" data-no-swipe>
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
        className={`flex h-full w-full items-center justify-center gap-3 px-4 transition-all ${
          showComments ? "pr-[min(400px,36vw)]" : ""
        }`}
      >
        <div className="relative flex min-h-0 min-w-0 items-center justify-center">
          <div
            className={`relative overflow-hidden rounded-2xl bg-neutral-900 transition-all ${
              showComments
                ? "h-[min(92vh,900px)] w-[min(460px,46vw)]"
                : "h-[min(96vh,960px)] w-[min(560px,58vw)]"
            }`}
          >
            {post.media_type === "video" ? (
              <video
                ref={videoRef}
                key={post.id}
                src={post.media_url}
                className="h-full w-full object-cover"
                playsInline
                loop
                autoPlay
                controls={false}
              />
            ) : (
              <img src={post.media_url} alt="" className="h-full w-full object-cover" />
            )}

            <FloatingEmojiLayer emojis={emojis} />

            {showVolumeControl && (
              <button
                type="button"
                data-no-swipe
                onClick={() => {
                  if (muted) {
                    forceIosAudioSessionToPlayback();
                    unlockFeedAudioSession();
                    const v = videoRef.current;
                    if (v) {
                      applyFeedVideoAudio(v, { muted: false, volume: 1 });
                      void v.play().catch(() => {});
                    }
                    setMuted(false);
                  } else {
                    setMuted(true);
                  }
                }}
                className={`absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 ${
                  muted ? "text-white/50" : "text-white"
                }`}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}

            {post.media_type === "video" && paused && (
              <button
                type="button"
                data-no-swipe
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  forceIosAudioSessionToPlayback();
                  unlockFeedAudioSession();
                  applyFeedVideoAudio(v, { muted, volume: muted ? 0 : 1 });
                  void v.play().then(() => setPaused(false)).catch(() => {});
                }}
                className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
                aria-label="Play"
              >
                <Play className="ml-0.5 h-6 w-6 fill-white" />
              </button>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 pt-20">
              <button
                type="button"
                data-no-swipe
                className="pointer-events-auto flex items-center gap-2"
                onClick={() => {
                  onClose();
                  navigate(`/artist/${profile.user_id || post.user_id}`);
                }}
              >
                <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
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
            </div>
          </div>

          <div className="relative z-[82] ml-3 flex flex-col items-center self-center" data-no-swipe>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border bg-white/10 text-white transition-colors ${
                showMore ? "border-sky-400 bg-sky-500/20" : "border-white/25"
              }`}
              aria-label="More options"
              title="More options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {showMore && (
              <div className="mt-2 flex max-h-[min(75vh,560px)] flex-col items-center gap-2.5 overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-black/85 px-2.5 py-2.5 shadow-2xl backdrop-blur-md scrollbar-hide">
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
                    navigate(`/circle/u/${profile.user_id || post.user_id}`);
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
        </div>
      </div>

      {showComments && (
        <aside
          data-no-swipe
          className="absolute bottom-0 right-0 top-0 z-[81] flex w-[min(400px,36vw)] flex-col border-l border-white/10 bg-card"
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
            queryKey={["desktop-reel-comments", post.id]}
            variant="panel"
            onEmojiComment={spawnEmoji}
          />
        </aside>
      )}
    </div>
  );
}
