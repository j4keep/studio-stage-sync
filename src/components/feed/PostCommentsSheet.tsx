import { useState, useRef } from "react";
import { X, Send, Smile } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { EMOJI_CHARACTERS, EMOJI_MAP } from "@/lib/emoji-characters";

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
  onEmojiReaction?: (emojiId: string) => void;
}

const PostCommentsSheet = ({ postId, open, onClose, onEmojiReaction }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (!data?.length) return [];

      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      // Also fetch reactions for each comment's user on this post
      const { data: reactions } = await (supabase as any)
        .from("post_reactions")
        .select("user_id, emoji_id")
        .eq("post_id", postId);

      const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const reactionsByUser = new Map<string, string[]>();
      (reactions || []).forEach((r: any) => {
        const existing = reactionsByUser.get(r.user_id) || [];
        existing.push(r.emoji_id);
        reactionsByUser.set(r.user_id, existing);
      });

      return data.map((c: any) => ({
        ...c,
        profile: map.get(c.user_id) || { display_name: "User" },
        userReactions: reactionsByUser.get(c.user_id) || [],
      }));
    },
    enabled: open,
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("post_comments").insert({
        post_id: postId,
        user_id: user.id,
        content: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setShowEmojiPicker(false);
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to comment"),
  });

  const handleEmojiSelect = async (emojiId: string) => {
    // Insert as text in the input
    const emojiLabel = EMOJI_CHARACTERS.find(e => e.id === emojiId)?.label || emojiId;
    setText((prev) => prev + ` :${emojiId}: `);
    setShowEmojiPicker(false);
    inputRef.current?.focus();

    // Also store as a reaction and trigger floating emoji
    if (user) {
      await (supabase as any).from("post_reactions").insert({
        post_id: postId,
        user_id: user.id,
        emoji_id: emojiId,
      });
      onEmojiReaction?.(emojiId);
    }
  };

  // Render comment content with custom emoji images inline
  const renderContent = (content: string) => {
    const parts = content.split(/(:[a-z0-9]+:)/g);
    return parts.map((part, i) => {
      const match = part.match(/^:([a-z0-9]+):$/);
      if (match && EMOJI_MAP[match[1]]) {
        return (
          <img
            key={i}
            src={EMOJI_MAP[match[1]]}
            alt={match[1]}
            className="inline-block w-5 h-5 object-contain align-middle mx-0.5"
          />
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[80] mx-auto max-w-lg rounded-t-2xl bg-background border-t border-border max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Comments ({comments.length})</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {comments.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">No comments yet</p>
          ) : comments.map((c: any) => (
            <div key={c.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-secondary flex-shrink-0 overflow-hidden">
                {c.profile.avatar_url ? (
                  <img src={c.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-[9px] font-bold">
                    {(c.profile.display_name || "U")[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] flex-1">
                    <span className="font-semibold text-foreground">{c.profile.display_name || "User"}</span>
                    <span className="text-muted-foreground ml-1">{renderContent(c.content)}</span>
                  </p>
                  {/* Show emoji reactions this user sent */}
                  {c.userReactions.length > 0 && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {c.userReactions.slice(0, 3).map((eid: string, idx: number) => (
                        EMOJI_MAP[eid] && (
                          <img key={idx} src={EMOJI_MAP[eid]} alt="" className="w-4 h-4 object-contain" />
                        )
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Emoji picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border overflow-hidden"
            >
              <div className="grid grid-cols-8 gap-1 p-2 max-h-[180px] overflow-y-auto">
                {EMOJI_CHARACTERS.map((emoji) => (
                  <button
                    key={emoji.id}
                    onClick={() => handleEmojiSelect(emoji.id)}
                    className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                  >
                    <img src={emoji.src} alt={emoji.label} className="w-6 h-6 object-contain" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-2 pb-safe">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 text-sm bg-secondary rounded-full px-3 py-2 outline-none text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) commentMutation.mutate(); }}
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