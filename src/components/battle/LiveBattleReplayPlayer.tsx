import { useCallback, useEffect, useRef, useState } from "react";
import { readMediaDuration, resolveMediaDuration } from "@/lib/media-duration";
import {
  applyFeedVideoAudio,
  armFeedAudioPlayback,
  forceIosAudioSessionToPlayback,
  unlockFeedAudioSession,
  waitForVideoCanPlay,
} from "@/lib/feed-video-playback";
import BattleWinnerCheckBadge from "@/components/battle/BattleWinnerCheckBadge";

type Props = {
  src: string;
  leftName: string;
  rightName: string;
  /** Shown until the Zoom recording paints its first frame (avoids black card). */
  leftCoverUrl?: string | null;
  rightCoverUrl?: string | null;
  /** Optional external ref (feed bottom seek chrome drives this master). */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /**
   * When true, no built-in progress bar (feed post already has one at the bottom).
   * When false, show a clean scrubber under the cards (battle page / battle card).
   */
  hideProgress?: boolean;
  className?: string;
  /** Card list / battles page — slightly tighter. */
  compact?: boolean;
  /** Double-tap a side to expand that person only (kept for API compat). */
  onExpandSide?: (side: "left" | "right") => void;
  /** Election-style check on the winner after voting closes. */
  winnerSide?: "left" | "right" | null;
  /** Feed posts: play once. Battle page can keep looping. */
  loop?: boolean;
  onEnded?: () => void;
};

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/**
 * Zoom/FaceTime-style replay of a recorded live debate.
 * ONE decoder plays the side-by-side recording — same idea as watching a Zoom cloud recording.
 * Dual same-src <video> elements were freezing picture while the progress bar still moved.
 */
