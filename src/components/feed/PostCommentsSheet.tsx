import { useState, useEffect } from "react";
import { X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { EMOJI_MAP, FEED_EMOJI_SET } from "@/lib/emoji-characters";

const EMOJI_LABEL_MAP: Record<string, string> = {};
FEED_EMOJI_SET.forEach((e) => {
  EMOJI_LABEL_MAP[e.label] = e.src;
});

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
  onEmojiComment?: (emojiId: string) => void;
}

const PostCommentsSheet = ({ postId, open, onClose, onEmojiComment }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const renderContent = (content: string) => {
    if (EMOJI_LABEL_MAP[content]) {
      return (
        <img
          src={EMOJI_LABEL_MAP[content]}
          alt={content}
          className="inline-block w-8 h-8 object-contain align-middle"
        />
      );
    }

    const exactMatch = content.match(/^:([a-z0-9]+):$/);
    if (exactMatch && EMOJI_MAP[exactMatch[1]]) {
      return (
        <img
          src={EMOJI_MAP[exactMatch[1]]}
          alt={exactMatch[1]}
          className="inline-block w-8 h-8 object-contain align-middle"
        />
      );
    }

    const parts = content.split(/(:[a-z0-9]+:)/g);
    return parts.map((part, index) => {
      const match = part.match(/^:([a-z0-9]+):$/);
      if (match && EMOJI_MAP[match[1]]) {
        return (
          <img
            key={`${match[1]}-${index}`}
            src={EMOJI_MAP[match[1]]}
            alt={match[1]}
            className="inline-block w-5 h-5 object-contain align-middle mx-0.5"
          />
        );
      }
      return <span key={`text-${index}`}>{part}</span>;
    });
  };

  const invalidateComments = () => {
    queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
    queryClient.setQueriesData({ queryKey: ["feed-posts"] }, (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.map((item: any) =>
        item.id === postId && item.itemType === "post"
          ? { ...item, comments_count: (item.comments_count || 0) + 1 }
          : item,
      );
    });
    queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
  };

  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (!data?.length) return [];

      const userIds = [...new Set(data.map((comment: any) => comment.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
      return data.map((comment: any, index: number) => ({
        ...comment,
        localKey: `${comment.id}-${index}`,
        profile: profileMap.get(comment.user_id) || { display_name: "User", avatar_url: null },
      }));
    },
    enabled: open,
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Not authenticated");
      const trimmed = content.trim();
      if (!trimmed) throw new Error("Comment cannot be empty");

      const { error } = await (supabase as any).from("post_comments").insert({
        post_id: postId,
        user_id: user.id,
        content: trimmed,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      invalidateComments();
      onClose();
    },
    onError: (error: any) => toast.error(error?.message || "Failed to comment"),
  });

  const emojiCommentMutation = useMutation({
    mutationFn: async (emojiId: string) => {
      if (!user) throw new Error("Sign in to comment");
      const { error } = await (supabase as any).from("post_comments").insert({
        post_id: postId,
        user_id: user.id,
        content: `:${emojiId}:`,
      });
      if (error) throw error;
      return emojiId;
    },
    onSuccess: (emojiId) => {
      invalidateComments();
      onEmojiComment?.(emojiId);
      onClose();
    },
    onError: (error: any) => toast.error(error?.message || "Failed to comment"),
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="comments-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/60"
        onClick={onClose}
      />

      <motion.div
        key="comments-sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[90] mx-auto flex max-w-lg min-h-0 max-h-[min(70dvh,520px)] flex-col rounded-t-2xl border-t border-border bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">Comments ({comments.length})</h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {comments.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No comments yet — react with an emoji or write something
            </p>
          ) : (
            comments.map((comment: any) => (
              <div key={comment.localKey} className="flex gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex-shrink-0">
                  {comment.profile.avatar_url ? (
                    <img src={comment.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-[9px] font-bold">
                      {(comment.profile.display_name || "U")[0].toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground mr-1">
                      {comment.profile.display_name || "User"}
                    </span>
                    {renderContent(comment.content)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-border feed-pb-nav">
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
              React with emoji
            </p>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {FEED_EMOJI_SET.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={emojiCommentMutation.isPending}
                  onClick={() => emojiCommentMutation.mutate(item.id)}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-40"
                  aria-label={item.label}
                >
                  <img src={item.src} alt={item.label} className="w-7 h-7 object-contain" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write a comment..."
              className="flex-1 min-w-0 rounded-full bg-secondary px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground"
              onKeyDown={(event) => {
                if (event.key === "Enter" && text.trim()) {
                  commentMutation.mutate(text.trim());
                }
              }}
            />
            <button
              type="button"
              onClick={() => text.trim() && commentMutation.mutate(text.trim())}
              disabled={!text.trim() || commentMutation.isPending}
              className="text-primary disabled:opacity-40"
              aria-label="Send comment"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PostCommentsSheet;
