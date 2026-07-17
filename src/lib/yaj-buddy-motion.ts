import type { MotionProps } from "framer-motion";

type BuddyMotion = Pick<MotionProps, "animate" | "transition">;

const BUDDY_MOTIONS: Record<string, BuddyMotion> = {
  "yaj-wave": {
    animate: {
      rotate: [0, -18, 14, -16, 12, 0],
      x: [0, -4, 4, -3, 3, 0],
      transformOrigin: "50% 80%",
    },
    transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" },
  },
  "yaj-peace": {
    animate: {
      x: [0, 14, 30, 16, 0],
      y: [0, -18, -5, -24, 0],
      rotate: [0, 5, -3, 4, 0],
    },
    transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
  },
  "yaj-love": {
    animate: {
      scale: [0.75, 1.35, 0.92, 1.18, 1],
      y: [4, -10, 0, -5, 0],
    },
    transition: { duration: 1.05, repeat: Infinity, ease: "easeInOut" },
  },
  "yaj-dance": {
    animate: {
      rotate: [0, -12, 12, -10, 10, 0],
      x: [0, -8, 8, -7, 7, 0],
      y: [0, -5, 0, -5, 0, 0],
    },
    transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
  },
  "yaj-celebrate": {
    animate: {
      y: [8, -28, -10, -36, 0],
      scale: [0.7, 1.35, 1, 1.25, 1],
      rotate: [0, -10, 12, -8, 0],
    },
    transition: { duration: 1.1, repeat: Infinity, ease: "easeOut" },
  },
};

export function getYajBuddyMotion(emojiId: string): BuddyMotion | undefined {
  return BUDDY_MOTIONS[emojiId];
}
