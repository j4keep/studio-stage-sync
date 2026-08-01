import { motion } from "framer-motion";

type Props = {
  leftPct: number;
  className?: string;
  size?: "sm" | "md";
};

/**
 * Wavy, energetic vote meter — not a straight political progress bar.
 * Electric cobalt (#2563eb) vs crimson (#e11d48).
 */
export default function BattleWavyMeter({ leftPct, className = "", size = "md" }: Props) {
  const pct = Math.max(2, Math.min(98, leftPct));
  const h = size === "sm" ? 20 : 26;
  const joinX = (pct / 100) * 200;

  return (
    <div className={`relative w-full ${className}`} style={{ height: h }}>
      <svg
        viewBox="0 0 200 26"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="bwBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <linearGradient id="bwRed" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#9f1239" />
            <stop offset="50%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
          <clipPath id="bwRound">
            <rect x="0" y="0" width="200" height="26" rx="13" />
          </clipPath>
        </defs>

        <g clipPath="url(#bwRound)">
          <rect width="200" height="26" fill="rgba(120,120,140,0.22)" />

          {/* Blue fill with wavy right edge */}
          <motion.path
            fill="url(#bwBlue)"
            animate={{ d: waveFillLeft(joinX, 0) }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
          <motion.path
            fill="url(#bwBlue)"
            opacity="0.35"
            animate={{ d: [waveFillLeft(joinX, 0), waveFillLeft(joinX, 1), waveFillLeft(joinX, 0)] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          />

          {/* Red fill with wavy left edge */}
          <motion.path
            fill="url(#bwRed)"
            animate={{ d: waveFillRight(joinX, 0) }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
          <motion.path
            fill="url(#bwRed)"
            opacity="0.3"
            animate={{ d: [waveFillRight(joinX, 0), waveFillRight(joinX, 1), waveFillRight(joinX, 0)] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          />

          {/* Soft shimmer line */}
          <motion.path
            d="M0 13 Q 33 7 66 13 T 132 13 T 200 13"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.2"
            animate={{ opacity: [0.15, 0.4, 0.15] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
          />
        </g>
      </svg>

      <motion.div
        className="pointer-events-none absolute top-1/2 z-10 flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[9px] shadow-[0_0_12px_rgba(37,99,235,0.45)] ring-2 ring-white/80"
        animate={{ left: `${pct}%`, scale: [1, 1.1, 1] }}
        transition={{
          left: { type: "spring", stiffness: 190, damping: 20 },
          scale: { repeat: Infinity, duration: 1.25 },
        }}
      >
        ⚡
      </motion.div>
    </div>
  );
}

function waveFillLeft(joinX: number, phase: 0 | 1): string {
  const a = phase === 0 ? 4.5 : 2.2;
  const b = phase === 0 ? 2.2 : 4.5;
  // Rectangle from 0 → joinX, with a sine-ish right edge
  return [
    `M 0 0`,
    `L ${joinX - 8} 0`,
    `C ${joinX - 2} ${a}, ${joinX + 2} ${b}, ${joinX} 8`,
    `C ${joinX - 3} 12, ${joinX + 3} 16, ${joinX} 20`,
    `C ${joinX + 2} ${26 - b}, ${joinX - 2} ${26 - a}, ${joinX - 8} 26`,
    `L 0 26`,
    `Z`,
  ].join(" ");
}

function waveFillRight(joinX: number, phase: 0 | 1): string {
  const a = phase === 0 ? 2.2 : 4.5;
  const b = phase === 0 ? 4.5 : 2.2;
  return [
    `M 200 0`,
    `L ${joinX + 8} 0`,
    `C ${joinX + 2} ${a}, ${joinX - 2} ${b}, ${joinX} 8`,
    `C ${joinX + 3} 12, ${joinX - 3} 16, ${joinX} 20`,
    `C ${joinX - 2} ${26 - b}, ${joinX + 2} ${26 - a}, ${joinX + 8} 26`,
    `L 200 26`,
    `Z`,
  ].join(" ");
}
