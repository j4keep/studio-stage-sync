import { motion } from "framer-motion";
import type { VoteMomentum } from "@/lib/battle-ui";
import { firstName } from "@/lib/battle-ui";

type Props = {
  leftName: string;
  rightName: string;
  leftPct: number;
  rightPct: number;
  totalVotes: number;
  live?: boolean;
  compact?: boolean;
  finalMinute?: boolean;
  momentum?: VoteMomentum | null;
};

/** Tug-of-war Crowd Momentum meter — not a loading/progress bar. */
export default function BattleLiveMeter({
  leftName,
  rightName,
  leftPct,
  rightPct,
  totalVotes,
  live = false,
  compact = false,
  finalMinute = false,
  momentum = null,
}: Props) {
  const left = firstName(leftName, "A");
  const right = firstName(rightName, "B");
  // Marker sits at the balance point between sides
  const tug = Math.max(8, Math.min(92, leftPct));

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-black uppercase tracking-[0.14em] ${finalMinute ? "text-rose-400" : "text-amber-400"} ${compact ? "text-[10px]" : "text-xs"}`}>
          🔥 Crowd Momentum
        </p>
        {live ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
            finalMinute
              ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
              : "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
          }`}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            {finalMinute ? "Final minute" : "Live"}
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`truncate font-black tracking-tight text-sky-400 ${compact ? "text-[11px]" : "text-sm"}`}>
            {left.toUpperCase()}
          </p>
          <motion.p
            key={`l-${leftPct}`}
            initial={{ y: 6, opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            className={`font-black tabular-nums leading-none text-foreground ${compact ? "text-2xl" : "text-3xl"}`}
          >
            {leftPct}
            <span className="text-base text-muted-foreground">%</span>
          </motion.p>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className={`truncate font-black tracking-tight text-rose-400 ${compact ? "text-[11px]" : "text-sm"}`}>
            {right.toUpperCase()}
          </p>
          <motion.p
            key={`r-${rightPct}`}
            initial={{ y: 6, opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            className={`font-black tabular-nums leading-none text-foreground ${compact ? "text-2xl" : "text-3xl"}`}
          >
            {rightPct}
            <span className="text-base text-muted-foreground">%</span>
          </motion.p>
        </div>
      </div>

      {/* Tug-of-war track */}
      <div className={`relative ${compact ? "h-4" : "h-5"}`}>
        <div className="absolute inset-0 overflow-hidden rounded-full bg-gradient-to-r from-sky-950/40 via-muted to-rose-950/40 ring-1 ring-white/10">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-300"
            animate={{ width: `${leftPct}%` }}
            transition={{ type: "spring", stiffness: finalMinute ? 260 : 160, damping: 20 }}
          />
          <motion.div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-500 via-orange-400 to-rose-300"
            animate={{ width: `${rightPct}%` }}
            transition={{ type: "spring", stiffness: finalMinute ? 260 : 160, damping: 20 }}
          />
          {/* chevron texture feel */}
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.12) 10px, rgba(255,255,255,0.12) 12px)",
            }}
          />
        </div>

        <motion.div
          className="absolute top-1/2 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-300 text-amber-950 shadow-[0_0_18px_rgba(251,191,36,0.75)] ring-2 ring-background"
          animate={{ left: `${tug}%`, scale: finalMinute ? [1, 1.12, 1] : [1, 1.06, 1] }}
          transition={{
            left: { type: "spring", stiffness: 180, damping: 18 },
            scale: { repeat: Infinity, duration: finalMinute ? 0.7 : 1.4 },
          }}
        >
          <span className="text-sm leading-none">⚡</span>
        </motion.div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className={`min-w-0 truncate font-semibold ${compact ? "text-[10px]" : "text-xs"} ${
          momentum?.trending === "left"
            ? "text-sky-300"
            : momentum?.trending === "right"
              ? "text-rose-300"
              : "text-muted-foreground"
        }`}>
          {momentum?.label || "Cast a vote to move the crowd"}
        </p>
        <p className={`shrink-0 font-black tabular-nums text-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
          {totalVotes.toLocaleString()} votes
        </p>
      </div>

      {momentum && (momentum.leftGain > 0 || momentum.rightGain > 0) ? (
        <div className="flex gap-2">
          <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-bold text-sky-300 ring-1 ring-sky-500/25">
            {left} +{momentum.leftGain}/min
          </span>
          <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/25">
            {right} +{momentum.rightGain}/min
          </span>
        </div>
      ) : null}
    </div>
  );
}
