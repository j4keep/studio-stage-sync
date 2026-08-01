import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import FeedPostCard from "./FeedPostCard";
import BattleFeedSlide from "./BattleFeedSlide";
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
  const [scrollLocked, setScrollLocked] = useState(false);
  const mountRadius = getFeedMountRadius();

  const lockScroll = useCallback((locked: boolean) => {
    setScrollLocked(locked);
    const el = scrollRef.current;
    if (!el) return;
    if (locked) {
      el.style.overflowY = "hidden";
      el.style.touchAction = "none";
      el.style.scrollSnapType = "none";
    } else {
      el.style.overflowY = "";
      el.style.touchAction = "";
      el.style.scrollSnapType = "y mandatory";
    }
  }, []);

  useEffect(() => {
    // Opening the fullscreen viewer is itself a user-gesture-triggered navigation,
    // so unlock the iOS audio session and force "playback" routing immediately.
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: startIndex * el.clientHeight, behavior: "auto" });
  }, [startIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let rafId = 0;
    const sync = () => {
      if (scrollLocked) return;
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
  }, [items.length, scrollLocked]);

  // Hard-block touch scrolling while comments are open (inline style alone can lose to iOS).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrollLocked) return;
    const block = (e: TouchEvent) => {
      // Allow scrolling inside the comments sheet / nested scroll areas.
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-feed-comments-sheet], [data-allow-scroll]")) return;
      e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [scrollLocked]);

  useEffect(() => {
    return () => lockScroll(false);
  }, [lockScroll]);

  return (
    <div className="feed-viewer-root fixed inset-0 z-[70] bg-black">
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
                item?.itemType === "battle" ? (
                  <BattleFeedSlide
                    battle={item}
                    currentUserId={currentUserId}
                    isActive={index === currentIndex}
                    onScrollLockChange={lockScroll}
                  />
                ) : (
                  <FeedPostCard
                    post={item}
                    currentUserId={currentUserId}
                    isActive={index === currentIndex}
                    isNear={mounted}
                  />
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
