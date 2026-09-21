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
import HappeningBalloon from "./HappeningBalloon";
import type { HappeningItem } from "@/lib/happening-items";

interface Props {
  items: any[];
  startIndex: number;
  currentUserId?: string;
  onClose: () => void;
  happeningItems?: HappeningItem[];
  onOpenHappening?: (item: HappeningItem) => void;
}

/** Fullscreen swipeable viewer scoped to a filtered rail (reels-only or posts-only). */
export default function FeedFullscreenViewer({ items, startIndex, currentUserId, onClose, happeningItems = [], onOpenHappening }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(startIndex);
  const activeIdRef = useRef<string | null>(items[startIndex]?.id ?? null);
  const autoAdvanceIdRef = useRef<string | null>(null);
  // A video auto-advances only the first time it finishes during this viewer session.
  // If the user swipes back to replay it, let it finish in place instead of pushing them forward again.
  const autoAdvancedIdsRef = useRef<Set<string>>(new Set());
  /** Ignore scroll-sync while we programmatically move — mid-smooth-scroll was snapping back. */
  const ignoreScrollSyncUntilRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [scrollLocked, setScrollLocked] = useState(false);
  // On phones mount ONLY the active media card. Keeping neighboring <video>/<audio>
  // decoders alive is a repeatable cause of iOS Safari audio-only/frozen-video replays.
  // Desktop still gets a neighbor on either side for smoother wheel navigation.
  const mountRadius = getFeedMountRadius();

  // Full-screen posts own the whole app viewport. Hide the app tab bar so the
  // action rail, Support/My Circle buttons, author and caption never sit behind it.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("feed-nav-toggle", { detail: { hidden: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent("feed-nav-toggle", { detail: { hidden: false } }));
    };
  }, []);

  const getSlideTop = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return null;
    const slide = el.children.item(index) as HTMLElement | null;
    return slide ? slide.offsetTop : null;
  }, []);

  const goToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return false;

    const next = Math.max(0, Math.min(items.length - 1, index));
    const targetTop = getSlideTop(next);
    const fallbackHeight = el.clientHeight || window.innerHeight || 1;
    const top = targetTop ?? next * fallbackHeight;

    ignoreScrollSyncUntilRef.current = performance.now() + (behavior === "smooth" ? 700 : 260);
    el.scrollTo({ top, behavior });
    setCurrentIndex(next);
    currentIndexRef.current = next;
    activeIdRef.current = items[next]?.id ?? activeIdRef.current;
    return true;
  }, [getSlideTop, items]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    activeIdRef.current = items[currentIndex]?.id ?? activeIdRef.current;
    autoAdvanceIdRef.current = null;

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
  }, [currentIndex, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const silenceSlide = useCallback((index: number) => {
    const root = scrollRef.current;
    const slide = root?.children.item(index) as HTMLElement | null;
    if (!slide) return;
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
  }, []);

  /** Move to the next post exactly once when the active video ends. */
  const advanceAfterVideo = useCallback((sourceIndex: number, sourceId: string): boolean => {
    if (scrollLocked) return false;

    const cur = currentIndexRef.current;
    const current = items[cur];

    // Ignore late events from pre-mounted neighbors.
    if (sourceIndex !== cur) return true;
    if (current?.id !== sourceId) return true;
    if (current?.itemType === "battle") return false;
    if (cur >= items.length - 1) {
      silenceSlide(cur);
      return false;
    }

    if (autoAdvancedIdsRef.current.has(sourceId)) {
      silenceSlide(cur);
      return false;
    }
    if (autoAdvanceIdRef.current === sourceId) return true;
    autoAdvanceIdRef.current = sourceId;
    autoAdvancedIdsRef.current.add(sourceId);

    // Kill the finished card's media before changing slides. This prevents the
    // iOS case where the audio element keeps running while the finished video
    // remains visually frozen on its last frame.
    silenceSlide(cur);

    forceIosAudioSessionToPlayback();
    const advanced = goToIndex(cur + 1, "auto");
    if (!advanced) {
      autoAdvanceIdRef.current = null;
      return false;
    }

    // Reassert the exact snap target after layout settles. 100dvh can differ from
    // the scroll container height while Safari's browser chrome expands/collapses.
    window.requestAnimationFrame(() => {
      if (currentIndexRef.current !== cur + 1) return;
      const el = scrollRef.current;
      const top = getSlideTop(cur + 1);
      if (el && top != null && Math.abs(el.scrollTop - top) > 2) {
        ignoreScrollSyncUntilRef.current = performance.now() + 220;
        el.scrollTo({ top, behavior: "auto" });
      }
    });

    return true;
  }, [getSlideTop, goToIndex, items, scrollLocked, silenceSlide]);

  // Jump to the opened index after layout.
  useEffect(() => {
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();

    let cancelled = false;
    const jump = () => {
      if (cancelled) return;
      const el = scrollRef.current;
      if (!el) return;
      const next = Math.max(0, Math.min(items.length - 1, startIndex));
      const top = getSlideTop(next);
      if (top == null) return;
      ignoreScrollSyncUntilRef.current = performance.now() + 240;
      el.scrollTo({ top, behavior: "auto" });
      setCurrentIndex(next);
      currentIndexRef.current = next;
      activeIdRef.current = items[next]?.id ?? null;
      autoAdvanceIdRef.current = null;
    };

    jump();
    const raf1 = window.requestAnimationFrame(jump);
    const raf2 = window.requestAnimationFrame(() => window.requestAnimationFrame(jump));
    const t1 = window.setTimeout(jump, 50);
    const t2 = window.setTimeout(jump, 220);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [getSlideTop, startIndex, items.length]); // eslint-disable-line react-hooks/exhaustive-deps -- open jump only

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        rearmFeedAudioAfterForeground();
      } else {
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
      if (performance.now() < ignoreScrollSyncUntilRef.current) return;
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        if (performance.now() < ignoreScrollSyncUntilRef.current) return;

        const slides = Array.from(el.children) as HTMLElement[];
        if (slides.length === 0) return;
        const top = el.scrollTop;
        let next = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        slides.forEach((slide, index) => {
          const distance = Math.abs(slide.offsetTop - top);
          if (distance < bestDistance) {
            bestDistance = distance;
            next = index;
          }
        });
        next = Math.min(items.length - 1, Math.max(0, next));
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
    <div className="feed-viewer-root fixed inset-0 z-[90] bg-black">
      <button
        onClick={handleClose}
        aria-label="Close"
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-[80] w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white"
      >
        <X className="w-5 h-5" />
      </button>

      {onOpenHappening && happeningItems.length > 0 ? (
        <HappeningBalloon
          items={happeningItems}
          currentSourceId={items[currentIndex]?.itemType === "post" ? items[currentIndex]?.id : null}
          onOpen={onOpenHappening}
        />
      ) : null}

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
              style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
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
                    onVideoEnded={() => advanceAfterVideo(index, item.id)}
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
