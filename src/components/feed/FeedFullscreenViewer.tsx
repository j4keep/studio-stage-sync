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
  /** Ignore scroll-sync while we programmatically move — mid-smooth-scroll was snapping back. */
  const ignoreScrollSyncUntilRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [scrollLocked, setScrollLocked] = useState(false);
  // Pre-mount ±1 on phones so swipe/auto-advance isn't a black cold-start.
  // Radius 0 left the next snap shell empty until mount → dark frame + frozen play.
  const mountRadius = Math.max(1, getFeedMountRadius());

  const goToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return false;
    const h = el.clientHeight || window.innerHeight || 1;
    const next = Math.max(0, Math.min(items.length - 1, index));
    ignoreScrollSyncUntilRef.current = performance.now() + (behavior === "smooth" ? 650 : 120);
    el.scrollTo({ top: next * h, behavior });
    setCurrentIndex(next);
    currentIndexRef.current = next;
    activeIdRef.current = items[next]?.id ?? activeIdRef.current;
    return true;
  }, [items]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    activeIdRef.current = items[currentIndex]?.id ?? activeIdRef.current;
    // Immediately mute/pause non-active slides so audio can't leak across swipes.
    // Depend on length (not items identity) so feed refetches don't remute/pause
    // the active post mid-play.
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

  /** After a regular video ends, swipe up to the next post. Returns false if stuck on last. */
  const advanceAfterVideo = useCallback((): boolean => {
    if (scrollLocked) return false;
    const cur = currentIndexRef.current;
    const current = items[cur];
    // Battles must never auto-advance — that fought snap-scroll and froze neighbors.
    if (current?.itemType === "battle") return false;
    if (cur >= items.length - 1) return false;
    forceIosAudioSessionToPlayback();
    // Instant jump is more reliable than smooth on mobile snap scrollers —
    // smooth mid-frames were rounded back to the finished video (looked like a loop).
    return goToIndex(cur + 1, "auto");
  }, [goToIndex, items, scrollLocked]);

  // Jump to the opened index after layout. Opening from Happening often hit
  // clientHeight=0 on first paint → scroll stayed at 0 while currentIndex was N,
  // so the on-screen slide was frozen/empty while the real active video was off-screen.
  useEffect(() => {
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();

    let cancelled = false;
    const jump = () => {
      if (cancelled) return;
      const el = scrollRef.current;
      if (!el) return;
      const h = el.clientHeight || window.innerHeight || 0;
      if (h <= 0) return;
      const next = Math.max(0, Math.min(items.length - 1, startIndex));
      ignoreScrollSyncUntilRef.current = performance.now() + 200;
      el.scrollTo({ top: next * h, behavior: "auto" });
      setCurrentIndex(next);
      currentIndexRef.current = next;
      activeIdRef.current = items[next]?.id ?? null;
    };

    jump();
    const raf1 = window.requestAnimationFrame(jump);
    const raf2 = window.requestAnimationFrame(() => window.requestAnimationFrame(jump));
    const t1 = window.setTimeout(jump, 50);
    const t2 = window.setTimeout(jump, 200);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [startIndex, items.length]); // eslint-disable-line react-hooks/exhaustive-deps -- open jump only

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
      if (performance.now() < ignoreScrollSyncUntilRef.current) return;
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        if (performance.now() < ignoreScrollSyncUntilRef.current) return;
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
