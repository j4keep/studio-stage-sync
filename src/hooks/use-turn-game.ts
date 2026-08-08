import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GamePlayerRow, GameRow, loadGame } from "@/lib/games";

/** Loads a match, keeps it live over Realtime, and resolves opponent names. */
export function useTurnGame(id: string | undefined, userId: string | undefined) {
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<GamePlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [opponentName, setOpponentName] = useState("Opponent");

  const refresh = useCallback(async () => {
    if (!id) return;
    const { game: g, players: p } = await loadGame(id);
    setGame(g);
    setPlayers(p);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`game-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, refresh]);

  const me = players.find((p) => p.user_id === userId);
  const opponent = players.find((p) => p.id !== me?.id);

  useEffect(() => {
    if (!opponent?.user_id) {
      setOpponentName(opponent?.is_computer ? "Computer" : "Opponent");
      return;
    }
    void (supabase as any)
      .from("profiles")
      .select("display_name")
      .eq("user_id", opponent.user_id)
      .maybeSingle()
      .then(({ data }: any) => setOpponentName(data?.display_name || "Opponent"));
  }, [opponent?.user_id, opponent?.is_computer]);

  return { game, setGame, players, loading, refresh, me, opponent, opponentName };
}
