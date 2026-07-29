import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { DemoClip } from "@/lib/wellness";

type Props = {
  demo?: DemoClip | null;
  /** Shown under the video — current step instruction */
  caption?: string;
  stepLabel?: string;
  /** Keep video muted by default so Buddy voice can coach */
  className?: string;
  playing?: boolean;
};

/**
 * Step-synced form demo player for Move / Relax.
 * Muted by default (Buddy speaks). Swap demo.videoUrl later for AI/instructor clips.
 */
export default function ExerciseDemoPlayer({
  demo,
  caption,
  stepLabel,
  className = "",
  playing = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    const el = videoRef.current;
    if (!el || !demo?.videoUrl) return;
    el.load();
    if (playing) {
      void el.play().catch(() => {
        /* autoplay may require mute — already muted */
      });
    } else {
      el.pause();
    }
  }, [demo?.videoUrl, playing]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [playing]);

  if (!demo?.videoUrl) {
    return (
      <div
        className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-teal-900/80 to-slate-900 ${className}`}
      >
        <p className="px-4 text-center text-sm text-white/60">Demo video coming soon for this step</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/15 bg-black ${className}`}>
      <div className="relative aspect-video w-full">
        {!failed ? (
          <video
            key={demo.videoUrl}
            ref={videoRef}
            className="h-full w-full object-cover"
            src={demo.videoUrl}
            poster={demo.posterUrl}
            muted={muted}
            loop
            playsInline
            autoPlay={playing}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-teal-900 to-slate-900 px-4 text-center">
            <p className="text-sm font-bold text-teal-100">Follow the instruction below</p>
            <p className="mt-1 text-xs text-white/60">Demo clip unavailable — Buddy will still guide you</p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          {stepLabel ? (
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              {stepLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-full bg-teal-500/90 px-2 py-1 text-[10px] font-black text-teal-950">
            Watch demo
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
          aria-label={muted ? "Unmute demo" : "Mute demo"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {(caption || demo.credit) && (
        <div className="space-y-0.5 px-3 py-2.5">
          {caption ? <p className="text-sm font-semibold leading-snug text-white">{caption}</p> : null}
          {demo.credit ? <p className="text-[10px] text-white/45">{demo.credit}</p> : null}
        </div>
      )}
    </div>
  );
}
