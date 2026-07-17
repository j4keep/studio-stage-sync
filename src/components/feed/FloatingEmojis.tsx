import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { EMOJI_MAP } from "@/lib/emoji-characters";
import { getYajBuddyMotion } from "@/lib/yaj-buddy-motion";

interface FloatingEmoji {
  id: number;
  emojiId: string;
  src: string;
  x: number;
}

export const useFloatingEmojis = () => {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const counterRef = useRef(0);
  const timeoutRefs = useRef<number[]>([]);

  const spawnEmoji = useCallback((emojiId: string) => {
    const src = EMOJI_MAP[emojiId];
    if (!src) return;
    const id = counterRef.current++;
    const x = 10 + Math.random() * 80;
    setEmojis((prev) => [...prev, { id, emojiId, src, x }]);
    const timeoutId = window.setTimeout(() => {
      setEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 5000);
    timeoutRefs.current.push(timeoutId);
  }, []);

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutRefs.current = [];
    };
  }, []);

  return {
    emojis,
    spawnEmoji,
  };
};

export const FloatingEmojiLayer = ({ emojis }: { emojis: FloatingEmoji[] }) => (
  <div className="absolute inset-0 pointer-events-none z-[60] overflow-visible" style={{ willChange: "transform", transform: "translateZ(0)" }}>
    {emojis.map((e) => {
      const buddyMotion = getYajBuddyMotion(e.emojiId);
      return (
        <div
          key={e.id}
          className="absolute feed-bottom-offset pointer-events-none animate-emoji-float"
          style={{ left: `${e.x}%` }}
        >
          <motion.div
            className={buddyMotion ? undefined : "animate-emoji-wobble"}
            animate={buddyMotion?.animate}
            transition={buddyMotion?.transition}
          >
            <img
              src={e.src}
              alt=""
              className="w-32 h-32 object-contain drop-shadow-lg"
              style={{ filter: "drop-shadow(0 0 8px rgba(255,165,0,0.5))" }}
            />
          </motion.div>
        </div>
      );
    })}
  </div>
);

export default useFloatingEmojis;
