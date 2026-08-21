import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameRow, loadGame } from "@/lib/games";

/** Keeps a single game row live-updated (game_state, status, is_live) — the same row a
 *  spectator's feed post mirrors, so the board redraws the instant a player moves and the
 *  post drops off the moment the match actually ends. */
export function useLiveGameRow(gameId: string) {
  const [game, setGame] = useState<GameRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGame(gameId).then(({ game: g }) => {
      if (!cancelled) setGame(g);
    });

    const channel = supabase
      .channel(`live-game-row-${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload: any) => setGame(payload.new as GameRow),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [gameId]);

  return game;
}
