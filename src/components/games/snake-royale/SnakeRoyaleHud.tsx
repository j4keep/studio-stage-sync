import { ArrowLeft, Heart, LogOut, Pause, Sparkles, Volume2, VolumeX } from "lucide-react";
import GameMenu from "@/components/games/GameMenu";
import { confirmQuitGame } from "@/components/games/QuitGameButton";
import { MAX_HEARTS, SnakeRoyaleState, waveLabel, waveProgress } from "@/lib/snake-royale/engine";
import { formatClock } from "@/lib/snake-royale/score";

type Props = {
  st: SnakeRoyaleState;
  best: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onBack: () => void;
  onQuit?: () => void;
};

/** Hearts, survival/survived timer, score, stars, wave banner and objectives. */
export default function SnakeRoyaleHud({ st, best, muted, onToggleMute, onPause, onBack, onQuit }: Props) {
  const wave = waveLabel(st);
  const urgent = !st.endless && st.timeLeft <= 10_000;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-1.5 backdrop-blur">
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Heart
                  key={i}
                  className={`h-4 w-4 ${i < st.hearts ? "fill-rose-500 text-rose-500" : "text-white/25"}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-white/15 bg-black/45 px-2.5 py-1 backdrop-blur">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Score</p>
              <p className="text-sm font-black tabular-nums text-white">{st.score.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-sm font-black tabular-nums text-white">{st.stars}</span>
            </div>
          </div>

          {best !== null && (
            <p className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-white/60 backdrop-blur">
              Best {best.toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <GameMenu
              triggerClassName="pointer-events-auto flex items-center gap-1 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-white backdrop-blur active:scale-95"
              actions={[
                { key: "pause", label: "Pause", icon: Pause, onClick: onPause },
                { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? VolumeX : Volume2, onClick: onToggleMute, active: muted },
                { key: "back", label: "Leave the Jungle", icon: ArrowLeft, onClick: onBack },
                ...(onQuit ? [{ key: "quit", label: "Quit Game", icon: LogOut, onClick: () => confirmQuitGame(onQuit), destructive: true }] : []),
              ]}
            />
          </div>

          <div
            className={`rounded-lg border px-3 py-1 text-right backdrop-blur ${
              urgent ? "border-rose-400/60 bg-rose-500/25" : "border-white/15 bg-black/45"
            }`}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">{st.endless ? "Survived" : "Survive"}</p>
            <p className={`text-lg font-black tabular-nums ${urgent ? "text-rose-200" : "text-white"}`}>
              {st.endless ? formatClock(st.t * 1000) : formatClock(st.timeLeft)}
            </p>
          </div>
        </div>
      </div>

      {/* wave meter */}
      <div className="absolute left-1/2 top-3 w-36 -translate-x-1/2 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-center backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-widest text-white">{wave.name}</p>
        <p className="truncate text-[9px] font-bold text-white/55">{wave.sub}</p>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-amber-300" style={{ width: `${waveProgress(st) * 100}%` }} />
        </div>
      </div>

      <div className="absolute bottom-24 right-3 rounded-full border border-amber-200/25 bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-100 backdrop-blur">
        {st.driving ? "🚙 Escape road — GO!" : st.weapon ? `🛡 ${st.weapon} ${st.weapon === "stick" ? "ready" : `×${st.weaponUses}`}` : "Find a defense tool"}
      </div>

      {/* objectives */}
      <div className="absolute bottom-24 left-3 flex flex-col gap-1">
        {st.objectives.map((o) => (
          <div
            key={o.id}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur ${
              o.done
                ? "border-emerald-400/50 bg-emerald-500/25 text-emerald-100 line-through"
                : "border-white/15 bg-black/40 text-white/75"
            }`}
          >
            {o.label} {o.target > 1 && !o.done ? `(${Math.min(o.progress, o.target)}/${o.target})` : ""}
          </div>
        ))}
      </div>

      {/* wave announcement */}
      {st.waveFlash > 0 && (
        <div className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-1">
          <p className="text-3xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]">
            {wave.name}
          </p>
          <p className="text-sm font-black uppercase tracking-widest text-amber-200">{wave.sub}</p>
        </div>
      )}

      {/* hazard toast */}
      {st.toast && (
        <div className="absolute inset-x-0 bottom-40 flex justify-center">
          <p className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
            {st.toast.text}
          </p>
        </div>
      )}
    </div>
  );
}
