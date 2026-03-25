import { useState } from "react";
import { X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { EMOJI_MAP } from "@/lib/emoji-characters";

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
  currentUserId?: string;
  onEmojiReaction?: (emojiId: string) => void;
}

const PostCommentsSheet = ({ postId, open, onClose, currentUserId, onEmojiReaction }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const renderContent = (content: string) => {
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
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const trimmedText = text.trim();
      if (!trimmedText) throw new Error("Comment cannot be empty");

      const { error } = await (supabase as any).from("post_comments").insert({
        post_id: postId,
        user_id: user.id,
        content: trimmedText,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
    },
    onError: (error: any) => toast.error(error?.message || "Failed to comment"),
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/60"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[80] mx-auto flex max-w-lg flex-col rounded-t-2xl border-t border-border bg-background max-h-[70vh]"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">Comments ({comments.length})</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {comments.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No comments yet</p>
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
                    <span className="font-semibold text-foreground mr-1">{comment.profile.display_name || "User"}</span>
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

        <div className="border-t border-border px-2 pt-2">
          <EmojiBar
            onEmoji={(emojiId) => {
              setText((prev) => `${prev}${prev ? " " : ""}:${emojiId}:`);
              onEmojiReaction?.(emojiId);
            }}
            postId={postId}
            currentUserId={currentUserId}
          />
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center gap-2 pb-safe">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Add a comment..."
            className="flex-1 rounded-full bg-secondary px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            onKeyDown={(event) => {
              if (event.key === "Enter" && text.trim()) {
                commentMutation.mutate();
              }
            }}
          />
          <button
            onClick={() => text.trim() && commentMutation.mutate()}
            disabled={!text.trim() || commentMutation.isPending}
            className="text-primary disabled:opacity-40"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PostCommentsSheet;
