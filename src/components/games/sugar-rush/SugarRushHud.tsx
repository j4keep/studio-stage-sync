import { ArrowLeft, Heart, LogOut, Pause, Volume2, VolumeX } from "lucide-react";
import GameMenu, { confirmQuitGame } from "@/components/games/GameMenu";
import { MAX_HEARTS, SugarRushMazeState } from "@/lib/sugar-rush-maze";

type Props = {
  st: SugarRushMazeState;
  best: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onBack: () => void;
  onQuit?: () => void;
};

/** Compact Sugar Rush HUD. The old long Sugar Meter bar was intentionally removed because
 * it covered too much of the maze in landscape. Meter progress now lives in a small pill. */
export default function SugarRushHud({ st, best, muted, onToggleMute, onPause, onBack, onQuit }: Props) {
  const meter = st.rushActive ? 100 : Math.round(st.sugarMeter);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 select-none px-3 pt-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#190b2b]/75 px-2 py-1.5 shadow-lg backdrop-blur-sm">
          {Array.from({ length: MAX_HEARTS }, (_, i) => (
            <Heart key={i} className={`h-3.5 w-3.5 ${i < st.hearts ? "text-rose-400" : "text-white/20"}`} fill={i < st.hearts ? "currentColor" : "none"} />
          ))}
        </div>

        <div className="min-w-0 max-w-[48%] flex-1 rounded-2xl border border-white/10 bg-[#190b2b]/72 px-3 py-1.5 text-center shadow-lg backdrop-blur-sm">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-yellow-100">
            {st.exitUnlocked ? "Exit unlocked!" : st.objectiveLabel}
          </p>
          {!st.exitUnlocked && <p className="text-[10px] font-bold text-white/80">{st.objectiveProgress}/{st.objectiveTarget}</p>}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="rounded-2xl border border-white/10 bg-[#190b2b]/72 px-2.5 py-1.5 text-right shadow-lg backdrop-blur-sm">
            <p className="text-[12px] font-black tabular-nums text-white">{st.score.toLocaleString()}</p>
            {best ? <p className="text-[8px] font-bold text-white/55">BEST {best.toLocaleString()}</p> : null}
          </div>
          <GameMenu
            triggerClassName="pointer-events-auto flex items-center rounded-full border border-white/10 bg-[#190b2b]/75 px-2.5 py-2 text-white shadow-lg backdrop-blur-sm active:scale-95"
            actions={[
              { key: "pause", label: "Pause", icon: Pause, onClick: onPause },
              { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? VolumeX : Volume2, onClick: onToggleMute, active: muted },
              { key: "back", label: "Leave Candy City", icon: ArrowLeft, onClick: onBack },
              ...(onQuit ? [{ key: "quit", label: "Quit Game", icon: LogOut, onClick: () => confirmQuitGame(onQuit), destructive: true }] : []),
            ]}
          />
        </div>
      </div>

      <div className="mt-1.5 flex justify-center">
        <div className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] shadow-md backdrop-blur-sm ${st.rushActive ? "sr-rush-pulse border-yellow-200/50 bg-fuchsia-600/80 text-yellow-100" : "border-white/10 bg-[#190b2b]/60 text-white/75"}`}>
          {st.rushActive ? `Sugar Rush · ${Math.ceil(st.rushTimeLeft)}s` : `Sugar ${meter}%`}
        </div>
      </div>
    </div>
  );
}
