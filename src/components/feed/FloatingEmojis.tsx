import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FEED_EMOJI_SET, EMOJI_MAP, type EmojiCharacter } from "@/lib/emoji-characters";
import { supabase } from "@/integrations/supabase/client";

interface FloatingEmoji {
  id: number;
  emojiId: string;
  src: string;
  x: number;
}

interface FloatingEmojisProps {
  postId?: string;
}

const FloatingEmojis = ({ postId }: FloatingEmojisProps) => {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const counterRef = useRef(0);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reactionsRef = useRef<string[]>([]);
  const loopIndexRef = useRef(0);

  const spawnEmoji = useCallback((emojiId: string) => {
    const src = EMOJI_MAP[emojiId];
    if (!src) return;
    const id = counterRef.current++;
    const x = 10 + Math.random() * 80;
    setEmojis((prev) => [...prev, { id, emojiId, src, x }]);
    setTimeout(() => {
      setEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2500);
  }, []);

  // Start continuous loop of stored reactions
  const startLoop = useCallback((reactions: string[]) => {
    if (loopRef.current) clearInterval(loopRef.current);
    if (reactions.length === 0) return;
    reactionsRef.current = reactions;
    loopIndexRef.current = 0;
    loopRef.current = setInterval(() => {
      const r = reactionsRef.current;
      if (r.length === 0) return;
      const emojiId = r[loopIndexRef.current % r.length];
      loopIndexRef.current++;
      spawnEmoji(emojiId);
    }, 800);
  }, [spawnEmoji]);

  const stopLoop = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  // Load stored reactions for this post
  useEffect(() => {
    if (!postId) return;
    const loadReactions = async () => {
      const { data } = await (supabase as any)
        .from("post_reactions")
        .select("emoji_id")
        .eq("post_id", postId);
      if (data && data.length > 0) {
        reactionsRef.current = data.map((r: any) => r.emoji_id);
      }
    };
    loadReactions();

    // Listen for new reactions in realtime
    const channel = supabase
      .channel(`post-reactions-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "post_reactions",
          filter: `post_id=eq.${postId}`,
        },
        (payload: any) => {
          reactionsRef.current = [...reactionsRef.current, payload.new.emoji_id];
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  return {
    emojis,
    spawnEmoji,
    startLoop,
    stopLoop,
    FloatingLayer: () => (
      <AnimatePresence>
        {emojis.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 1, y: 0, scale: 0.3 }}
            animate={{ opacity: 0, y: -280, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
            className="absolute bottom-16 pointer-events-none z-50"
            style={{ left: `${e.x}%` }}
          >
            <motion.div
              animate={{
                rotate: [0, -8, 8, -6, 6, 0],
                scaleX: [1, 1.05, 0.95, 1],
                scaleY: [1, 0.95, 1.05, 1],
              }}
              transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src={e.src}
                alt=""
                className="w-16 h-16 object-contain drop-shadow-lg"
                style={{ filter: "drop-shadow(0 0 6px rgba(255,165,0,0.4))" }}
              />
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    ),
  };
};

export const EmojiBar = ({
  onEmoji,
  postId,
  currentUserId,
}: {
  onEmoji: (emojiId: string) => void;
  postId?: string;
  currentUserId?: string;
}) => {
  const handleEmoji = async (item: EmojiCharacter) => {
    onEmoji(item.id);
    // Store reaction in DB
    if (postId && currentUserId) {
      await (supabase as any).from("post_reactions").insert({
        post_id: postId,
        user_id: currentUserId,
        emoji_id: item.id,
      });
    }
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-1 no-scrollbar">
      {FEED_EMOJI_SET.map((item) => (
        <button
          key={item.id}
          onClick={() => handleEmoji(item)}
          className="flex-shrink-0 w-11 h-11 rounded-xl bg-card border border-border flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <img src={item.src} alt={item.label} className="w-8 h-8 object-contain" />
        </button>
      ))}
    </div>
  );
};

export default FloatingEmojis;
