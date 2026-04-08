import { Video } from "lucide-react";

export function VideoPanel({
  title,
  subtitle,
  mirrored,
  className = "",
}: {
  title: string;
  subtitle?: string;
  /** Local preview (e.g. self-view). */
  mirrored?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative flex min-h-[140px] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-inner ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-900/90 to-zinc-950">
        <Video className="h-10 w-10 text-zinc-600" strokeWidth={1.25} aria-hidden />
        <p className="text-center text-xs font-medium text-zinc-500">{subtitle ?? "Video stream placeholder"}</p>
      </div>
      <div
        className={`absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 border-t border-zinc-800/80 bg-black/70 px-3 py-2 backdrop-blur-sm ${mirrored ? "[transform:scaleX(-1)]" : ""}`}
      >
        <span className="truncate text-xs font-semibold text-zinc-200">{title}</span>
      </div>
    </div>
  );
}
