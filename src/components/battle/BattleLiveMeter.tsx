import { motion } from "framer-motion";
import { crowdLeanText, firstName } from "@/lib/battle-ui";

type Props = {
  leftName: string;
  rightName: string;
  leftPct: number;
  rightPct: number;
  totalVotes: number;
  live?: boolean;
  compact?: boolean;
};

export default function BattleLiveMeter({
  leftName,
  rightName,
  leftPct,
  rightPct,
  totalVotes,
  live = false,
  compact = false,
}: Props) {
  const left = firstName(leftName, "A");
  const right = firstName(rightName, "B");
  const lean = crowdLeanText(left, right, leftPct, rightPct, totalVotes);

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`truncate font-black tracking-tight text-sky-400 ${compact ? "text-xs" : "text-sm"}`}>
            {left.toUpperCase()}
          </p>
          <motion.p
            key={`l-${leftPct}`}
            initial={{ scale: 1.15, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`font-black tabular-nums text-foreground ${compact ? "text-lg" : "text-2xl"}`}
          >
            {leftPct}%
          </motion.p>
        </div>

        <div className="flex flex-col items-center px-2">
          {live ? (
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>
          ) : null}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-black text-muted-foreground ring-1 ring-border">
            VS
          </div>
        </div>

        <div className="min-w-0 flex-1 text-right">
          <p className={`truncate font-black tracking-tight text-rose-400 ${compact ? "text-xs" : "text-sm"}`}>
            {right.toUpperCase()}
          </p>
          <motion.p
            key={`r-${rightPct}`}
            initial={{ scale: 1.15, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`font-black tabular-nums text-foreground ${compact ? "text-lg" : "text-2xl"}`}
          >
            {rightPct}%
          </motion.p>
        </div>
      </div>

      <div className="relative">
        <div className={`overflow-hidden rounded-full bg-muted/80 ${compact ? "h-2.5" : "h-3.5"}`}>
          <div className="flex h-full w-full">
            <motion.div
              className="h-full bg-gradient-to-r from-sky-500 to-cyan-400"
              animate={{ width: `${leftPct}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
            />
            <motion.div
              className="h-full bg-gradient-to-r from-rose-500 to-orange-400"
              animate={{ width: `${rightPct}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
            />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-background/90 shadow-[0_0_0_1px_rgba(255,255,255,0.25)]" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className={`text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
          ⬅ {lean}
        </p>
        <p className={`shrink-0 font-bold tabular-nums text-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
          {totalVotes.toLocaleString()} votes
        </p>
      </div>
    </div>
  );
}
