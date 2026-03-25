import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { EMOJI_MAP } from "@/lib/emoji-characters";

interface LiveComment {
  id: string;
  content: string;
  display_name: string;
  created_at: string;
  localId: number;
}

interface FeedLiveCommentsProps {
  postId: string;
  isActive: boolean;
}

const FeedLiveComments = ({ postId, isActive }: FeedLiveCommentsProps) => {
  const [comments, setComments] = useState<LiveComment[]>([]);
  const counterRef = useRef(0);

  const renderContent = useCallback((content: string) => {
    const parts = content.split(/(:[a-z0-9]+:)/g);
    return parts.map((part, index) => {
      const match = part.match(/^:([a-z0-9]+):$/);
      if (match && EMOJI_MAP[match[1]]) {
        return (
          <img
            key={`${match[1]}-${index}`}
            src={EMOJI_MAP[match[1]]}
            alt={match[1]}
            className="inline-block w-4 h-4 object-contain align-middle mx-0.5"
          />
        );
      }
      return <span key={`text-${index}`}>{part}</span>;
    });
  }, []);

  const addComment = useCallback((comment: LiveComment) => {
    setComments((prev) => [...prev.slice(-3), comment]);
    setTimeout(() => {
      setComments((prev) => prev.filter((item) => item.localId !== comment.localId));
    }, 5000);
  }, []);

  useEffect(() => {
    if (!postId || !isActive) {
      setComments([]);
      return;
    }

    const loadRecentComments = async () => {
      const { data } = await (supabase as any)
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(3);

      if (!data?.length) return;

      const userIds = [...new Set(data.map((comment: any) => comment.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));

      setComments(
        [...data]
          .reverse()
          .map((comment: any) => ({
            id: comment.id,
            content: comment.content,
            display_name: profileMap.get(comment.user_id)?.display_name || "User",
            created_at: comment.created_at,
            localId: counterRef.current++,
          }))
      );
    };

    loadRecentComments();

    const channel = supabase
      .channel(`post-comments-live-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "post_comments",
          filter: `post_id=eq.${postId}`,
        },
        async (payload: any) => {
          const row = payload.new;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", row.user_id)
            .maybeSingle();

          addComment({
            id: row.id,
            content: row.content,
            display_name: profile?.display_name || "User",
            created_at: row.created_at,
            localId: counterRef.current++,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addComment, isActive, postId]);

  if (!isActive || comments.length === 0) return null;

  return (
    <div className="absolute left-3 right-24 bottom-44 z-30 pointer-events-none">
      <div className="max-h-[22vh] overflow-hidden flex flex-col justify-end gap-1.5">
        <AnimatePresence>
          {comments.map((comment) => (
            <motion.div
              key={comment.localId}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-fit max-w-full"
            >
              <div className="inline-flex items-start gap-1.5 rounded-xl bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
                <span className="text-[10px] font-bold text-white flex-shrink-0">{comment.display_name}</span>
                <span className="text-[11px] text-white/90 break-words">{renderContent(comment.content)}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FeedLiveComments;
