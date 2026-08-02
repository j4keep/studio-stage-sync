import { motion } from "framer-motion";
import yajIcon from "@/assets/yaj-ai-generator-icon.png";

type Props = {
  leftPct: number;
  /** First letter of left competitor (always shown inside the bar). */
  leftInitial?: string;
  /** First letter of right competitor (always shown inside the bar). */
  rightInitial?: string;
  className?: string;
  /** When false, bar is display-only (no voting taps). */
  interactive?: boolean;
  disabledLeft?: boolean;
  disabledRight?: boolean;
  onVoteLeft?: () => void;
  onVoteRight?: () => void;
  /** Fired when a side is tapped but that side is disabled (e.g. self-vote). */
  onDisabledVote?: (side: "left" | "right") => void;
  size?: "sm" | "md";
};

function initialOf(value?: string | null, fallback = "?") {
  const ch = (value || "").trim().charAt(0);
  return (ch || fallback).toUpperCase();
}

/**
 * Neon cyan/magenta battle vote bar — tap a side to vote.
 * Competitor initials sit at each end; YAJ slides toward the leader inside the bar.
 */
export default function BattleNeonVoteBar({
  leftPct,
  leftInitial,
  rightInitial,
  className = "",
  interactive = true,
  disabledLeft = false,
  disabledRight = false,
  onVoteLeft,
  onVoteRight,
  onDisabledVote,
  size = "md",
}: Props) {
  const rawLeft = Number.isFinite(leftPct) ? leftPct : 50;
  const displayLeft = Math.max(0, Math.min(100, Math.round(rawLeft)));
  const displayRight = 100 - displayLeft;
  // Keep icon/fill off the extreme edges so initials stay readable.
  const pct = Math.max(10, Math.min(90, rawLeft));
  const h = size === "sm" ? 38 : 46;
  // Icon must sit fully inside the bar — slightly smaller than inner height.
  const icon = size === "sm" ? 28 : 34;
  const labelSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  const leftLetter = initialOf(leftInitial, "A");
  const rightLetter = initialOf(rightInitial, "B");

  return (
    <div
      className={`relative w-full select-none ${className}`}
      role={interactive ? "group" : "img"}
      aria-label={`Battle score ${displayLeft}% to ${displayRight}%`}
    >
      <div className="relative" style={{ height: h }}>
        {/* Outer neon glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{
            height: h + 4,
            background:
              "linear-gradient(90deg, rgba(34,211,238,0.55), rgba(236,72,153,0.55))",
            filter: "blur(10px)",
            opacity: 0.5,
          }}
        />

        <div
          className="relative mx-auto overflow-hidden rounded-full"
          style={{
            height: h,
            boxShadow:
              "0 0 0 2px rgba(255,255,255,0.18), 0 0 18px rgba(34,211,238,0.35), 0 0 18px rgba(236,72,153,0.35)",
            background:
              "linear-gradient(90deg, #0891b2 0%, #22d3ee 45%, #f472b6 55%, #db2777 100%)",
          }}
        >
          <div className="absolute inset-[2px] overflow-hidden rounded-full bg-black/35">
            <motion.div
              className="absolute inset-y-0 left-0"
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              style={{
                background:
                  "linear-gradient(90deg, #0e7490 0%, #22d3ee 55%, #67e8f9 100%)",
                boxShadow: "inset 0 0 18px rgba(34,211,238,0.45)",
              }}
            />
            <motion.div
              className="absolute inset-y-0 right-0"
              animate={{ width: `${100 - pct}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              style={{
                background:
                  "linear-gradient(270deg, #9d174d 0%, #ec4899 55%, #f9a8d4 100%)",
                boxShadow: "inset 0 0 18px rgba(236,72,153,0.45)",
              }}
            />

            {/* Competitor initials at each end of the bar */}
            <div className="pointer-events-none absolute inset-y-0 left-2.5 z-[1] flex items-center">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-[11px] font-black text-cyan-50 ring-1 ring-cyan-200/50"
                style={{ textShadow: "0 0 8px rgba(34,211,238,0.8)" }}
              >
                {leftLetter}
              </span>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-2.5 z-[1] flex items-center">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-[11px] font-black text-pink-50 ring-1 ring-pink-200/50"
                style={{ textShadow: "0 0 8px rgba(236,72,153,0.8)" }}
              >
                {rightLetter}
              </span>
            </div>

            <div className="pointer-events-none absolute inset-x-4 top-1 h-2 rounded-full bg-white/20 blur-[2px]" />
          </div>

          {interactive ? (
            <>
              <button
                type="button"
                aria-label="Vote left"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (disabledLeft) onDisabledVote?.("left");
                  else onVoteLeft?.();
                }}
                className={`absolute inset-y-0 left-0 z-10 w-1/2 ${disabledLeft ? "cursor-not-allowed" : ""}`}
              />
              <button
                type="button"
                aria-label="Vote right"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (disabledRight) onDisabledVote?.("right");
                  else onVoteRight?.();
                }}
                className={`absolute inset-y-0 right-0 z-10 w-1/2 ${disabledRight ? "cursor-not-allowed" : ""}`}
              />
            </>
          ) : null}

          {/* YAJ sits inside the bar (not hanging outside) */}
          <motion.div
            className="pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            animate={{ left: `${pct}%` }}
            transition={{ type: "spring", stiffness: 170, damping: 18 }}
            style={{ width: icon, height: icon }}
          >
            <div
              className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/80"
              style={{
                boxShadow:
                  "0 0 0 1.5px rgba(255,255,255,0.9), 0 0 10px rgba(34,211,238,0.5), 0 0 10px rgba(236,72,153,0.5)",
              }}
            >
              <img
                src={yajIcon}
                alt=""
                aria-hidden
                className="h-[92%] w-[92%] rounded-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Live vote % + "vote" cue under each side */}
      <div className={`mt-1.5 flex items-center justify-between px-1 ${labelSize} font-black tracking-wide`}>
        <motion.span
          key={`l-${displayLeft}`}
          initial={{ scale: 1.08, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          className="tabular-nums text-cyan-300"
          style={{ textShadow: "0 0 10px rgba(34,211,238,0.65)" }}
        >
          {displayLeft}% vote
        </motion.span>
        <motion.span
          key={`r-${displayRight}`}
          initial={{ scale: 1.08, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          className="tabular-nums text-pink-400"
          style={{ textShadow: "0 0 10px rgba(236,72,153,0.65)" }}
        >
          {displayRight}% vote
        </motion.span>
      </div>
    </div>
  );
}
