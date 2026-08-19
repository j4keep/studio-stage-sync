import { useEffect, useState } from "react";
import { MonitorPlay, Trophy, X, Zap } from "lucide-react";
import { GameType, getMyStats, listMyGames } from "@/lib/games";

export type GameMatchup = {
  id: string;
  label: string;
  detail: string;
  outcome: "win" | "loss" | "draw" | "open";
};

export type GameRecordStats = {
  played: number;
  wins: number;
  losses: number;
  bestStreak: number;
  highScore: number;
};

/** Loads the signed-in player's record + recent matchups for one game type. */
export function useGameRecord(gameType: GameType, userId: string | undefined, dep?: unknown) {
  const [stats, setStats] = useState<GameRecordStats | null>(null);
  const [matchups, setMatchups] = useState<GameMatchup[]>([]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const [rows, games] = await Promise.all([getMyStats(userId), listMyGames(userId)]);
        const s = rows.find((r) => r.game_type === gameType);
        setStats({
          played: s?.games_played ?? 0,
          wins: s?.wins ?? 0,
          losses: s?.losses ?? 0,
          bestStreak: s?.best_streak ?? 0,
          highScore: s?.high_score ?? 0,
        });
        setMatchups(
          games
            .filter((g: any) => g.game_type === gameType)
            .slice(0, 10)
            .map((g: any) => ({
              id: g.id,
              label: g.mode === "solo" ? "Solo vs Computer" : "Head-to-head match",
              detail: new Date(g.updated_at || g.created_at).toLocaleDateString(),
              outcome:
                g.status !== "completed"
                  ? ("open" as const)
                  : g.is_draw
                    ? ("draw" as const)
                    : g.winner_user_id === userId
                      ? ("win" as const)
                      : ("loss" as const),
            })),
        );
      } catch {
        /* record is non-critical */
      }
    })();
  }, [gameType, userId, dep]);

  return { stats, matchups };
}

type Props = {
  stats?: GameRecordStats | null;
  matchups?: GameMatchup[];
  onPlaySolo?: () => void;
  onQuickMatch?: () => void;
  /** Label for the third action, e.g. "Track Your Best Break". */
  recordLabel?: string;
  accent?: string;
};

/** Shared 3-up action row (solo · quick match · record) used by every game's intro screen. */
export default function GameQuickActions({
  stats,
  matchups = [],
  onPlaySolo,
  onQuickMatch,
  recordLabel = "Track Your Record",
  accent = "hsl(275 85% 68%)",
}: Props) {
  const [sheet, setSheet] = useState(false);
  const [a, b] = recordLabel.split(/\s(.+)/);

  return (
    <>
      <div
        className="grid w-full max-w-sm grid-cols-3 divide-x rounded-2xl border"
        style={{ borderColor: `${accent}88`, background: "rgba(10,6,22,0.75)", borderRightColor: `${accent}88` }}
      >
        <button
          type="button"
          onClick={() => onPlaySolo?.()}
          className="flex items-center justify-center gap-1.5 px-2 py-3 text-left text-white active:scale-95"
        >
          <MonitorPlay className="h-4 w-4 shrink-0" style={{ color: accent }} />
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
        >
          <Zap className="h-4 w-4 shrink-0" style={{ color: accent }} />
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
        >
          <Trophy className="h-4 w-4 shrink-0" style={{ color: accent }} />
          <span className="text-[10px] font-black leading-tight">
            {a}
            <br />
            {b}
          </span>
        </button>
      </div>

      {sheet && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/70 animate-fade-in" onClick={() => setSheet(false)}>
          <div
            className="max-h-[80%] w-full overflow-y-auto rounded-t-3xl border-t p-5 text-left text-white"
            style={{ borderColor: accent, background: "#0c0718" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black">Your record</h3>
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
                <div key={String(label)} className="rounded-xl border p-2 text-center" style={{ borderColor: `${accent}55` }}>
                  <p className="text-lg font-black">{value as number}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-white/60">{label}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: accent }}>
              Your matchups
            </p>
            <div className="mt-2 space-y-2 pb-2">
              {matchups.length === 0 && (
                <p className="text-xs font-semibold text-white/55">No matchups yet — play a round to get on the board.</p>
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
                        m.outcome === "win"
                          ? "hsl(145 70% 40%)"
                          : m.outcome === "loss"
                            ? "hsl(0 70% 45%)"
                            : `${accent}66`,
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
    </>
  );
}
