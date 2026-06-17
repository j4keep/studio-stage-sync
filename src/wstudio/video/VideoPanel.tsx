import { useEffect, useRef } from "react";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";

export function VideoPanel({
  title,
  subtitle,
  mirrored,
  stream,
  /** Mute this element to avoid feedback (local preview); set false for remote if audio should play here. */
  videoMuted = true,
  /** 0–1 output level when unmuted (e.g. engineer headphone bus on remote tile). */
  volume = 1,
  className = "",
}: {
  title: string;
  subtitle?: string;
  /** Local preview (e.g. self-view). */
  mirrored?: boolean;
  stream?: MediaStream | null;
  videoMuted?: boolean;
  volume?: number;
  className?: string;
}) {
  const vidRef = useRef<HTMLVideoElement>(null);

  const hasRenderableVideo =
    !!stream?.getVideoTracks().some((t) => t.readyState === "live" || (t.readyState as string) === "new");
  const hasLiveAudio =
    !!stream?.getAudioTracks().some((t) => t.readyState === "live" || (t.readyState as string) === "new");
  const showMediaElement = hasRenderableVideo || hasLiveAudio;

  useEffect(() => {
    const el = vidRef.current;
    if (!el) return;
    el.srcObject = stream ?? null;
    el.volume = Math.min(1, Math.max(0, volume));
    if (stream && showMediaElement) {
      void el.play().catch(() => {});
    }
  }, [stream, showMediaElement, volume]);

  return (
    <div
      className={cn(
        "relative flex min-h-[140px] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-inner",
        className,
      )}
    >
      {stream && showMediaElement ? (
        <video
          ref={vidRef}
          className={cn("absolute inset-0 h-full w-full object-cover", mirrored && "scale-x-[-1]")}
          autoPlay
          playsInline
          muted={videoMuted}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-900/90 to-zinc-950">
          <Video className="h-10 w-10 text-zinc-600" strokeWidth={1.25} aria-hidden />
          <p className="text-center text-xs font-medium text-zinc-500">{subtitle ?? "Video stream placeholder"}</p>
        </div>
      )}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 border-t border-zinc-800/80 bg-black/70 px-3 py-2 backdrop-blur-sm",
          mirrored && !stream && "[transform:scaleX(-1)]",
        )}
      >
        <span className="truncate text-xs font-semibold text-zinc-200">{title}</span>
      </div>
    </div>
  );
}
