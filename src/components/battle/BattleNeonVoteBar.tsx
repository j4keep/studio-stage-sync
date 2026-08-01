import { motion } from "framer-motion";
import yajIcon from "@/assets/yaj-ai-generator-icon.png";

type Props = {
  leftPct: number;
  className?: string;
  /** When false, bar is display-only (no voting taps). */
  interactive?: boolean;
  disabledLeft?: boolean;
  disabledRight?: boolean;
  onVoteLeft?: () => void;
  onVoteRight?: () => void;
  size?: "sm" | "md";
};

/**
 * Neon cyan/magenta battle vote bar — tap a side to vote.
 * YAJ icon slides toward the winning side. No labels/words.
 */
export default function BattleNeonVoteBar({
  leftPct,
  className = "",
  interactive = true,
  disabledLeft = false,
  disabledRight = false,
  onVoteLeft,
  onVoteRight,
  size = "md",
}: Props) {
  const pct = Math.max(6, Math.min(94, Number.isFinite(leftPct) ? leftPct : 50));
  const h = size === "sm" ? 36 : 44;
  const icon = size === "sm" ? 34 : 42;

  return (
    <div
      className={`relative w-full select-none ${className}`}
      style={{ height: h + 10 }}
      role={interactive ? "group" : "img"}
      aria-label={`Battle score ${Math.round(pct)} to ${Math.round(100 - pct)}`}
    >
      {/* Outer neon glow */}
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full"
        style={{
          height: h + 6,
          background:
            "linear-gradient(90deg, rgba(34,211,238,0.55), rgba(236,72,153,0.55))",
          filter: "blur(10px)",
          opacity: 0.55,
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
        {/* Soft inner track */}
        <div className="absolute inset-[2px] overflow-hidden rounded-full bg-black/35">
          {/* Left fill */}
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
          {/* Right fill */}
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

          {/* Subtle side glyphs (no text) */}
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center opacity-70">
            <BrushGlyph />
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-70">
            <ArmGlyph />
          </div>

          {/* Shine */}
          <div className="pointer-events-none absolute inset-x-4 top-1 h-2 rounded-full bg-white/20 blur-[2px]" />
        </div>

        {/* Tap zones */}
        {interactive ? (
          <>
            <button
              type="button"
              aria-label="Vote left"
              disabled={disabledLeft}
              onClick={(e) => {
                e.stopPropagation();
                if (!disabledLeft) onVoteLeft?.();
              }}
              className="absolute inset-y-0 left-0 z-10 w-1/2 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              aria-label="Vote right"
              disabled={disabledRight}
              onClick={(e) => {
                e.stopPropagation();
                if (!disabledRight) onVoteRight?.();
              }}
              className="absolute inset-y-0 right-0 z-10 w-1/2 disabled:cursor-not-allowed"
            />
          </>
        ) : null}
      </div>

      {/* Moving YAJ icon toward the winning side */}
      <motion.div
        className="pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
        animate={{ left: `${pct}%` }}
        transition={{ type: "spring", stiffness: 170, damping: 18 }}
        style={{ width: icon, height: icon }}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-black/70 p-[2px]"
          style={{
            boxShadow:
              "0 0 0 2px rgba(255,255,255,0.85), 0 0 14px rgba(34,211,238,0.55), 0 0 14px rgba(236,72,153,0.55)",
          }}
        >
          <img
            src={yajIcon}
            alt=""
            aria-hidden
            className="h-full w-full rounded-full object-cover"
          />
        </div>
      </motion.div>
    </div>
  );
}

function BrushGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 3.5l5 5-9.2 9.2a3.2 3.2 0 01-1.7.9l-3.4.5a.8.8 0 01-.9-.9l.5-3.4c.1-.6.4-1.2.9-1.7L15.5 3.5z"
        stroke="#083344"
        strokeWidth="1.8"
        fill="rgba(8,51,68,0.35)"
      />
      <path d="M14 5l5 5" stroke="#083344" strokeWidth="1.8" />
    </svg>
  );
}

function ArmGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 8h6a3 3 0 013 3v1h2.5a1.5 1.5 0 010 3H16v1a3 3 0 01-3 3H7"
        stroke="#4a044e"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="rgba(74,4,78,0.25)"
      />
      <circle cx="18.5" cy="12" r="1.4" fill="#4a044e" />
    </svg>
  );
}
