import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import FeedPostCard from "./FeedPostCard";
import {
  getFeedMountRadius,
  forceIosAudioSessionToPlayback,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";

interface Props {
  items: any[];
  startIndex: number;
  currentUserId?: string;
  onClose: () => void;
}

/** Fullscreen swipeable viewer scoped to a filtered rail (reels-only or posts-only). */
export default function FeedFullscreenViewer({ items, startIndex, currentUserId, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const mountRadius = getFeedMountRadius();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Snap directly to the picked item on mount.
    el.scrollTo({ top: startIndex * el.clientHeight, behavior: "auto" });
  }, [startIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let rafId = 0;
    const sync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const h = el.clientHeight;
        if (h <= 0) return;
        const next = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / h)));
        setCurrentIndex((prev) => (prev === next ? prev : next));
      });
    };
    el.addEventListener("scroll", sync, { passive: true });
    return () => {
      el.removeEventListener("scroll", sync);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [items.length]);

  return (
    <div className="fixed inset-0 z-[70] bg-black">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-[80] w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide overscroll-y-contain"
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item, index) => {
          const mounted = Math.abs(index - currentIndex) <= mountRadius;
          return (
            <div
              key={item.id}
              className="h-[100dvh] w-full snap-start snap-always relative bg-black"
              style={{ scrollSnapAlign: "start" }}
            >
              {mounted ? (
                <FeedPostCard
                  post={item}
                  currentUserId={currentUserId}
                  isActive={index === currentIndex}
                  isNear={mounted}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
