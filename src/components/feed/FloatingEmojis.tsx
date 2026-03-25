import { useState, useCallback, useEffect, useRef } from "react";
import { FEED_EMOJI_SET, EMOJI_MAP, type EmojiCharacter } from "@/lib/emoji-characters";
import { supabase } from "@/integrations/supabase/client";

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
    {emojis.map((e) => (
      <div
        key={e.id}
        className="absolute bottom-16 pointer-events-none animate-emoji-float"
        style={{ left: `${e.x}%` }}
      >
        <div className="animate-emoji-wobble">
          <img
            src={e.src}
            alt=""
            className="w-32 h-32 object-contain drop-shadow-lg"
            style={{ filter: "drop-shadow(0 0 8px rgba(255,165,0,0.5))" }}
          />
        </div>
      </div>
    ))}
  </div>
);

export const EmojiBar = ({
  onEmoji,
  postId,
  currentUserId,
  onSent,
}: {
  onEmoji: (emojiId: string) => void;
  postId?: string;
  currentUserId?: string;
  onSent?: () => void;
}) => {
  const handleEmoji = async (item: EmojiCharacter) => {
    onEmoji(item.id);
    if (postId && currentUserId) {
      await (supabase as any).from("post_reactions").insert({
        post_id: postId,
        user_id: currentUserId,
        emoji_id: item.id,
      });
      // Register as a comment using the :id: format so it renders as an emoji image
      await (supabase as any).from("post_comments").insert({
        post_id: postId,
        user_id: currentUserId,
        content: `:${item.id}:`,
      });
    }
    onSent?.();
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1 px-1 no-scrollbar">
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

export default useFloatingEmojis;
