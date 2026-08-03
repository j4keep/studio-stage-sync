import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { readMediaDuration, resolveMediaDuration } from "@/lib/media-duration";
import {
  forceIosAudioSessionToPlayback,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";

type Props = {
  src: string;
  leftName: string;
  rightName: string;
  /** Optional external ref (feed seek chrome can share the master video). */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Hide built-in transport when parent already owns a seek bar. */
  hideTransport?: boolean;
  className?: string;
  /** Card list / battles page — slightly tighter. */
  compact?: boolean;
  /** Keep feed double-tap expand working. */
  onExpandSide?: (side: "left" | "right") => void;
};

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/**
 * Completed live-debate replay: dual VS cards + scrubber / play controls
 * (post page, battle page, and creator battle card).
 */
export default function LiveBattleReplayPlayer({
  src,
  leftName,
  rightName,
  videoRef,
  hideTransport = false,
  className = "",
  compact = false,
  onExpandSide,
}: Props) {
  const masterRef = useRef<HTMLVideoElement | null>(null);
  const slaveRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  const [playing, setPlaying] = useState(true);
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
        setPlaying(!master.paused);
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
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)));
    seekTo(pct);

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
      const master = masterRef.current;
      if (master && master.paused) void master.play().catch(() => undefined);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  const togglePlay = () => {
    const master = masterRef.current;
    if (!master) return;
    forceIosAudioSessionToPlayback();
    void unlockFeedAudioSession();
    if (master.paused) {
      void master.play().catch(() => undefined);
      setPlaying(true);
    } else {
      master.pause();
      setPlaying(false);
    }
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

  const skip = (delta: number) => {
    const master = masterRef.current;
    if (!master) return;
    const d = readMediaDuration(master) || duration;
    const next = Math.max(0, Math.min(d || master.currentTime + delta, master.currentTime + delta));
    master.currentTime = d > 0 ? Math.max(0, Math.min(d, master.currentTime + delta)) : Math.max(0, next);
    setCurrent(master.currentTime);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const remaining = Math.max(0, duration - current);
  const tileH = compact ? "aspect-[4/5]" : "aspect-[3/4] max-h-[min(52dvh,420px)]";

  return (
    <div className={`w-full ${className}`}>
      <div className={`relative flex w-full items-center justify-center gap-1.5 ${compact ? "" : ""}`}>
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
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5">
            <p className="text-sm font-black text-white drop-shadow">{leftName}</p>
          </div>
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
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5">
            <p className="text-sm font-black text-white drop-shadow">{rightName}</p>
          </div>
        </div>
      </div>

      {!hideTransport ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-neutral-900/95 px-2.5 py-2 ring-1 ring-white/10">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/70">{fmt(current)}</span>
            <div
              ref={trackRef}
              className="relative h-7 flex-1 cursor-pointer touch-none"
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
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/20">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-white"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
              </div>
            </div>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/70">
              -{fmt(remaining)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
              aria-label="Back 10 seconds"
              onClick={(e) => {
                e.stopPropagation();
                skip(-10);
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black"
              aria-label={playing ? "Pause" : "Play"}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
            >
              {playing ? <Pause className="h-4 w-4 fill-black" /> : <Play className="h-4 w-4 fill-black" />}
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
              aria-label="Forward 10 seconds"
              onClick={(e) => {
                e.stopPropagation();
                skip(10);
              }}
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
