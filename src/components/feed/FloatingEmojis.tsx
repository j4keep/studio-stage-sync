import { useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
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

  const spawnEmoji = useCallback((emojiId: string) => {
    const src = EMOJI_MAP[emojiId];
    if (!src) return;

    const id = counterRef.current++;
    const x = 10 + Math.random() * 70;

    setEmojis((prev) => [...prev, { id, emojiId, src, x }]);

    window.setTimeout(() => {
      setEmojis((prev) => prev.filter((emoji) => emoji.id !== id));
    }, 5000);
  }, []);

  const floatingLayer = useMemo(() => {
    if (typeof document === "undefined") return null;

    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
        {emojis.map((emoji) => (
          <div
            key={emoji.id}
            className="pointer-events-none fixed bottom-28 animate-emoji-float"
            style={{
              left: `${emoji.x}%`,
              willChange: "transform, opacity",
              transform: "translate3d(0, 0, 0)",
            }}
          >
            <div className="animate-emoji-wobble" style={{ willChange: "transform" }}>
              <img
                src={emoji.src}
                alt=""
                className="h-32 w-32 object-contain drop-shadow-lg"
                style={{ filter: "drop-shadow(0 0 8px rgba(255,165,0,0.5))" }}
              />
            </div>
          </div>
        ))}
      </div>,
      document.body,
    );
  }, [emojis]);

  return {
    spawnEmoji,
    floatingLayer,
  };
};

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

      await (supabase as any).from("post_comments").insert({
        post_id: postId,
        user_id: currentUserId,
        content: `:${item.id}:`,
      });
    }

    onSent?.();
  };

  return (
    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-1 py-1">
      {FEED_EMOJI_SET.map((item) => (
        <button
          key={item.id}
          onClick={() => handleEmoji(item)}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card transition-transform hover:scale-110 active:scale-95"
        >
          <img src={item.src} alt={item.label} className="h-8 w-8 object-contain" />
        </button>
      ))}
    </div>
  );
};

export default FloatingEmojis;
