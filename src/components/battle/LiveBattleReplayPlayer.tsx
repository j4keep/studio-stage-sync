import { useCallback, useEffect, useRef, useState } from "react";
import { readMediaDuration, resolveMediaDuration } from "@/lib/media-duration";
import {
  forceIosAudioSessionToPlayback,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";
import BattleWinnerCheckBadge from "@/components/battle/BattleWinnerCheckBadge";

type Props = {
  src: string;
  leftName: string;
  rightName: string;
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
  /** Double-tap a side to expand that person only. */
  onExpandSide?: (side: "left" | "right") => void;
  /** Election-style check on the winner after voting closes. */
  winnerSide?: "left" | "right" | null;
};

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/**
 * Completed live-debate replay: dual VS cards.
 * Tap = play/pause. Double-tap a side = expand that side only.
 * Progress bar is either here (battle page/card) or the feed bottom chrome.
 */
export default function LiveBattleReplayPlayer({
  src,
  leftName,
  rightName,
  videoRef,
  hideProgress = false,
  className = "",
  compact = false,
  onExpandSide,
  winnerSide = null,
}: Props) {
  const masterRef = useRef<HTMLVideoElement | null>(null);
  const slaveRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

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
    if (master.paused) void master.play().catch(() => undefined);
    else master.pause();
  }, []);

  useEffect(() => {
    const master = masterRef.current;
    const slave = slaveRef.current;
    if (!master) return;
    forceIosAudioSessionToPlayback();
    master.playsInline = true;
    master.loop = true;
    master.muted = false;
    if (slave) {
      slave.muted = true;
      slave.playsInline = true;
      slave.loop = true;
      void slave.play().catch(() => undefined);
    }
    void master.play().catch(() => undefined);
    void resolveMediaDuration(master).then((d) => {
      if (d > 0) setDuration(d);
    });
  }, [src]);

  useEffect(() => {
    const master = masterRef.current;
    const slave = slaveRef.current;
    if (!master) return;

    const syncSlave = () => {
      if (!slave) return;
      if (Math.abs(slave.currentTime - master.currentTime) > 0.25) {
        try {
          slave.currentTime = master.currentTime;
        } catch {
          /* ignore */
        }
      }
      if (master.paused && !slave.paused) slave.pause();
      if (!master.paused && slave.paused) void slave.play().catch(() => undefined);
    };

    const onTick = () => {
      if (!scrubbing) {
        const d = readMediaDuration(master);
        const t = master.currentTime || 0;
        if (d > 0) setDuration(d);
        setCurrent(t);
      }
      syncSlave();
    };

    master.addEventListener("timeupdate", onTick);
    master.addEventListener("play", onTick);
    master.addEventListener("pause", onTick);
    master.addEventListener("seeked", syncSlave);
    const id = window.setInterval(onTick, 250);
    return () => {
      master.removeEventListener("timeupdate", onTick);
      master.removeEventListener("play", onTick);
      master.removeEventListener("pause", onTick);
      master.removeEventListener("seeked", syncSlave);
      window.clearInterval(id);
    };
  }, [src, scrubbing]);

  const seekTo = (pct: number) => {
    const master = masterRef.current;
    if (!master) return;
    const d = readMediaDuration(master) || duration;
    if (d <= 0) {
      void resolveMediaDuration(master).then((resolved) => {
        if (resolved <= 0) return;
        master.currentTime = pct * resolved;
        setDuration(resolved);
        setCurrent(pct * resolved);
      });
      return;
    }
    master.currentTime = pct * d;
    setCurrent(pct * d);
    setDuration(d);
    if (slaveRef.current) {
      try {
        slaveRef.current.currentTime = pct * d;
      } catch {
        /* ignore */
      }
    }
  };

  const onScrubStart = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    setScrubbing(true);
    const rect = track.getBoundingClientRect();
    seekTo(Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1))));

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const x = "touches" in ev ? ev.touches[0]?.clientX : ev.clientX;
      if (typeof x !== "number") return;
      const r = track.getBoundingClientRect();
      seekTo(Math.max(0, Math.min(1, (x - r.left) / Math.max(r.width, 1))));
    };
    const onEnd = () => {
      setScrubbing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  const handleCardTap = (side: "left" | "right") => {
    const nowTs = Date.now();
    const isDouble =
      lastTapSideRef.current === side && nowTs - lastTapRef.current < 280;
    lastTapRef.current = nowTs;
    lastTapSideRef.current = side;
    if (isDouble) {
      onExpandSide?.(side);
      return;
    }
    togglePlay();
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const tileH = compact ? "aspect-[4/5]" : "aspect-[3/4] max-h-[min(52dvh,420px)]";

  return (
    <div className={`w-full ${className}`}>
      <div className="relative flex w-full items-center justify-center gap-1.5">
        <div
          className={`relative min-w-0 flex-1 overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-cyan-300/90 ${tileH}`}
        >
          <video
            ref={setMaster}
            src={src}
            autoPlay
            loop
            playsInline
            className="absolute inset-0 h-full w-[200%] max-w-none object-cover"
            onClick={(e) => {
              e.stopPropagation();
              handleCardTap("left");
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            Replay
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5 pr-[48%]">
            <p className="text-sm font-black text-white drop-shadow">{leftName}</p>
          </div>
          {winnerSide === "left" ? (
            <BattleWinnerCheckBadge size={compact ? "sm" : "md"} />
          ) : null}
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tracking-widest text-white ring-1 ring-white/25">
            VS
          </span>
        </div>

        <div
          className={`relative min-w-0 flex-1 overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-pink-400/90 ${tileH}`}
        >
          <video
            ref={slaveRef}
            src={src}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-[200%] max-w-none -translate-x-1/2 object-cover"
            onClick={(e) => {
              e.stopPropagation();
              handleCardTap("right");
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5 pr-[48%]">
            <p className="text-sm font-black text-white drop-shadow">{rightName}</p>
          </div>
          {winnerSide === "right" ? (
            <BattleWinnerCheckBadge size={compact ? "sm" : "md"} />
          ) : null}
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
