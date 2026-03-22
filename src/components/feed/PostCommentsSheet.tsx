import { useState } from "react";
import { X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
}

const PostCommentsSheet = ({ postId, open, onClose }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

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

      const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return data.map((c: any) => ({ ...c, profile: map.get(c.user_id) || { display_name: "User" } }));
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
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to comment"),
  });

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
          <h3 className="text-sm font-bold text-foreground">Comments</h3>
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
                <p className="text-[11px]">
                  <span className="font-semibold text-foreground">{c.profile.display_name || "User"}</span>
                  <span className="text-muted-foreground ml-1">{c.content}</span>
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-2 pb-safe">
          <input
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
