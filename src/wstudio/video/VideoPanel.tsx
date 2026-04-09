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
  className = "",
}: {
  title: string;
  subtitle?: string;
  /** Local preview (e.g. self-view). */
  mirrored?: boolean;
  stream?: MediaStream | null;
  videoMuted?: boolean;
  className?: string;
}) {
  const vidRef = useRef<HTMLVideoElement>(null);

  const hasRenderableVideo =
    !!stream?.getVideoTracks().some((t) => t.readyState === "live" || (t.readyState as string) === "new");

  useEffect(() => {
    const el = vidRef.current;
    if (!el) return;
    el.srcObject = stream ?? null;
    if (stream && hasRenderableVideo) {
      void el.play().catch(() => {});
    }
  }, [stream, hasRenderableVideo]);

  return (
    <div
      className={cn(
        "relative flex min-h-[140px] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-inner",
        className,
      )}
    >
      {stream && hasRenderableVideo ? (
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
