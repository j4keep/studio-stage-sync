import { useState, useCallback, useEffect, useRef } from "react";
import { Smile } from "lucide-react";
import { EMOJI_CHARACTERS, EMOJI_MAP, type EmojiCharacter } from "@/lib/emoji-characters";
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
        className="absolute feed-bottom-offset pointer-events-none animate-emoji-float"
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

/** Legacy horizontal bar — kept for comments sheet compatibility. */
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
    <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 scrollbar-hide max-w-full">
      {EMOJI_CHARACTERS.slice(0, 12).map((item) => (
        <button
          key={item.id}
          onClick={() => handleEmoji(item)}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <img src={item.src} alt={item.label} className="w-7 h-7 object-contain" />
        </button>
      ))}
    </div>
  );
};

export const EmojiReactionTray = ({
  open,
  onClose,
  onEmoji,
  postId,
  currentUserId,
  reactionCount,
  onReactionCountChange,
}: {
  open: boolean;
  onClose: () => void;
  onEmoji: (emojiId: string) => void;
  postId?: string;
  currentUserId?: string;
  reactionCount?: number;
  onReactionCountChange?: (n: number) => void;
}) => {
  const handleEmoji = async (item: EmojiCharacter) => {
    onEmoji(item.id);
    onReactionCountChange?.((reactionCount ?? 0) + 1);
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
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} aria-hidden />
      <div
        className="absolute right-0 bottom-full mb-2 z-[71] w-[min(18rem,calc(100vw-5rem))] max-h-[min(16rem,50vh)] overflow-y-auto scrollbar-hide rounded-2xl border border-white/15 bg-black/85 backdrop-blur-xl p-3 shadow-2xl"
        role="dialog"
        aria-label="Choose a reaction"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-2 px-0.5">React</p>
        <div className="grid grid-cols-4 gap-2">
          {EMOJI_CHARACTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleEmoji(item)}
              className="flex flex-col items-center gap-0.5 rounded-xl bg-white/5 border border-white/10 p-1.5 hover:bg-white/15 active:scale-95 transition-all"
            >
              <img src={item.src} alt={item.label} className="w-9 h-9 object-contain" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export const EmojiReactionButton = ({
  onClick,
  count,
}: {
  onClick: () => void;
  count: number;
}) => (
  <button onClick={onClick} className="feed-action-btn relative" aria-label="React with emoji">
    <Smile className="feed-action-icon" />
    {count > 0 && <span className="feed-action-count">{count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K` : count}</span>}
  </button>
);

export default useFloatingEmojis;
