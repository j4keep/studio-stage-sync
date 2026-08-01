import { motion } from "framer-motion";
import type { VoteMomentum } from "@/lib/battle-ui";
import { firstName } from "@/lib/battle-ui";
import BattleWavyMeter from "@/components/battle/BattleWavyMeter";

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

/** Crowd Momentum meter with wavy energetic bar. */
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

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <p
          className={`font-black uppercase tracking-[0.14em] ${
            finalMinute ? "text-rose-500" : "text-amber-400"
          } ${compact ? "text-[10px]" : "text-xs"}`}
        >
          🔥 Crowd Momentum
        </p>
        {live ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              finalMinute
                ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40"
                : "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
            }`}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            {finalMinute ? "Final minute" : "Live"}
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-black tracking-tight text-[#2563eb] ${
              compact ? "text-[11px]" : "text-sm"
            }`}
          >
            {left.toUpperCase()}
          </p>
          <motion.p
            key={`l-${leftPct}`}
            initial={{ y: 6, opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            className={`font-black tabular-nums leading-none text-foreground ${
              compact ? "text-2xl" : "text-3xl"
            }`}
          >
            {leftPct}
            <span className="text-base text-muted-foreground">%</span>
          </motion.p>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p
            className={`truncate font-black tracking-tight text-[#e11d48] ${
              compact ? "text-[11px]" : "text-sm"
            }`}
          >
            {right.toUpperCase()}
          </p>
          <motion.p
            key={`r-${rightPct}`}
            initial={{ y: 6, opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            className={`font-black tabular-nums leading-none text-foreground ${
              compact ? "text-2xl" : "text-3xl"
            }`}
          >
            {rightPct}
            <span className="text-base text-muted-foreground">%</span>
          </motion.p>
        </div>
      </div>

      <BattleWavyMeter leftPct={leftPct} size={compact ? "sm" : "md"} />

      <div className="flex items-center justify-between gap-2">
        <p
          className={`min-w-0 truncate font-semibold ${compact ? "text-[10px]" : "text-xs"} ${
            momentum?.trending === "left"
              ? "text-[#3b82f6]"
              : momentum?.trending === "right"
                ? "text-[#e11d48]"
                : "text-muted-foreground"
          }`}
        >
          {momentum?.label || "Cast a vote to move the crowd"}
        </p>
        <p
          className={`shrink-0 font-black tabular-nums text-foreground ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          {totalVotes.toLocaleString()} votes
        </p>
      </div>

      {momentum && (momentum.leftGain > 0 || momentum.rightGain > 0) ? (
        <div className="flex gap-2">
          <span className="rounded-full bg-[#2563eb]/15 px-2.5 py-1 text-[10px] font-bold text-[#3b82f6] ring-1 ring-[#2563eb]/25">
            {left} +{momentum.leftGain}/min
          </span>
          <span className="rounded-full bg-[#e11d48]/15 px-2.5 py-1 text-[10px] font-bold text-[#e11d48] ring-1 ring-[#e11d48]/25">
            {right} +{momentum.rightGain}/min
          </span>
        </div>
      ) : null}
    </div>
  );
}
