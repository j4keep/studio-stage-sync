import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import DemoFormGuide from "@/components/wellness/DemoFormGuide";
import type { DemoClip } from "@/lib/wellness-demos";

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
 * Step-synced real-human form demo for Move / Relax.
 * Reads `demo.videoUrl` (DB-ready). Swap catalog URLs for YAJ AI / certified
 * trainer clips later — this UI stays the same.
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

  const hasVideo = Boolean(demo?.videoUrl) && !failed;

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
    if (!el || !hasVideo) return;
    if (playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [playing, hasVideo]);

  if (!demo) {
    return (
      <div
        className={`relative mx-auto flex aspect-[9/16] max-h-[52vh] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-teal-900/80 to-slate-900 ${className}`}
      >
        <p className="px-4 text-center text-sm text-white/60">Demo coming soon for this step</p>
      </div>
    );
  }

  return (
    <div className={`relative mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/15 bg-black ${className}`}>
      {/* Vertical 9:16 frame — landscape clips are center-cropped */}
      <div className="relative aspect-[9/16] max-h-[52vh] w-full">
        {hasVideo ? (
          <video
            key={demo.videoUrl!}
            ref={videoRef}
            className="h-full w-full object-cover"
            src={demo.videoUrl!}
            poster={demo.posterUrl || undefined}
            muted={muted}
            loop
            playsInline
            autoPlay={playing}
            onError={() => setFailed(true)}
          />
        ) : (
          <DemoFormGuide
            guide={demo.guide}
            setting={demo.setting}
            title={demo.title}
            playing={playing}
          />
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
            ▶ Demo
          </span>
        </div>

        {hasVideo ? (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
            aria-label={muted ? "Unmute demo" : "Mute demo"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {(caption || demo.credit) && (
        <div className="space-y-0.5 bg-[#0c1a17] px-3 py-2.5">
          {caption ? <p className="text-sm font-semibold leading-snug text-white">{caption}</p> : null}
          {demo.credit ? <p className="text-[10px] text-white/45">{demo.credit}</p> : null}
        </div>
      )}
    </div>
  );
}
