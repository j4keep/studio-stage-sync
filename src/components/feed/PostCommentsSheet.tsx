import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PostCommentsPanel from "@/components/feed/PostCommentsPanel";

/** Top band reserved for the shrunk mobile video while comments are open */
export const MOBILE_COMMENTS_VIDEO_HEIGHT = "min(32dvh, 280px)";

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
  onEmojiComment?: (emojiId: string) => void;
  authorUserId?: string | null;
  commentsCount?: number | null;
}

/** Mobile comments sheet — TikTok-style under a shrunk video. Desktop does not use this. */
const PostCommentsSheet = ({
  postId,
  open,
  onClose,
  onEmojiComment,
  authorUserId,
  commentsCount,
}: Props) => {
  const { data: liveCount } = useQuery({
    queryKey: ["post-comments-count", postId],
    enabled: open,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("post_comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const displayCount = typeof liveCount === "number" ? liveCount : commentsCount ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="comments-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 340 }}
          className="fixed inset-x-0 bottom-0 z-[90] mx-auto flex max-w-lg flex-col rounded-t-2xl border-t border-border bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.25)]"
          style={{ top: MOBILE_COMMENTS_VIDEO_HEIGHT }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 flex-col items-center border-b border-border px-3 pb-2.5 pt-2">
            <div className="mb-2 h-1 w-10 rounded-full bg-muted-foreground/35" />
            <div className="flex w-full items-center gap-2">
              <h3 className="min-w-0 flex-1 text-[15px] font-bold text-foreground">
                {Number(displayCount).toLocaleString()} comments
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Close comments"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <PostCommentsPanel
            postId={postId}
            authorUserId={authorUserId}
            queryKey={["post-comments", postId]}
            onEmojiComment={onEmojiComment}
            variant="sheet"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PostCommentsSheet;
