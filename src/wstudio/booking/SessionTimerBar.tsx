import { cn } from "@/lib/utils";
import { Clock, Radio } from "lucide-react";
import type { TimerWarningLevel } from "./bookingTypes";
import { formatClock, formatDurationMinutes } from "./bookingTypes";

type Props = {
  totalBookedMinutes: number;
  remainingSeconds: number;
  warningLevel: TimerWarningLevel;
  phase: "scheduled" | "live" | "ended";
  timerRunning: boolean;
  compact?: boolean;
};

export function SessionTimerBar({
  totalBookedMinutes,
  remainingSeconds,
  warningLevel,
  phase,
  timerRunning,
  compact,
}: Props) {
  const totalSec = Math.max(1, totalBookedMinutes * 60);
  const progress = Math.min(1, remainingSeconds / totalSec);
  const pulse =
    warningLevel === "critical"
      ? "animate-pulse"
      : warningLevel === "warning"
        ? "animate-pulse"
        : "";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-b shadow-lg transition-colors",
        "from-zinc-900/95 to-zinc-950",
        warningLevel === "critical" && "border-red-500/60 shadow-red-950/40",
        warningLevel === "warning" && "border-amber-500/50 shadow-amber-950/30",
        warningLevel === "caution" && "border-amber-400/35",
        warningLevel === "ok" && "border-amber-600/25 shadow-black/40",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500/15 via-amber-400/5 to-transparent transition-[width] duration-1000 ease-linear"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg ring-1",
              "bg-zinc-800/80 ring-amber-500/30",
              pulse,
            )}
          >
            <Clock className="h-4 w-4 text-amber-200" aria-hidden />
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
              Session clock
            </div>
            <div
              className={cn(
                "font-mono text-lg font-semibold tabular-nums tracking-tight",
                warningLevel === "critical" && "text-red-300",
                warningLevel === "warning" && "text-amber-200",
                warningLevel === "caution" && "text-amber-100/90",
                warningLevel === "ok" && "text-zinc-100",
              )}
            >
              {formatClock(remainingSeconds)}
            </div>
          </div>
        </div>
        <div className="h-8 w-px bg-zinc-700/80" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
            <span>
              Booked <strong className="text-zinc-200">{formatDurationMinutes(totalBookedMinutes)}</strong>
            </span>
            <span className="text-zinc-600">·</span>
            <span>
              Remaining <strong className="text-zinc-200">{formatClock(remainingSeconds)}</strong>
            </span>
            <span className="text-zinc-600">·</span>
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3 w-3 text-emerald-400/90" aria-hidden />
              <strong className="text-zinc-300">
                {phase === "ended"
                  ? "Ended"
                  : phase === "live"
                    ? timerRunning
                      ? "Live"
                      : "Paused"
                    : "Scheduled"}
              </strong>
            </span>
          </div>
          {warningLevel !== "ok" && phase === "live" && timerRunning ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-200/80">
              {warningLevel === "critical" && "Final minute — wrap cleanly"}
              {warningLevel === "warning" && "Window closing soon"}
              {warningLevel === "caution" && "Planned block nearing end"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
