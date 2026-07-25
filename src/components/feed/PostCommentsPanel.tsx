import { useEffect, useMemo, useState } from "react";
import { Send, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EMOJI_MAP, FEED_EMOJI_SET } from "@/lib/emoji-characters";

const EMOJI_LABEL_MAP: Record<string, string> = {};
FEED_EMOJI_SET.forEach((e) => {
  EMOJI_LABEL_MAP[e.label] = e.src;
});

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id?: string | null;
  profile: { display_name: string | null; avatar_url: string | null };
};

function formatCommentAge(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w`;
  return `${Math.floor(day / 30)}mo`;
}

export function renderCommentBody(content: string) {
  if (EMOJI_LABEL_MAP[content]) {
    return (
      <img
        src={EMOJI_LABEL_MAP[content]}
        alt={content}
        className="inline-block h-8 w-8 object-contain align-middle"
      />
    );
  }

  const exactMatch = content.match(/^:([a-z0-9-]+):$/);
  if (exactMatch && EMOJI_MAP[exactMatch[1]]) {
    return (
      <img
        src={EMOJI_MAP[exactMatch[1]]}
        alt={exactMatch[1]}
        className="inline-block h-8 w-8 object-contain align-middle"
      />
    );
  }

  const parts = content.split(/(@[\w.-]+)|(:[a-z0-9-]+:)/g).filter(Boolean);
  return parts.map((part, index) => {
    const emojiMatch = part.match(/^:([a-z0-9-]+):$/);
    if (emojiMatch && EMOJI_MAP[emojiMatch[1]]) {
      return (
        <img
          key={`e-${index}`}
          src={EMOJI_MAP[emojiMatch[1]]}
          alt={emojiMatch[1]}
          className="mx-0.5 inline-block h-5 w-5 object-contain align-middle"
        />
      );
    }
    if (part.startsWith("@")) {
      return (
        <span key={`m-${index}`} className="font-semibold text-sky-400">
          {part}
        </span>
      );
    }
    return <span key={`t-${index}`}>{part}</span>;
  });
}

function Avatar({
  name,
  url,
  size = "md",
}: {
  name?: string | null;
  url?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-[11px]";
  return (
    <div className={`${dim} shrink-0 overflow-hidden rounded-full bg-white/10`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-bold text-white/80">
          {(name || "?")[0]?.toUpperCase()}
        </span>
      )}
    </div>
  );
}

type Props = {
  postId: string;
  /** Post author — shows Author badge on their comments */
  authorUserId?: string | null;
  queryKey?: string[];
  onEmojiComment?: (emojiId: string) => void;
  /** sheet = mobile bottom sheet body; panel = desktop side panel */
  variant?: "sheet" | "panel";
  className?: string;
};

/** Shared IG/FB-style comments list + composer with threaded replies. */
export default function PostCommentsPanel({
  postId,
  authorUserId,
  queryKey,
  onEmojiComment,
  variant = "panel",
  className = "",
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const key = queryKey || ["post-comments", postId];

  useEffect(() => {
    setText("");
    setReplyTo(null);
    setExpanded({});
  }, [postId]);

  const invalidateComments = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
    void queryClient.invalidateQueries({ queryKey: ["desktop-post-comments", postId] });
    void queryClient.invalidateQueries({ queryKey: ["desktop-reel-comments", postId] });
    queryClient.setQueriesData({ queryKey: ["feed-posts"] }, (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.map((item: any) =>
        item.id === postId && item.itemType === "post"
          ? { ...item, comments_count: (item.comments_count || 0) + 1 }
          : item,
      );
    });
  };

  const { data: comments = [], isLoading } = useQuery({
    queryKey: key,
    enabled: Boolean(postId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_comments")
        .select("id, post_id, user_id, content, created_at, parent_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data?.length) return [] as CommentRow[];

      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return data.map((c: any) => ({
        ...c,
        parent_id: c.parent_id ?? null,
        profile: profileMap.get(c.user_id) || { display_name: "User", avatar_url: null },
      })) as CommentRow[];
    },
  });

  const roots = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_id) continue;
      const list = map.get(c.parent_id) || [];
      list.push(c);
      map.set(c.parent_id, list);
    }
    return map;
  }, [comments]);

  const commentMutation = useMutation({
    mutationFn: async (payload: { content: string; parentId?: string | null }) => {
      if (!user) throw new Error("Sign in to comment");
      const trimmed = payload.content.trim();
      if (!trimmed) throw new Error("Comment cannot be empty");
      const row: Record<string, unknown> = {
        post_id: postId,
        user_id: user.id,
        content: trimmed,
      };
      if (payload.parentId) row.parent_id = payload.parentId;
      const { error } = await (supabase as any).from("post_comments").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      invalidateComments();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to comment"),
  });

  const emojiCommentMutation = useMutation({
    mutationFn: async (emojiId: string) => {
      if (!user) throw new Error("Sign in to comment");
      const row: Record<string, unknown> = {
        post_id: postId,
        user_id: user.id,
        content: `:${emojiId}:`,
      };
      if (replyTo?.id) row.parent_id = replyTo.id;
      const { error } = await (supabase as any).from("post_comments").insert(row);
      if (error) throw error;
      return emojiId;
    },
    onSuccess: (emojiId) => {
      invalidateComments();
      onEmojiComment?.(emojiId);
      setReplyTo(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to react"),
  });

  const send = () => {
    if (!text.trim()) return;
    const content = replyTo
      ? text.trim().startsWith("@")
        ? text.trim()
        : `@${replyTo.profile.display_name || "User"} ${text.trim()}`
      : text.trim();
    commentMutation.mutate({ content, parentId: replyTo?.id || null });
  };

  const renderItem = (comment: CommentRow, depth = 0) => {
    const replies = repliesByParent.get(comment.id) || [];
    const isAuthor = Boolean(authorUserId && comment.user_id === authorUserId);
    const open = expanded[comment.id];
    const showReplies = open || depth > 0;

    return (
      <div key={comment.id} className={depth > 0 ? "ml-10 mt-3" : ""}>
        <div className="flex gap-2.5">
          <Avatar name={comment.profile.display_name} url={comment.profile.avatar_url} size={depth ? "sm" : "md"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="text-[13px] font-semibold leading-tight text-foreground">
                {comment.profile.display_name || "User"}
              </span>
              <span className="text-[12px] text-muted-foreground">· {formatCommentAge(comment.created_at)}</span>
              {isAuthor && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Author
                </span>
              )}
            </div>
            <p className="mt-1 break-words text-[15px] leading-[1.35] text-foreground">{renderCommentBody(comment.content)}</p>
            <button
              type="button"
              className="mt-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => {
                setReplyTo(comment);
                setExpanded((prev) => ({ ...prev, [comment.id]: true }));
              }}
            >
              Reply
            </button>

            {depth === 0 && replies.length > 0 && !open && (
              <button
                type="button"
                className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded((prev) => ({ ...prev, [comment.id]: true }))}
              >
                <span className="h-px w-6 bg-border" />
                View {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>
        </div>

        {showReplies && replies.map((r) => renderItem(r, depth + 1))}
      </div>
    );
  };

  const isDark = variant === "sheet";

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 ${isDark ? "" : ""}`}>
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading comments…</p>}
        {!isLoading && roots.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No comments yet — be the first to reply
          </p>
        )}
        {roots.map((c) => renderItem(c))}
      </div>

      <div className="shrink-0 border-t border-border bg-background/95">
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-1 pt-2 scrollbar-hide">
          {FEED_EMOJI_SET.slice(0, 12).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!user || emojiCommentMutation.isPending}
              onClick={() => {
                if (!user) return toast.error("Sign in to comment");
                emojiCommentMutation.mutate(item.id);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform hover:scale-110 active:scale-95 disabled:opacity-40"
              aria-label={item.label}
            >
              <img src={item.src} alt={item.label} className="h-7 w-7 object-contain" />
            </button>
          ))}
        </div>

        {replyTo && (
          <div className="flex items-center justify-between gap-2 px-4 pb-1 text-[12px] text-muted-foreground">
            <span>
              Replying to{" "}
              <span className="font-semibold text-foreground">{replyTo.profile.display_name || "User"}</span>
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="rounded-full p-1 hover:bg-muted" aria-label="Cancel reply">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form
          className="flex items-center gap-2 px-3 pb-3 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Avatar name={user?.email} url={null} size="sm" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              !user
                ? "Sign in to comment"
                : replyTo
                  ? `Add a reply for ${replyTo.profile.display_name || "User"}…`
                  : "Add a comment…"
            }
            disabled={!user || commentMutation.isPending}
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-muted/80 px-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/25"
          />
          <button
            type="submit"
            disabled={!user || !text.trim() || commentMutation.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-full text-primary disabled:opacity-35"
            aria-label="Send comment"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
