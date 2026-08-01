import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { firstName, rankingPointsForWin } from "@/lib/battle-ui";

type Props = {
  winnerName: string;
  winnerPct: number;
  loserName: string;
  loserPct: number;
  totalVotes: number;
  tied?: boolean;
};

/** Premium ended-battle ceremony with ranking points + confetti. */
export default function BattleWinnerCelebration({
  winnerName,
  winnerPct,
  loserName,
  loserPct,
  totalVotes,
  tied = false,
}: Props) {
  const [burst, setBurst] = useState(true);
  const points = rankingPointsForWin(winnerPct, totalVotes, tied);

  useEffect(() => {
    const t = window.setTimeout(() => setBurst(false), 5200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-amber-400/35 bg-gradient-to-br from-amber-950/50 via-[#1a1410] to-stone-950 px-4 py-6 shadow-[0_24px_60px_-28px_rgba(245,158,11,0.65)]">
      {burst ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                left: `${6 + ((i * 13) % 88)}%`,
                top: `${-12 + (i % 6) * 3}%`,
                background:
                  i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#34d399" : "#fb7185",
                animation: `battle-confetti-fall ${1.6 + (i % 5) * 0.22}s ease-out ${i * 0.04}s both`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative text-center">
        <motion.div
          initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-amber-950 shadow-[0_0_30px_rgba(251,191,36,0.55)]"
        >
          <Trophy className="h-8 w-8" />
        </motion.div>

        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">
          {tied ? "Draw" : "🏆 Winner"}
        </p>
        <h2 className="mt-1.5 text-3xl font-black tracking-tight text-white">
          {tied ? "Battle tied" : winnerName}
        </h2>

        {!tied ? (
          <div className="mt-3 space-y-1">
            <p className="text-sm font-bold text-amber-100/90">
              Won by <span className="text-2xl font-black text-amber-300">{winnerPct}%</span>
            </p>
            <p className="text-xs font-semibold text-white/60">
              {totalVotes.toLocaleString()} votes · 🥈 {firstName(loserName)} {loserPct}%
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm font-bold text-white/70">Split decision</p>
        )}

        {!tied && points > 0 ? (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-black text-emerald-300 ring-1 ring-emerald-400/35"
          >
            +{points} Ranking Points
          </motion.div>
        ) : null}
      </div>

      <style>{`
        @keyframes battle-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(240px) rotate(260deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
