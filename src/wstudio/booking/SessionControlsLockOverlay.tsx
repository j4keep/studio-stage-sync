import { Download, FileCheck } from "lucide-react";

/** Shown when paid session time has expired without an approved extension. */
export function SessionControlsLockOverlay() {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/85 px-6 py-8 text-center backdrop-blur-sm">
      <div className="rounded-full border border-amber-500/30 bg-amber-950/40 px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-200/90">
        Session ended
      </div>
      <h3 className="max-w-sm font-display text-lg font-semibold text-white">
        Booked time is complete
      </h3>
      <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
        Transport and session controls stay locked. Review takes, finalize stems, or request a new booking
        for additional time.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 opacity-80"
        >
          <FileCheck className="h-3.5 w-3.5" aria-hidden />
          Review takes (stub)
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 opacity-80"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Downloads (stub)
        </button>
      </div>
    </div>
  );
}
