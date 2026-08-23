import { RotateCcw, Share2, Swords, Trophy, X } from "lucide-react";
import type { SugarRushOutcome } from "./SugarRushMazeStage";

export default function SugarRushResultCard({
  result,
  best,
  onPlayAgain,
  onChallenge,
  onShare,
  onClose,
}: {
  result: SugarRushOutcome | null;
  best: number | null;
  onPlayAgain: () => void;
  onChallenge: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  if (!result) return null;
  const newBest = !best || result.score >= best;
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#130720]/88 px-5 backdrop-blur-md">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[30px] border border-pink-200/25 bg-gradient-to-b from-[#4a216f] via-[#2b1645] to-[#190d2c] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,.55)]">
        <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-pink-400/20 blur-2xl" />
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white/80" aria-label="Close"><X className="h-4 w-4" /></button>
        <div className="text-center">
          <Trophy className={`mx-auto h-9 w-9 ${result.completed ? "text-yellow-300" : "text-white/40"}`} />
          <p className="mt-2 text-2xl font-black">{result.completed ? "Sugar Rush Complete!" : "Dr. Cavity got you"}</p>
          {newBest && result.completed ? <p className="mt-1 text-[10px] font-black uppercase tracking-[.2em] text-yellow-200">New best score</p> : null}
          <p className="mt-3 text-4xl font-black tabular-nums text-pink-100">{result.score.toLocaleString()}</p>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/45">Total score</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {result.lines.filter((l) => l.label !== "Total score").map((line) => (
            <div key={line.label} className="rounded-2xl border border-white/10 bg-white/[.07] px-3 py-3 text-center">
              <p className="text-lg font-black tabular-nums">{line.value.toLocaleString()}</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50">{line.label}</p>
            </div>
          ))}
        </div>
        <button onClick={onPlayAgain} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-3.5 text-sm font-black shadow-lg active:scale-[.98]"><RotateCcw className="h-4 w-4" /> Play Again</button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={onChallenge} className="flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[.07] px-3 py-3 text-xs font-black"><Swords className="h-4 w-4" /> Challenge</button>
          <button onClick={onShare} className="flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[.07] px-3 py-3 text-xs font-black"><Share2 className="h-4 w-4" /> Share</button>
        </div>
      </div>
    </div>
  );
}
