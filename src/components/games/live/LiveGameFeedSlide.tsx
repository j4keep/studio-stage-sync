import { useLiveGameRow } from "@/hooks/use-live-game-row";
import LiveGameBoard from "./LiveGameBoard";
import LiveGameWatchPanel from "./LiveGameWatchPanel";
import { LiveGameCard } from "@/lib/game-live";

/** A live game rendered as a full-height feed slide — the real board, mirrored live,
 *  exactly like any other post you swipe past. Nothing here leads into the interactive
 *  game; that page is for the two people actually playing. */
export default function LiveGameFeedSlide({ game, isActive }: { game: LiveGameCard; isActive: boolean }) {
  const row = useLiveGameRow(game.id);
  const stillLive = row ? row.status === "active" || row.status === "waiting" : true;

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live · {game.label}
          </p>
          <p className="truncate text-sm font-black text-white">
            {game.playerNames.length ? game.playerNames.join(" vs ") : "Match in progress"}
          </p>
        </div>
      </div>

      <div className="relative mx-4 mt-3 aspect-[4/3] shrink-0 overflow-hidden rounded-2xl border border-white/10">
        <LiveGameBoard
          gameType={game.gameType}
          gameState={row?.game_state}
          playerNames={game.playerNames}
          playerAvatars={game.playerAvatars}
        />
        {!stillLive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">
              Match ended
            </span>
          </div>
        )}
      </div>

      <LiveGameWatchPanel gameId={game.id} active={isActive} />
    </div>
  );
}
