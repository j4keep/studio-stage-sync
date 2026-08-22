import { ArrowLeft, Heart, Pause, Volume2, VolumeX } from "lucide-react";
import { MAX_HEARTS, SugarRushMazeState } from "@/lib/sugar-rush-maze";
import "./sugar-rush.css";

type Props = {
  st: SugarRushMazeState;
  best: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onBack: () => void;
};

/** Hearts (left) · Objective (center) · Score (right), Sugar Meter below — kept compact
 *  and out of the maze's own play area, mirrors TowerHud.tsx's layout conventions. */
export default function SugarRushHud({ st, best, muted, onToggleMute, onPause, onBack }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 select-none px-3 pt-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
          {Array.from({ length: MAX_HEARTS }, (_, i) => (
            <Heart key={i} className={`h-4 w-4 ${i < st.hearts ? "text-rose-400" : "text-white/20"}`} fill={i < st.hearts ? "currentColor" : "none"} />
          ))}
        </div>

        <div className="mx-2 flex-1 rounded-full bg-black/55 px-3 py-1.5 text-center backdrop-blur-sm">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-yellow-200/90">
            {st.exitUnlocked ? "Exit unlocked!" : st.objectiveLabel}
          </p>
          {!st.exitUnlocked && (
            <p className="text-[10px] font-bold text-white/70">
              {st.objectiveProgress}/{st.objectiveTarget}
            </p>
          )}
        </div>

        <div className="rounded-full bg-black/55 px-3 py-1.5 text-right backdrop-blur-sm">
          <p className="text-[13px] font-black tabular-nums text-white">{st.score.toLocaleString()}</p>
          {best ? <p className="text-[9px] font-bold text-white/50">BEST {best.toLocaleString()}</p> : null}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-1">
          <button type="button" onClick={onBack} aria-label="Leave Candy City" className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onPause} aria-label="Pause" className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm">
            <Pause className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToggleMute} aria-label={muted ? "Unmute" : "Mute"} className="rounded-full bg-black/55 p-2 text-white backdrop-blur-sm">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{
              width: `${st.rushActive ? 100 : st.sugarMeter}%`,
              background: st.rushActive
                ? "linear-gradient(90deg, #ffd166, #ff5ecb, #ffd166)"
                : "linear-gradient(90deg, #ff9ecb, #ffd166)",
            }}
          />
        </div>
      </div>
      <p
        className={`mt-0.5 text-center text-[9px] font-black uppercase tracking-[0.16em] ${
          st.rushActive ? "sr-rush-pulse text-yellow-200" : "text-white/60"
        }`}
      >
        {st.rushActive ? `Sugar Rush! ${Math.ceil(st.rushTimeLeft)}s` : "Sugar Meter"}
      </p>
    </div>
  );
}
