import { ArrowLeft, Flag, Heart, LogOut, Pause, Star, Timer, Volume2, VolumeX } from "lucide-react";
import GameMenu from "@/components/games/GameMenu";
import { confirmQuitGame } from "@/components/games/QuitGameButton";
import { TowerState } from "@/lib/tower-escape/engine";
import { TOTAL_CHECKPOINTS } from "@/lib/tower-escape/level";
import { formatClock } from "@/lib/tower-escape/score";

type Props = {
  st: TowerState;
  sectionName: string;
  best: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onBack: () => void;
  onQuit?: () => void;
};

/** Hearts · Time · Stars · Checkpoint counter — the four things the run lives on. */
export default function TowerHud({ st, sectionName, best, muted, onToggleMute, onPause, onBack, onQuit }: Props) {
  const low = st.timeLeft <= 30_000;
  const climbed = Math.min(100, Math.round((st.highest / st.level.top) * 100));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 select-none px-3 pt-3">
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <GameMenu
            triggerClassName="flex items-center gap-1 rounded-full bg-black/55 px-3 py-2 text-white backdrop-blur-sm active:scale-95"
            actions={[
              { key: "pause", label: "Pause", icon: Pause, onClick: onPause },
              { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? VolumeX : Volume2, onClick: onToggleMute, active: muted },
              { key: "back", label: "Leave Tower", icon: ArrowLeft, onClick: onBack },
              ...(onQuit ? [{ key: "quit", label: "Quit Game", icon: LogOut, onClick: () => confirmQuitGame(onQuit), destructive: true }] : []),
            ]}
          />
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-sm ${
              low ? "bg-rose-600/80 animate-pulse" : "bg-black/55"
            }`}
          >
            <Timer className="h-3.5 w-3.5 text-white" />
            <span className="text-[13px] font-black tabular-nums text-white">{formatClock(st.timeLeft)}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[13px] font-black tabular-nums text-white">{st.stars}</span>
            <span className="ml-1 text-[11px] font-black tabular-nums text-amber-200">
              {st.score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              className={`h-4 w-4 ${i < st.hearts ? "text-rose-400" : "text-white/20"}`}
              fill={i < st.hearts ? "currentColor" : "none"}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
          <Flag className="h-3.5 w-3.5 text-emerald-300" />
          <span className="text-[11px] font-black text-white">
            {st.checkpoint}/{TOTAL_CHECKPOINTS}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300 transition-[width] duration-200"
            style={{ width: `${climbed}%` }}
          />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wide text-white/70">{climbed}%</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">{sectionName}</p>
        {best ? <p className="text-[10px] font-black text-white/50">BEST {best.toLocaleString()}</p> : null}
      </div>

      {st.checkpointFlash > 0 && (
        <p className="mt-3 text-center text-sm font-black uppercase tracking-widest text-emerald-300 drop-shadow">
          Checkpoint {st.cpJustHit} reached
        </p>
      )}

      {(st.powers.shield > 0 || st.powers.double > 0 || st.powers.speed > 0) && (
        <div className="mt-2 flex justify-center gap-2">
          {st.powers.shield > 0 && <Pill label="Shield" tone="#38bdf8" />}
          {st.powers.double > 0 && <Pill label={`Double jump ${Math.ceil(st.powers.double)}s`} tone="#7de0a6" />}
          {st.powers.speed > 0 && <Pill label={`Sprint ${Math.ceil(st.powers.speed)}s`} tone="#fb7185" />}
        </div>
      )}
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
      style={{ background: `${tone}22`, color: tone, border: `1px solid ${tone}66` }}
    >
      {label}
    </span>
  );
}
