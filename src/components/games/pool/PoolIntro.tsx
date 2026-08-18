import { useState } from "react";
import { Play, Volume2, VolumeX, X, MonitorPlay, Zap, Trophy, Gamepad2 } from "lucide-react";
import art from "@/assets/games/yaj-billiards-intro.png.asset.json";

export type PoolMatchup = {
  id: string;
  label: string;
  detail: string;
  outcome: "win" | "loss" | "open";
};

export type PoolStats = {
  played: number;
  wins: number;
  losses: number;
  bestStreak: number;
  highScore: number;
};

type Props = {
  open: boolean;
  subtitle: string;
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onBack: () => void;
  stats?: PoolStats | null;
  matchups?: PoolMatchup[];
  onPlaySolo?: () => void;
  onQuickMatch?: () => void;
};

/** Pre-game splash for 8-ball pool — YAJ Billiards key art with functional quick-action row. */
export default function PoolIntro({
  open,
  subtitle,
  muted,
  onToggleMute,
  onStart,
  onBack,
  stats,
  matchups = [],
  onPlaySolo,
  onQuickMatch,
}: Props) {
  const [sheet, setSheet] = useState(false);
  if (!open) return null;

  const purple = "hsl(275 85% 68%)";

  return (
    <div className="absolute inset-0 z-50 overflow-hidden animate-fade-in bg-[#07070c]">
      <img
        src={art.url}
        alt="YAJ Billiards 8-Ball Pool table"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 30%, transparent 0%, rgba(7,4,16,0.35) 65%, rgba(5,3,10,0.85) 100%)",
        }}
      />

      <button
        type="button"
        onClick={onBack}
        aria-label="Leave table"
        className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black text-white active:scale-95"
        style={{ borderColor: purple, background: "rgba(10,6,20,0.7)", boxShadow: `0 0 14px ${purple}55` }}
      >
        <Gamepad2 className="h-3.5 w-3.5" style={{ color: purple }} /> YAJ Game
        <X className="ml-1 h-3 w-3 opacity-70" />
      </button>

      <div className="absolute right-3 top-3 flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-white"
          style={{ borderColor: purple, background: "rgba(10,6,20,0.7)", boxShadow: `0 0 14px ${purple}55` }}
        >
          <Trophy className="h-3.5 w-3.5" style={{ color: purple }} />
          <span className="text-[9px] font-black leading-tight">
            High Score
            <br />
            <span className="text-[11px]">{stats?.highScore ?? 0}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
          className="rounded-full bg-black/60 p-2 text-white active:scale-95"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-4">
        <p className="text-center text-xs font-bold italic text-white/85 drop-shadow">{subtitle}</p>
        <button
          type="button"
          onClick={onStart}
          className="flex w-full max-w-sm items-center justify-center gap-3 rounded-full px-7 py-3.5 text-white active:scale-95"
          style={{
            background: "linear-gradient(135deg, hsl(275 75% 52%), hsl(255 80% 46%))",
            border: `2px solid ${purple}`,
            boxShadow: `0 0 30px ${purple}99, 0 6px 14px rgba(0,0,0,0.55)`,
          }}
        >
          <Play className="h-5 w-5" fill="currentColor" />
          <span className="text-left leading-tight">
            <span className="block text-lg font-black">Tap to Break</span>
            <span className="block text-[11px] font-semibold opacity-90">and Start the Game</span>
          </span>
        </button>

        <div
          className="grid w-full max-w-sm grid-cols-3 divide-x rounded-2xl border"
          style={{ borderColor: `${purple}88`, background: "rgba(10,6,22,0.75)", borderRightColor: `${purple}88` }}
        >
          <button
            type="button"
            onClick={() => onPlaySolo?.()}
            className="flex items-center justify-center gap-1.5 px-2 py-3 text-left text-white active:scale-95"
            style={{ borderColor: `${purple}44` }}
          >
            <MonitorPlay className="h-4 w-4 shrink-0" style={{ color: purple }} />
            <span className="text-[10px] font-black leading-tight">
              Play Solo
              <br />
              vs Computer
            </span>
          </button>
          <button
            type="button"
            onClick={() => onQuickMatch?.()}
            className="flex items-center justify-center gap-1.5 px-2 py-3 text-left text-white active:scale-95"
            style={{ borderColor: `${purple}44` }}
          >
            <Zap className="h-4 w-4 shrink-0" style={{ color: purple }} />
            <span className="text-[10px] font-black leading-tight">
              Quick
              <br />
              Match
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="flex items-center justify-center gap-1.5 px-2 py-3 text-left text-white active:scale-95"
            style={{ borderColor: `${purple}44` }}
          >
            <Trophy className="h-4 w-4 shrink-0" style={{ color: purple }} />
            <span className="text-[10px] font-black leading-tight">
              Track Your
              <br />
              Best Break
            </span>
          </button>
        </div>
      </div>

      {sheet && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/70 animate-fade-in" onClick={() => setSheet(false)}>
          <div
            className="max-h-[80%] w-full overflow-y-auto rounded-t-3xl border-t p-5 text-white animate-slide-in-right"
            style={{ borderColor: purple, background: "#0c0718" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black">Your pool record</h3>
              <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                ["Played", stats?.played ?? 0],
                ["Wins", stats?.wins ?? 0],
                ["Losses", stats?.losses ?? 0],
                ["Best run", stats?.bestStreak ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border p-2 text-center" style={{ borderColor: `${purple}55` }}>
                  <p className="text-lg font-black">{value as number}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-white/60">{label}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: purple }}>
              Your matchups
            </p>
            <div className="mt-2 space-y-2 pb-2">
              {matchups.length === 0 && (
                <p className="text-xs font-semibold text-white/55">No pool matchups yet — break a rack to get on the board.</p>
              )}
              {matchups.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border px-3 py-2"
                  style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}
                >
                  <div>
                    <p className="text-xs font-black">{m.label}</p>
                    <p className="text-[10px] font-semibold text-white/55">{m.detail}</p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase"
                    style={{
                      background:
                        m.outcome === "win" ? "hsl(145 70% 40%)" : m.outcome === "loss" ? "hsl(0 70% 45%)" : `${purple}66`,
                    }}
                  >
                    {m.outcome === "open" ? "In play" : m.outcome}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
