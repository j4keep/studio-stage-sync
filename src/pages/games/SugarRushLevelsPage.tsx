import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, RotateCcw, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SugarRushBoard, { SugarRushOutcome } from "@/components/games/sugar-rush/SugarRushBoard";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";
import { LEVELS, Level, isLevelUnlocked, loadProgress, saveLevelStars, starsForScore } from "@/lib/sugar-rush-levels";

const HOW_TO_PLAY = [
  "Drag a candy into a neighbor to swap them — or tap one candy, then tap the one next to it.",
  "Line up 3+ of the same candy in a row or column to clear them.",
  "Match 4 in a line to make a striped candy (clears a whole row or column). Match 5 to make a color bomb (clears every candy of that color).",
  "Reach the target score before you run out of moves to earn 1, 2, or 3 stars.",
];

function StarRow({ stars, size = "h-4 w-4" }: { stars: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <Star key={i} className={`${size} ${i < stars ? "fill-amber-300 text-amber-300" : "text-white/25"}`} />
      ))}
    </div>
  );
}

export default function SugarRushLevelsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [progress, setProgress] = useState(() => loadProgress(user?.id));
  const [muted, setMuted] = useState(sugarRushSfx.muted);
  const [level, setLevel] = useState<Level | null>(null);
  const [result, setResult] = useState<{ score: number; stars: number } | null>(null);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    setProgress(loadProgress(user?.id));
  }, [user?.id]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sugarRushSfx.setMuted(next);
  };

  const onLevelComplete = (outcome: SugarRushOutcome) => {
    if (!level) return;
    const stars = starsForScore(level, outcome.score);
    saveLevelStars(user?.id, level.id, stars);
    setProgress(loadProgress(user?.id));
    if (stars > 0) sugarRushSfx.win();
    else sugarRushSfx.lose();
    setResult({ score: outcome.score, stars });
  };

  if (level && !result) {
    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
        <SugarRushBoard
          key={runKey}
          mode={{ kind: "moves", gridSize: level.gridSize, moveLimit: level.moveLimit, targetScore: level.targetScore }}
          active
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setLevel(null)}
          howToPlay={HOW_TO_PLAY}
          headerLeft={`Level ${level.id} · Target ${level.targetScore.toLocaleString()}`}
          onComplete={onLevelComplete}
        />
      </div>
    );
  }

  if (level && result) {
    const passed = result.stars > 0;
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#3a1f5c] to-[#1f1140] px-6 text-center">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">Level {level.id}</p>
        <h2 className="text-3xl font-black text-white">{passed ? "Level Complete!" : "Out of Moves"}</h2>
        <StarRow stars={result.stars} size="h-9 w-9" />
        <p className="text-lg font-black text-white">{result.score.toLocaleString()} pts</p>
        <p className="text-xs text-white/60">Target was {level.targetScore.toLocaleString()}</p>
        <div className="mt-3 flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setRunKey((k) => k + 1);
            }}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground active:scale-95"
          >
            <RotateCcw className="h-4 w-4" /> Play Again
          </button>
          {passed && (
            <button
              type="button"
              onClick={() => {
                const next = LEVELS.find((l) => l.id === level.id + 1);
                setLevel(next ?? null);
                setResult(null);
                setRunKey((k) => k + 1);
              }}
              className="rounded-full border border-white/25 px-4 py-3 text-sm font-black text-white active:scale-95"
              disabled={!LEVELS.some((l) => l.id === level.id + 1)}
            >
              Next Level
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setLevel(null);
              setResult(null);
            }}
            className="rounded-full border border-white/25 px-4 py-3 text-sm font-black text-white active:scale-95"
          >
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#3a1f5c] to-[#1f1140] pb-10 text-white">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-black/25 px-4 py-3 backdrop-blur-md" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <button type="button" onClick={() => navigate("/games")} aria-label="Back" className="rounded-full bg-white/10 p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-black">YAJ Sugar Rush — Level Map</h1>
          <p className="text-[11px] text-white/60">Clear the target score before you run out of moves</p>
        </div>
      </div>

      <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2.5 px-4">
        {LEVELS.map((lvl) => {
          const stars = progress[lvl.id] ?? 0;
          const unlocked = isLevelUnlocked(progress, lvl.id);
          return (
            <button
              key={lvl.id}
              type="button"
              disabled={!unlocked}
              onClick={() => {
                setLevel(lvl);
                setResult(null);
                setRunKey((k) => k + 1);
                void sugarRushSfx.prime();
              }}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] ${
                unlocked ? "border-white/20 bg-white/10" : "border-white/10 bg-white/5 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-sm font-black">
                  {unlocked ? lvl.id : <Lock className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-black">Level {lvl.id}</p>
                  <p className="text-[10px] text-white/60">Target {lvl.targetScore.toLocaleString()} · {lvl.moveLimit} moves</p>
                </div>
              </div>
              <StarRow stars={stars} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
