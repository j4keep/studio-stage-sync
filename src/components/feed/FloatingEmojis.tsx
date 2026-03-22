import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJI_SET = ["🔥", "❤️", "💯", "🎵", "🎤", "👑", "💎", "⚡", "🙌", "😍", "🤩", "💥"];

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
}

interface FloatingEmojisProps {
  containerRef?: React.RefObject<HTMLDivElement>;
}

const FloatingEmojis = ({ containerRef }: FloatingEmojisProps) => {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const [counter, setCounter] = useState(0);

  const spawnEmoji = useCallback((emoji: string) => {
    const id = counter;
    const x = 10 + Math.random() * 80; // random horizontal position 10-90%
    setCounter((c) => c + 1);
    setEmojis((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2000);
  }, [counter]);

  return {
    emojis,
    spawnEmoji,
    FloatingLayer: () => (
      <AnimatePresence>
        {emojis.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -280, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            className="absolute bottom-16 pointer-events-none z-50"
            style={{ left: `${e.x}%` }}
          >
            <span className="text-4xl drop-shadow-lg">{e.emoji}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    ),
  };
};

export const EmojiBar = ({ onEmoji }: { onEmoji: (emoji: string) => void }) => {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-1 no-scrollbar">
      {EMOJI_SET.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onEmoji(emoji)}
          className="flex-shrink-0 w-11 h-11 rounded-xl bg-card border border-border flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <span className="text-2xl">{emoji}</span>
        </button>
      ))}
    </div>
  );
};

export default FloatingEmojis;
