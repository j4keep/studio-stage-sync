import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { firstName } from "@/lib/battle-ui";

type Props = {
  winnerName: string;
  winnerPct: number;
  loserName: string;
  loserPct: number;
  totalVotes: number;
  tied?: boolean;
};

/** Premium ended-battle presentation with lightweight CSS confetti (no new deps). */
export default function BattleWinnerCelebration({
  winnerName,
  winnerPct,
  loserName,
  loserPct,
  totalVotes,
  tied = false,
}: Props) {
  const [burst, setBurst] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setBurst(false), 4200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-amber-400/25 bg-gradient-to-br from-amber-950/40 via-card to-stone-950/40 px-4 py-5 shadow-[0_20px_50px_-30px_rgba(245,158,11,0.55)]">
      {burst ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                left: `${8 + ((i * 17) % 84)}%`,
                top: `${-10 + (i % 5) * 4}%`,
                background:
                  i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#34d399" : "#fb7185",
                animation: `battle-confetti-fall ${1.8 + (i % 5) * 0.25}s ease-out ${i * 0.05}s both`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-amber-950 shadow-lg shadow-amber-500/30"
        >
          <Trophy className="h-7 w-7" />
        </motion.div>

        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/90">
          {tied ? "Draw" : "Winner"}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">
          {tied ? "Battle tied" : firstName(winnerName)}
        </h2>
        {!tied ? (
          <p className="mt-1 text-sm font-bold text-amber-200/90">
            Won by {winnerPct}% · 🏆 Winner
          </p>
        ) : (
          <p className="mt-1 text-sm font-bold text-muted-foreground">Split decision</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-2xl bg-background/50 px-3 py-2.5 ring-1 ring-amber-400/20">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Votes
            </p>
            <p className="text-lg font-black tabular-nums text-foreground">
              {totalVotes.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl bg-background/50 px-3 py-2.5 ring-1 ring-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Runner-up
            </p>
            <p className="truncate text-sm font-black text-foreground">
              {tied ? "—" : `${firstName(loserName)} · ${loserPct}%`}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes battle-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(220px) rotate(240deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
