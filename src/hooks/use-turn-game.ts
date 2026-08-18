import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GamePlayerRow, GameRow, loadGame } from "@/lib/games";

/** Loads a match, keeps it live over Realtime, and resolves opponent names. */
export function useTurnGame(id: string | undefined, userId: string | undefined) {
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<GamePlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [opponentName, setOpponentName] = useState("Opponent");
  const [opponentAvatar, setOpponentAvatar] = useState<string | null>(null);
  const statusRef = useRef<string | null>(null);
  statusRef.current = game?.status ?? null;

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

  // Realtime subscription, with a catch-up refresh whenever it (re)connects — mobile
  // browsers suspend WebSockets when a tab is backgrounded or the phone locks, and a
  // reconnect after that gap can silently miss the update it was suspended through, so a
  // fresh subscribe is exactly the moment to also re-fetch, not just from then on.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const channel = supabase
      .channel(`game-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") void refresh();
      });
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [id, refresh]);

  // Belt-and-suspenders catch-up: re-fetch whenever the tab regains focus/visibility or
  // the network comes back, and poll gently in the background while a match is live, so a
  // dropped realtime event never leaves either player stuck looking at a stale board.
  useEffect(() => {
    if (!id) return;
    const onWake = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (statusRef.current === "completed" || statusRef.current === "cancelled") return;
      void refresh();
    }, 8000);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      window.clearInterval(poll);
    };
  }, [id, refresh]);

  const me = players.find((p) => p.user_id === userId);
  const opponent = players.find((p) => p.id !== me?.id);

  useEffect(() => {
    if (!opponent?.user_id) {
      setOpponentName(opponent?.is_computer ? "Computer" : "Opponent");
      setOpponentAvatar(null);
      return;
    }
    void (supabase as any)
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", opponent.user_id)
      .maybeSingle()
      .then(({ data }: any) => {
        setOpponentName(data?.display_name || "Opponent");
        setOpponentAvatar(data?.avatar_url || null);
      });
  }, [opponent?.user_id, opponent?.is_computer]);

  return { game, setGame, players, loading, refresh, me, opponent, opponentName, opponentAvatar };
}
