import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import { listLiveGames } from "@/lib/game-live";

/** Horizontal strip of matches that are on air right now — tap to watch and hear the players. */
export default function LiveGamesRail() {
  const navigate = useNavigate();
  const { data: live = [] } = useQuery({
    queryKey: ["live-games"],
    queryFn: () => listLiveGames(12),
    refetchInterval: 20_000,
  });

  if (!live.length) return null;

  return (
    <div className="mb-3 rounded-xl border border-border bg-card/95 p-2.5 shadow-sm">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        Live Games
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {live.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => navigate(g.route)}
            className="w-[132px] shrink-0 rounded-lg border border-border bg-background p-2 text-left transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-1.5">
              <Gamepad2 className="h-3.5 w-3.5 text-primary" />
              <span className="truncate text-[11px] font-black text-foreground">{g.label}</span>
            </div>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              {g.playerNames.length ? g.playerNames.join(" vs ") : "Match in progress"}
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-500">
              <span className="h-1 w-1 rounded-full bg-red-500" /> Live
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
