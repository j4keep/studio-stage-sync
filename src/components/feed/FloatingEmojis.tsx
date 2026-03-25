import { useCallback } from "react";
import { FEED_EMOJI_SET, EMOJI_MAP, type EmojiCharacter } from "@/lib/emoji-characters";
import { supabase } from "@/integrations/supabase/client";

interface FloatingEmojisProps {
  postId?: string;
}

const FloatingEmojis = ({ postId }: FloatingEmojisProps) => {
  const spawnEmoji = useCallback((emojiId: string) => {
    const src = EMOJI_MAP[emojiId];
    if (!src || typeof document === "undefined") return;

    const wrapper = document.createElement("div");
    const image = document.createElement("img");
    const left = 10 + Math.random() * 70;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const duration = prefersReducedMotion ? 2200 : 4500;

    wrapper.setAttribute("data-floating-emoji", emojiId);
    wrapper.style.position = "fixed";
    wrapper.style.left = `${left}%`;
    wrapper.style.bottom = "112px";
    wrapper.style.zIndex = "140";
    wrapper.style.pointerEvents = "none";
    wrapper.style.willChange = "transform, opacity";
    wrapper.style.transform = "translateX(-50%) translateY(0) scale(0.5)";
    wrapper.style.opacity = "1";

    image.src = src;
    image.alt = "";
    image.style.width = "128px";
    image.style.height = "128px";
    image.style.objectFit = "contain";
    image.style.filter = "drop-shadow(0 0 8px rgba(255,165,0,0.5))";
    image.style.willChange = "transform";

    wrapper.appendChild(image);
    document.body.appendChild(wrapper);

    const floatAnimation = wrapper.animate(
      [
        { transform: "translateX(-50%) translateY(0) scale(0.5)", opacity: 1 },
        { transform: "translateX(-50%) translateY(-280px) scale(1.4)", opacity: 0.75, offset: 0.8 },
        { transform: "translateX(-50%) translateY(-360px) scale(1.8)", opacity: 0 },
      ],
      {
        duration,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );

    const wobbleAnimation = image.animate(
      [
        { transform: "rotate(0deg) scaleX(1) scaleY(1)" },
        { transform: "rotate(-8deg) scaleX(1.05) scaleY(0.95)" },
        { transform: "rotate(8deg) scaleX(0.95) scaleY(1.05)" },
        { transform: "rotate(-6deg) scaleX(1) scaleY(1)" },
        { transform: "rotate(6deg) scaleX(1.02) scaleY(0.98)" },
        { transform: "rotate(0deg) scaleX(1) scaleY(1)" },
      ],
      {
        duration: 500,
        iterations: prefersReducedMotion ? 1 : Math.ceil(duration / 500),
        easing: "ease-in-out",
      },
    );

    window.setTimeout(() => {
      floatAnimation.cancel();
      wobbleAnimation.cancel();
      wrapper.remove();
    }, duration + 150);
  }, []);

  return {
    spawnEmoji,
    floatingLayer: null,
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
