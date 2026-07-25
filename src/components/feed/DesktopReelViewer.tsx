import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Forward,
  HandHeart,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  DesktopCommentEmojiBar,
  renderDesktopCommentContent,
} from "@/components/feed/DesktopCommentEmojis";
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
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ y: number; active: boolean } | null>(null);
  const { emojis, spawnEmoji } = useFloatingEmojis();
  const [index, setIndex] = useState(startIndex);
  const [showComments, setShowComments] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [muted, setMuted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [text, setText] = useState("");
  const post = items[index];
  const profile = post?.profile || { display_name: "Artist", avatar_url: null, user_id: post?.user_id };
  const { caption } = useMemo(() => parsePostCaption(post?.caption), [post?.caption]);
  const [liked, setLiked] = useState(Boolean(post?.isLiked));
  const [likesCount, setLikesCount] = useState(post?.likes_count || 0);

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
    setText("");
  }, [post?.id, post?.isLiked, post?.likes_count]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !post?.media_url) return;
    const meta = { title: caption || "YAJ", artist: profile.display_name || "YAJ" };
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    const cleanup = armFeedAudioPlayback(v, meta, 1);
    applyFeedVideoAudio(v, { muted: false, volume: 1 });
    v.currentTime = 0;

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
  }, [post?.id, post?.media_url, caption, profile.display_name]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    applyFeedVideoAudio(v, { muted, volume: muted ? 0 : 1 });
  }, [muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showComments) setShowComments(false);
        else if (showMore) setShowMore(false);
        else onClose();
      }
      if (e.key === "ArrowUp") goPrev();
      if (e.key === "ArrowDown") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose, showComments, showMore]);

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

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["desktop-reel-comments", post?.id],
    enabled: Boolean(post?.id) && showComments,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_comments")
        .select("id, user_id, content, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((c: any) => c.user_id)));
      let profileMap = new Map();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", ids);
        profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      }
      return (data || []).map((c: any) => ({
        ...c,
        profile: profileMap.get(c.user_id) || { display_name: "User", avatar_url: null },
      }));
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Sign in to comment");
      const trimmed = content.trim();
      if (!trimmed) throw new Error("Comment cannot be empty");
      const { error } = await (supabase as any).from("post_comments").insert({
        post_id: post.id,
        user_id: user.id,
        content: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["desktop-reel-comments", post.id] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to comment"),
  });

  const emojiCommentMutation = useMutation({
    mutationFn: async (emojiId: string) => {
      if (!user) throw new Error("Sign in to comment");
      const { error } = await (supabase as any).from("post_comments").insert({
        post_id: post.id,
        user_id: user.id,
        content: `:${emojiId}:`,
      });
      if (error) throw error;
      return emojiId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["desktop-reel-comments", post.id] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to react"),
  });

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
        </div>
      </div>

      {showComments && (
        <aside
          data-no-swipe
          className="absolute bottom-0 right-0 top-0 z-[81] flex w-[min(400px,36vw)] flex-col border-l border-white/10 bg-card"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-foreground">Comments</p>
            <button
              type="button"
              onClick={() => setShowComments(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Hide comments"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {commentsLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {!commentsLoading && comments.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No comments yet — react with an emoji or write something
              </p>
            )}
            {comments.map((c: any) => (
              <div key={c.id} className="flex gap-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                  {c.profile?.avatar_url ? (
                    <img src={c.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-bold">
                      {(c.profile?.display_name || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
                  <p className="text-xs font-bold text-foreground">{c.profile?.display_name || "User"}</p>
                  <p className="text-sm text-foreground">{renderDesktopCommentContent(c.content)}</p>
                </div>
              </div>
            ))}
          </div>

          <DesktopCommentEmojiBar
            disabled={!user || emojiCommentMutation.isPending}
            onPick={(id) => {
              if (!user) return toast.error("Sign in to comment");
              spawnEmoji(id);
              emojiCommentMutation.mutate(id);
            }}
          />

          <form
            className="flex shrink-0 items-center gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              commentMutation.mutate(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={user ? "Write a comment…" : "Sign in to comment"}
              disabled={!user || commentMutation.isPending}
              className="h-10 flex-1 rounded-full border border-border bg-muted px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={!user || !text.trim() || commentMutation.isPending}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Send comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}
