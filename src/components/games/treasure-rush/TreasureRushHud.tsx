import { ArrowLeft, Heart, KeyRound, Pause, Play, Timer, Volume2, VolumeX } from "lucide-react";
import MiniMap from "@/components/games/treasure-rush/MiniMap";
import { clockLabel } from "@/lib/treasure-rush/score";
import { MAX_HEARTS, PowerKind } from "@/lib/treasure-rush/engine";

export type HudSnapshot = {
  hearts: number;
  timeLeft: number;
  score: number;
  coins: number;
  gems: number;
  chests: number;
  goldChests: number;
  keys: { blue: boolean; gold: boolean };
  powers: Record<PowerKind, number>;
  x: number;
  z: number;
  visited: string[];
};

const POWER_LABEL: Record<PowerKind, { label: string; color: string }> = {
  magnet: { label: "Magnet", color: "#ff6ba8" },
  boost: { label: "Speed", color: "#ffd84d" },
  shield: { label: "Shield", color: "#37c8ff" },
};

/** GameHUD — minimal top strip: hearts, timer, treasure, keys, plus mini-map and controls. */
export default function TreasureRushHud({
  hud,
  best,
  muted,
  paused,
  onBack,
  onToggleMute,
  onTogglePause,
}: {
  hud: HudSnapshot;
  best?: number | null;
  muted: boolean;
  paused: boolean;
  onBack: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
}) {
  const low = hud.timeLeft <= 30_000;
  const active = (Object.keys(hud.powers) as PowerKind[]).filter((k) => hud.powers[k] > 0);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to games"
            className="rounded-full bg-black/50 p-2 text-white backdrop-blur-md active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1.5 backdrop-blur-md">
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <Heart
                key={i}
                className={`h-4 w-4 ${i < hud.hearts ? "text-rose-400" : "text-white/25"}`}
                fill={i < hud.hearts ? "currentColor" : "none"}
              />
            ))}
          </div>
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black backdrop-blur-md ${
            low ? "bg-rose-600/80 text-white" : "bg-black/50 text-white"
          }`}
        >
          <Timer className="h-4 w-4" />
          {clockLabel(hud.timeLeft)}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <div className="rounded-full bg-black/50 px-3 py-1.5 text-right backdrop-blur-md">
            <p className="text-sm font-black leading-none text-amber-300">{hud.score.toLocaleString()}</p>
            {best ? <p className="text-[9px] font-bold text-white/60">best {best.toLocaleString()}</p> : null}
          </div>
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={paused ? "Resume" : "Pause"}
            className="rounded-full bg-black/50 p-2 text-white backdrop-blur-md active:scale-95"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="rounded-full bg-black/50 p-2 text-white backdrop-blur-md active:scale-95"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            {(["blue", "gold"] as const).map((k) => (
              <span
                key={k}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black backdrop-blur-md"
                style={{
                  background: hud.keys[k] ? (k === "blue" ? "#3b82f6" : "#f0b429") : "rgba(0,0,0,0.45)",
                  color: hud.keys[k] ? "#0b0b16" : "rgba(255,255,255,0.45)",
                }}
              >
                <KeyRound className="h-3 w-3" /> {k === "blue" ? "Blue" : "Gold"}
              </span>
            ))}
          </div>
          <p className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur-md">
            {hud.coins} coins · {hud.gems} gems · {hud.chests + hud.goldChests} chests
          </p>
          {active.length > 0 && (
            <div className="flex gap-1.5">
              {active.map((k) => (
                <span
                  key={k}
                  className="rounded-full px-2 py-0.5 text-[10px] font-black text-black"
                  style={{ background: POWER_LABEL[k].color }}
                >
                  {POWER_LABEL[k].label} {(hud.powers[k] / 1000).toFixed(0)}s
                </span>
              ))}
            </div>
          )}
        </div>

        <MiniMap x={hud.x} z={hud.z} visited={hud.visited} />
      </div>
    </div>
  );
}
