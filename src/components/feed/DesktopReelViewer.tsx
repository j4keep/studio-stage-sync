import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Share2, ThumbsUp, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parsePostCaption } from "@/lib/post-editor";
import PostCommentsSheet from "@/components/feed/PostCommentsSheet";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  items: any[];
  startIndex: number;
  onClose: () => void;
};

/** Desktop FB-style reel: vertical video center, actions beside it, up/down to next. */
export default function DesktopReelViewer({ items, startIndex, onClose }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(startIndex);
  const [showComments, setShowComments] = useState(false);
  const post = items[index];
  const profile = post?.profile || { display_name: "Artist", avatar_url: null, user_id: post?.user_id };
  const { caption } = useMemo(() => parsePostCaption(post?.caption), [post?.caption]);
  const [liked, setLiked] = useState(Boolean(post?.isLiked));
  const [likesCount, setLikesCount] = useState(post?.likes_count || 0);

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    setLiked(Boolean(post?.isLiked));
    setLikesCount(post?.likes_count || 0);
    setShowComments(false);
  }, [post?.id, post?.isLiked, post?.likes_count]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => {});
  }, [post?.id, post?.media_url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowUp") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowDown") setIndex((i) => Math.min(items.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

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
          content_type: "video",
        });
      } else {
        await (supabase as any)
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", post.id);
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

  return (
    <div className="fixed inset-0 z-[80] bg-black">
      <button
        type="button"
        onClick={onClose}
        className="absolute left-4 top-4 z-[81] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex h-full items-center justify-center gap-4 px-6">
        <div className="relative h-[min(90vh,820px)] w-[min(420px,42vw)] overflow-hidden rounded-2xl bg-neutral-900">
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

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pt-16">
            <button
              type="button"
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

        <div className="flex flex-col items-center gap-5 text-white">
          <button type="button" onClick={toggleLike} className="flex flex-col items-center gap-1">
            <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ${liked ? "text-primary" : ""}`}>
              <ThumbsUp className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold">{likesCount || 0}</span>
          </button>
          <button type="button" onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <MessageCircle className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold">Comment</span>
          </button>
          <button type="button" onClick={share} className="flex flex-col items-center gap-1">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Share2 className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold">Share</span>
          </button>
        </div>

        <div className="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col gap-3">
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30"
            aria-label="Previous reel"
          >
            <ChevronUp className="h-6 w-6" />
          </button>
          <button
            type="button"
            disabled={index >= items.length - 1}
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30"
            aria-label="Next reel"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
        </div>
      </div>

      <PostCommentsSheet postId={post.id} open={showComments} onClose={() => setShowComments(false)} />
    </div>
  );
}
