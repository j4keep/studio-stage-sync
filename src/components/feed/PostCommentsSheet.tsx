import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PostCommentsPanel from "@/components/feed/PostCommentsPanel";

interface Props {
  postId: string;
  open: boolean;
  onClose: () => void;
  onEmojiComment?: (emojiId: string) => void;
  authorUserId?: string | null;
}

/** Mobile bottom-sheet comments — IG/FB style with replies. */
const PostCommentsSheet = ({ postId, open, onClose, onEmojiComment, authorUserId }: Props) => {
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
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[90] mx-auto flex max-h-[min(78dvh,640px)] min-h-0 max-w-lg flex-col rounded-t-2xl border-t border-border bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col items-center border-b border-border px-4 pb-3 pt-2">
          <div className="mb-2 h-1 w-10 rounded-full bg-muted-foreground/35" />
          <div className="flex w-full items-center justify-between">
            <span className="w-8" />
            <h3 className="text-[15px] font-bold text-foreground">Comments</h3>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted" aria-label="Close comments">
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
    </AnimatePresence>
  );
};

export default PostCommentsSheet;
