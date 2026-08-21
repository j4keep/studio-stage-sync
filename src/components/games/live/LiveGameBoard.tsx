import { GameType } from "@/lib/games";
import LivePoolBoard from "./LivePoolBoard";
import LiveFleetClashBoard from "./LiveFleetClashBoard";

/**
 * Dispatches to the real mirrored board for a game type. Pool and Fleet Clash are fully
 * wired (the real ball positions / race progress redraw live); everything else falls back to
 * a simple live face-off card until it gets its own mirror the same way.
 */
export default function LiveGameBoard({
  gameId,
  gameType,
  gameState,
  playerNames,
  playerAvatars,
}: {
  gameId: string;
  gameType: GameType;
  gameState: any;
  playerNames: string[];
  playerAvatars: (string | null)[];
}) {
  if (gameType === "pool") {
    return <LivePoolBoard pool={gameState?.pool ?? null} />;
  }
  if (gameType === "battleship") {
    return <LiveFleetClashBoard gameId={gameId} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-900 to-black">
      <div className="flex items-center gap-6">
        {(playerAvatars.length ? playerAvatars : [null, null]).slice(0, 2).map((a, i) => (
          <span key={i} className="h-16 w-16 overflow-hidden rounded-full border-2 border-white/20 bg-white/10">
            {a ? <img src={a} alt="" className="h-full w-full object-cover" /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