export default function LiveBattleReplayPlayer({
  src,
  leftName,
  rightName,
  leftCoverUrl,
  rightCoverUrl,
  videoRef,
  hideProgress = false,
  className = "",
  compact = false,
  winnerSide = null,
  loop = true,
  onEnded,
}: Props) {
  const masterRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const durationProbedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const endedSentRef = useRef(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** Hide cover sheets only after a real decoded frame is on screen. */
  const [hasFrame, setHasFrame] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const setMaster = useCallback(
    (el: HTMLVideoElement | null) => {
      masterRef.current = el;
      if (videoRef) (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    },
    [videoRef],
  );

  const togglePlay = useCallback(() => {
    const master = masterRef.current;
    if (!master) return;
    forceIosAudioSessionToPlayback();
    void unlockFeedAudioSession();
    if (master.paused) {
      armFeedAudioPlayback(master, { title: `${leftName} vs ${rightName}` });
      void master.play().then(() => setPlaying(true)).catch(() => undefined);
    } else {
      master.pause();
      setPlaying(false);
    }
  }, [leftName, rightName]);

  useEffect(() => {
    const master = masterRef.current;
    if (!master) return;
    durationProbedRef.current = false;
    endedSentRef.current = false;
    setHasFrame(false);
    setLoadFailed(false);
    forceIosAudioSessionToPlayback();
    void unlockFeedAudioSession();
    master.playsInline = true;
    master.loop = loop;
    master.preload = "auto";
    master.style.transform = "translateZ(0)";

    let cancelled = false;
    const markFrame = () => {
      if (cancelled) return;
      if (master.videoWidth > 0 && master.readyState >= 2) {
        setHasFrame(true);
      }
    };
    const start = async () => {
      const ready = await waitForVideoCanPlay(master);
      if (cancelled) return;
      if (!ready) {
        setLoadFailed(true);
        return;
      }
      try {
        armFeedAudioPlayback(master, { title: `${leftName} vs ${rightName}` });
        await master.play();
        if (!cancelled) {
          setPlaying(true);
          markFrame();
        }
      } catch {
        try {
          applyFeedVideoAudio(master, { muted: true });
          await master.play();
          armFeedAudioPlayback(master, { title: `${leftName} vs ${rightName}` });
          if (!cancelled) {
            setPlaying(true);
            markFrame();
          }
        } catch {
          /* gesture may still be required — covers stay visible */
        }
      }
    };
    void start();

    const tryProbe = () => {
      if (durationProbedRef.current) return;
      const d = readMediaDuration(master);
      if (d > 0) {
        durationProbedRef.current = true;
        setDuration(d);
        return;
      }
      // Never seek while mid-play — that froze phones.
      if (!master.paused && master.currentTime > 0.2) return;
      durationProbedRef.current = true;
      void resolveMediaDuration(master).then((resolved) => {
        if (resolved > 0) setDuration(resolved);
        else durationProbedRef.current = false;
      });
    };
    const onMasterEnded = () => {
      if (loop || endedSentRef.current) return;
      endedSentRef.current = true;
      setPlaying(false);
      onEndedRef.current?.();
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      if (!cancelled) setLoadFailed(true);
    };
    master.addEventListener("loadedmetadata", tryProbe);
    master.addEventListener("durationchange", tryProbe);
    master.addEventListener("loadeddata", markFrame);
    master.addEventListener("playing", markFrame);
    master.addEventListener("ended", onMasterEnded);
    master.addEventListener("play", onPlay);
    master.addEventListener("pause", onPause);
    master.addEventListener("error", onError);
    tryProbe();
    const failTimer = window.setTimeout(() => {
      if (!cancelled && master.readyState < 2 && !(master.videoWidth > 0)) {
        setLoadFailed(true);
      }
    }, 6000);
    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      master.removeEventListener("loadedmetadata", tryProbe);
      master.removeEventListener("durationchange", tryProbe);
      master.removeEventListener("loadeddata", markFrame);
      master.removeEventListener("playing", markFrame);
      master.removeEventListener("ended", onMasterEnded);
      master.removeEventListener("play", onPlay);
      master.removeEventListener("pause", onPause);
      master.removeEventListener("error", onError);
      master.pause();
    };
  }, [src, loop, leftName, rightName]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const master = masterRef.current;
      if (!master) return;
      forceIosAudioSessionToPlayback();
      if (master.paused) void master.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, [src]);

  useEffect(() => {
    const master = masterRef.current;
    if (!master) return;
    let id = 0;
    const tick = () => {
      if (!scrubbing) {
        const d = readMediaDuration(master);
        if (d > 0) setDuration(d);
        setCurrent(master.currentTime || 0);
      }
      id = window.setTimeout(tick, 125);
    };
    id = window.setTimeout(tick, 125);
    return () => window.clearTimeout(id);
  }, [src, scrubbing]);

  const seekTo = (pct: number) => {
    const master = masterRef.current;
    if (!master) return;
    const d = readMediaDuration(master);
    if (d <= 0) {
      void resolveMediaDuration(master).then((resolved) => {
        if (resolved <= 0) return;
        master.currentTime = pct * resolved;
        setCurrent(pct * resolved);
        setDuration(resolved);
      });
      return;
    }
    master.currentTime = pct * d;
    setCurrent(pct * d);
    setDuration(d);
  };

  const onScrubStart = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    setScrubbing(true);
    const rect = track.getBoundingClientRect();
    seekTo(Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1))));

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const x = "touches" in ev ? ev.touches[0]?.clientX : ev.clientX;
      if (typeof x === "number") {
        const r = track.getBoundingClientRect();
        seekTo(Math.max(0, Math.min(1, (x - r.left) / Math.max(r.width, 1))));
      }
    };
    const onEnd = () => {
      setScrubbing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      const master = masterRef.current;
      if (master && master.paused && playing) {
        void master.play().catch(() => undefined);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const frameH = compact ? "aspect-[3/2] max-h-[min(48dvh,380px)]" : "aspect-[3/2] max-h-[min(56dvh,460px)]";
  const showCovers = (!hasFrame || loadFailed) && !!(leftCoverUrl || rightCoverUrl);

  return (
    <div className={`w-full ${className}`}>
      {/* One full Zoom-style recording frame — left | right already baked into the file. */}
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/15 ${frameH}`}
      >
        {showCovers ? (
          <div className="absolute inset-0 z-[1] grid grid-cols-2 bg-black">
            <div className="relative h-full w-full overflow-hidden border-r border-white/20">
              {leftCoverUrl ? (
                <img src={leftCoverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-700/50 to-neutral-950" />
              )}
            </div>
            <div className="relative h-full w-full overflow-hidden">
              {rightCoverUrl ? (
                <img src={rightCoverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-pink-700/50 to-neutral-950" />
              )}
            </div>
          </div>
        ) : null}

        <video
          ref={setMaster}
          src={src}
          playsInline
          loop={loop}
          preload="auto"
          className={`absolute inset-0 z-[1] h-full w-full object-contain bg-black transition-opacity duration-200 ${
            hasFrame && !loadFailed ? "opacity-100" : "opacity-0"
          }`}
          style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-2.5 pb-6 pt-2">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            Replay
          </span>
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black tracking-widest text-white/90">
            VS
          </span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8">
          <div className="min-w-0 flex-1 pr-2">
            <p className="truncate text-sm font-black text-cyan-300 drop-shadow">{leftName}</p>
            {winnerSide === "left" ? (
              <div className="mt-1">
                <BattleWinnerCheckBadge size="sm" />
              </div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pl-2 text-right">
            <p className="truncate text-sm font-black text-pink-400 drop-shadow">{rightName}</p>
            {winnerSide === "right" ? (
              <div className="mt-1 flex justify-end">
                <BattleWinnerCheckBadge size="sm" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!hideProgress ? (
        <div className="mt-2 px-0.5 pt-0.5">
          <div
            ref={trackRef}
            className="relative h-7 w-full cursor-pointer touch-none"
            onMouseDown={(e) => {
              e.stopPropagation();
              onScrubStart(e.clientX);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const x = e.touches[0]?.clientX;
              if (typeof x === "number") onScrubStart(x);
            }}
            role="slider"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Seek replay"
          >
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-black/15">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-foreground/80"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-foreground shadow"
                style={{ left: `calc(${progress}% - 5px)` }}
              />
            </div>
          </div>
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
