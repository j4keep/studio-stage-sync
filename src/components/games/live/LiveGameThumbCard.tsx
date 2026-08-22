import { useLiveGameRow } from "@/hooks/use-live-game-row";
import { LiveGameCard } from "@/lib/game-live";
import LiveGameBoard from "./LiveGameBoard";

/** Grid-view tile for a live game — the real board mirrored small, same as a video post
 *  thumbnail would autoplay. Tapping it opens the full swipeable slide, same as any post;
 *  it never opens the actual interactive game. */
export default function LiveGameThumbCard({ game, onOpen }: { game: LiveGameCard; onOpen: () => void }) {
  const row = useLiveGameRow(game.id);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 text-left shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition active:scale-[0.98]"
    >
      <LiveGameBoard
        gameType={game.gameType}
        gameState={row?.game_state}
        playerNames={game.playerNames}
        playerAvatars={game.playerAvatars}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

      <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-sm font-black text-white">{game.label}</p>
        <p className="mt-0.5 truncate text-[10px] font-bold text-white/70">
          {game.playerNames.length ? game.playerNames.join(" vs ") : "Match in progress"}
        </p>
      </div>
    </button>
  );
}
