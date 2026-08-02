import type { BattleUiStatus } from "@/lib/battle-ui";

const STYLES: Record<
  BattleUiStatus,
  { label: string; className: string; pulse?: boolean }
> = {
  live: {
    label: "LIVE",
    className: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
    pulse: true,
  },
  countdown: {
    label: "Starting Soon",
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/35",
    pulse: true,
  },
  ending: {
    label: "Final Seconds",
    className: "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/35",
    pulse: true,
  },
  waiting: {
    label: "Waiting",
    className: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
  },
  open: {
    label: "Open",
    className: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
  },
  ended: {
    label: "Ended",
    className: "bg-stone-500/20 text-stone-300 ring-1 ring-stone-500/25",
  },
};

export default function BattleStatusBadge({
  status,
  className = "",
}: {
  status: BattleUiStatus;
  className?: string;
}) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${s.className} ${className}`}
    >
      {s.pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {s.label}
    </span>
  );
}
