import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, LogOut, Pause, Volume2, VolumeX } from "lucide-react";
import GameMenu from "@/components/games/GameMenu";
import { confirmQuitGame } from "@/components/games/QuitGameButton";
import { MAX_HEARTS, SugarRushMazeState } from "@/lib/sugar-rush-maze";
import "./sugar-rush.css";

type Props = {
  st: SugarRushMazeState;
  best: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onBack: () => void;
  onQuit?: () => void;
};

/** Compact HUD: never reserves a bar across the maze. Objective text appears briefly as a
 * toast and then gets completely out of the player's way. */
export default function SugarRushHud({ st, best, muted, onToggleMute, onPause, onBack, onQuit }: Props) {
  const [objectiveToast, setObjectiveToast] = useState<string | null>(null);
  const lastProgressRef = useRef(-1);
  const lastUnlockedRef = useRef(false);
  const initialShownRef = useRef(false);

  useEffect(() => {
    let timer: number | undefined;

    if (!initialShownRef.current) {
      initialShownRef.current = true;
      setObjectiveToast(st.objectiveLabel);
      timer = window.setTimeout(() => setObjectiveToast(null), 2300);
    } else if (st.exitUnlocked && !lastUnlockedRef.current) {
      setObjectiveToast("Exit unlocked — reach the gate!");
      timer = window.setTimeout(() => setObjectiveToast(null), 2200);
    } else if (
      !st.exitUnlocked &&
      st.objectiveProgress > lastProgressRef.current &&
      lastProgressRef.current >= 0
    ) {
      setObjectiveToast(`${st.objectiveProgress}/${st.objectiveTarget} complete`);
      timer = window.setTimeout(() => setObjectiveToast(null), 950);
    }

    lastProgressRef.current = st.objectiveProgress;
    lastUnlockedRef.current = st.exitUnlocked;
    return () => { if (timer) window.clearTimeout(timer); };
  }, [st.exitUnlocked, st.objectiveLabel, st.objectiveProgress, st.objectiveTarget]);

  return (
    <>
      {/* Only tiny corner controls remain persistent. Nothing stretches across the maze. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-2.5"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/15 bg-[#130b24]/72 px-2 py-1.5 shadow-lg backdrop-blur-sm">
            {Array.from({ length: MAX_HEARTS }, (_, i) => (
              <Heart key={i} className={`h-3.5 w-3.5 ${i < st.hearts ? "text-rose-400" : "text-white/20"}`} fill={i < st.hearts ? "currentColor" : "none"} />
            ))}
          </div>
          <div className="pointer-events-auto">
            <GameMenu
              triggerClassName="flex items-center rounded-full border border-white/15 bg-[#130b24]/72 px-2.5 py-2 text-white shadow-lg backdrop-blur-sm active:scale-95"
              actions={[
                { key: "pause", label: "Pause", icon: Pause, onClick: onPause },
                { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? VolumeX : Volume2, onClick: onToggleMute, active: muted },
                { key: "back", label: "Leave Candy City", icon: ArrowLeft, onClick: onBack },
                ...(onQuit ? [{ key: "quit", label: "Quit Game", icon: LogOut, onClick: () => confirmQuitGame(onQuit), destructive: true }] : []),
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="rounded-full border border-white/15 bg-[#130b24]/72 px-2.5 py-1.5 text-right shadow-lg backdrop-blur-sm">
            <p className="text-[11px] font-black tabular-nums text-white">{st.score.toLocaleString()}</p>
            {best ? <p className="text-[7px] font-bold uppercase tracking-wide text-white/45">Best {best.toLocaleString()}</p> : null}
          </div>
          <div className={`rounded-full border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide shadow-lg backdrop-blur-sm ${st.rushActive ? "border-yellow-300/50 bg-yellow-400/25 text-yellow-100" : "border-pink-300/20 bg-[#130b24]/72 text-pink-100"}`}>
            {st.rushActive ? `Rush ${Math.ceil(st.rushTimeLeft)}s` : `Sugar ${Math.round(st.sugarMeter)}%`}
          </div>
        </div>
      </div>

      {/* Objective is transient only; it never permanently blocks maze corridors. */}
      {objectiveToast && (
        <div className="pointer-events-none absolute inset-x-0 top-[13%] z-30 flex justify-center px-5">
          <div className="max-w-[78%] rounded-full border border-yellow-200/30 bg-[#211135]/88 px-4 py-2 text-center shadow-xl backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-yellow-100">{objectiveToast}</p>
          </div>
        </div>
      )}
    </>
  );
}
