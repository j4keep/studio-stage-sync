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
  Send,
  Users,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { parsePostCaption } from "@/lib/post-editor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import yajLogo from "@/assets/yaj-logo.png";
import DesktopPostVideoPlayer from "@/components/feed/DesktopPostVideoPlayer";
import {
  DesktopCommentEmojiBar,
  renderDesktopCommentContent,
} from "@/components/feed/DesktopCommentEmojis";

type Props = {
  items: any[];
  startIndex: number;
  onClose: () => void;
};

/** Desktop post theater: media + caption, actions in ⋯, comments open at bottom when toggled. */
export default function DesktopPostDetail({ items, startIndex, onClose }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(startIndex);
  const [text, setText] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [saved, setSaved] = useState(false);
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
    setText("");
    setShowMore(false);
    setShowComments(true);
    setSaved(false);
  }, [post?.id, post?.isLiked, post?.likes_count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showComments) setShowComments(false);
        else if (showMore) setShowMore(false);
        else onClose();
      }
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(items.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose, showComments, showMore]);

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["desktop-post-comments", post?.id],
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
      void queryClient.invalidateQueries({ queryKey: ["desktop-post-comments", post.id] });
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
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["desktop-post-comments", post.id] });
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
    <div className="fixed inset-0 z-[80] flex bg-black/85" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute left-4 top-4 z-[90] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="flex h-full w-full items-stretch gap-3 px-3 py-4 pt-16 sm:gap-5 sm:px-5"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="hidden w-[7.5rem] shrink-0 flex-col items-center justify-center lg:flex xl:w-40">
          <img src={yajLogo} alt="YAJ" className="h-24 w-auto object-contain drop-shadow-2xl xl:h-32" />
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="absolute left-0 z-[85] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur sm:left-2"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {index < items.length - 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="absolute right-0 z-[85] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur sm:right-2"
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="absolute right-3 top-3 z-20">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border bg-black/50 text-white backdrop-blur ${
                  showMore ? "border-sky-400" : "border-white/25"
                }`}
                aria-label="More options"
                title="More options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {showMore && (
                <div className="mt-2 flex max-h-[min(55vh,420px)] flex-col items-center gap-2.5 overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-black/90 px-2.5 py-2.5 shadow-2xl scrollbar-hide">
                  <button type="button" onClick={toggleLike} className="flex flex-col items-center gap-0.5 text-white">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <Heart className={`h-5 w-5 ${liked ? "fill-red-500 text-red-500" : ""}`} />
                    </span>
                    <span className="text-[10px] font-semibold">{likesCount || 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComments((v) => !v)}
                    className="flex flex-col items-center gap-0.5 text-white"
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ${
                        showComments ? "text-primary" : ""
                      }`}
                    >
                      <MessageCircle className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] font-semibold">
                      {showComments ? "Hide" : post.comments_count || 0}
                    </span>
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
                  <button
                    type="button"
                    onClick={share}
                    className="flex flex-col items-center gap-0.5 text-white"
                    aria-label="Share"
                  >
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

            <div className="relative h-[min(42vh,420px)] w-full shrink-0 overflow-hidden bg-black">
              {post.media_type === "video" && post.media_url ? (
                <DesktopPostVideoPlayer src={post.media_url} title={caption || "YAJ post"} className="h-full" />
              ) : post.media_url ? (
                <img src={post.media_url} alt="" className="mx-auto h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No media</div>
              )}
            </div>

            <div className="shrink-0 border-b border-border p-4">
              <button
                type="button"
                className="flex items-center gap-2 text-left"
                onClick={() => {
                  onClose();
                  navigate(`/artist/${profile.user_id || post.user_id}`);
                }}
              >
                <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold">
                      {(profile.display_name || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{profile.display_name || "Artist"}</p>
                  {post.created_at && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </button>
              {caption && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{caption}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {likesCount} likes
                {typeof post.comments_count === "number" ? ` · ${post.comments_count} comments` : ""}
              </p>
            </div>

            {showComments && (
              <>
                <div className="min-h-0 max-h-[28vh] flex-1 space-y-3 overflow-y-auto px-4 py-3">
                  {commentsLoading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
                  {!commentsLoading && comments.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
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
              </>
            )}
          </div>
        </div>

        <aside className="hidden w-[7.5rem] shrink-0 lg:block xl:w-40" aria-hidden />
      </div>
    </div>
  );
}
