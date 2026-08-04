import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import FeedPostCard from "./FeedPostCard";
import BattleFeedSlide from "./BattleFeedSlide";
import {
  getFeedMountRadius,
  forceIosAudioSessionToPlayback,
  rearmFeedAudioAfterForeground,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";
import { stopAllPageMedia } from "@/lib/stop-page-media";

interface Props {
  items: any[];
  startIndex: number;
  currentUserId?: string;
  onClose: () => void;
}

/** Fullscreen swipeable viewer scoped to a filtered rail (reels-only or posts-only). */
export default function FeedFullscreenViewer({ items, startIndex, currentUserId, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(startIndex);
  const activeIdRef = useRef<string | null>(items[startIndex]?.id ?? null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [scrollLocked, setScrollLocked] = useState(false);
  const mountRadius = getFeedMountRadius();

  const goToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    const h = el.clientHeight || 1;
    const next = Math.max(0, Math.min(items.length - 1, index));
    el.scrollTo({ top: next * h, behavior });
    setCurrentIndex(next);
    currentIndexRef.current = next;
    activeIdRef.current = items[next]?.id ?? activeIdRef.current;
  }, [items]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    activeIdRef.current = items[currentIndex]?.id ?? activeIdRef.current;
    // Immediately mute/pause non-active slides so audio can't leak across swipes.
    const root = scrollRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".snap-start").forEach((slide, i) => {
      if (i === currentIndex) return;
      slide.querySelectorAll("video, audio").forEach((node) => {
        const media = node as HTMLMediaElement;
        try {
          media.pause();
          media.muted = true;
          media.volume = 0;
        } catch {
          /* ignore */
        }
      });
    });
  }, [currentIndex, items]);

  // If the feed list refetches/reorders, stay on the same item by id (don't bounce).
  useEffect(() => {
    const id = activeIdRef.current;
    if (!id || items.length === 0) return;
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    if (idx === currentIndexRef.current) return;
    goToIndex(idx, "auto");
  }, [items, goToIndex]);

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

  /** After a regular video ends, swipe up to the next post (not used for battles). */
  const advanceAfterVideo = useCallback(() => {
    if (scrollLocked) return;
    const cur = currentIndexRef.current;
    const current = items[cur];
    // Battles must never auto-advance — that fought snap-scroll and froze neighbors.
    if (current?.itemType === "battle") return;
    if (cur >= items.length - 1) return;
    forceIosAudioSessionToPlayback();
    goToIndex(cur + 1, "smooth");
  }, [goToIndex, items, scrollLocked]);

  useEffect(() => {
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: startIndex * el.clientHeight, behavior: "auto" });
    setCurrentIndex(startIndex);
    currentIndexRef.current = startIndex;
    activeIdRef.current = items[startIndex]?.id ?? null;
  }, [startIndex]); // eslint-disable-line react-hooks/exhaustive-deps -- only jump on open index

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        rearmFeedAudioAfterForeground();
      } else {
        // Backgrounding the app should silence everything immediately.
        stopAllPageMedia();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, []);

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
        const next = Math.min(
          items.length - 1,
          Math.max(0, Math.round(el.scrollTop / h)),
        );
        setCurrentIndex((prev) => (prev === next ? prev : next));
      });
    };
    el.addEventListener("scroll", sync, { passive: true });
    return () => {
      el.removeEventListener("scroll", sync);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [items.length, scrollLocked]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrollLocked) return;
    const block = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-feed-comments-sheet], [data-allow-scroll]")) return;
      e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [scrollLocked]);

  useEffect(() => {
    return () => {
      stopAllPageMedia();
      lockScroll(false);
    };
  }, [lockScroll]);

  const handleClose = useCallback(() => {
    stopAllPageMedia();
    lockScroll(false);
    onClose();
  }, [onClose, lockScroll]);

  return (
    <div className="feed-viewer-root fixed inset-0 z-[70] bg-black">
      <button
        onClick={handleClose}
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
                    onVideoEnded={advanceAfterVideo}
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
