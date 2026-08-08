import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RotateCcw, Share2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import {
  Board,
  EMPTY_BOARD,
  computerMove,
  isDraw,
  isLegalMove,
  winner,
  winningLine,
} from "@/lib/tic-tac-toe";
import {
  GamePlayerRow,
  GameRow,
  bumpStats,
  createMultiplayerGame,
  createSoloGame,
  loadGame,
  recordMove,
  updateGameState,
} from "@/lib/games";

export default function TicTacToePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<GamePlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const statsWritten = useRef<string | null>(null);
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
      .channel(`ttt-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` }, () =>
        void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, refresh]);

  const me = players.find((p) => p.user_id === user?.id);
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

  const board: Board = (game?.game_state?.board as Board) || EMPTY_BOARD;
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySymbol = (me?.symbol as "X" | "O") || "X";
  const line = winningLine(board);
  const w = winner(board);
  const draw = isDraw(board);
  const finished = Boolean(w) || draw;
  const myTurn = game?.status === "active" && game.current_turn_user_id === user?.id && !finished;

  // Persist stats once when a game finishes.
  useEffect(() => {
    if (!game || !user || !finished || statsWritten.current === game.id) return;
    if (game.status === "completed") {
      statsWritten.current = game.id;
      return;
    }
    statsWritten.current = game.id;
    const outcome = draw ? "draw" : w === mySymbol ? "win" : "loss";
    const winnerId = draw ? null : w === mySymbol ? user.id : (opponent?.user_id ?? null);
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: winnerId,
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "tic_tac_toe", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const applyMove = async (index: number) => {
    if (!game || !user || !myTurn) return;
    if (!isLegalMove(board, index)) {
      toast({ title: "That square is taken" });
      return;
    }

    const next = [...board];
    next[index] = mySymbol;
    let nextTurn = opponent?.user_id ?? null;
    let n = moveNumber + 1;

    // Optimistic UI
    setGame({ ...game, game_state: { board: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await recordMove(game.id, user.id, n, { index, symbol: mySymbol });

    // Solo mode: computer replies immediately.
    if (game.mode === "solo" && !winner(next) && !isDraw(next)) {
      const cpuSymbol = mySymbol === "X" ? "O" : "X";
      const cpuIndex = computerMove(next, cpuSymbol);
      if (cpuIndex >= 0) {
        next[cpuIndex] = cpuSymbol;
        n += 1;
        await recordMove(game.id, null, n, { index: cpuIndex, symbol: cpuSymbol });
      }
      nextTurn = user.id;
    }

    await updateGameState(game.id, {
      game_state: { board: next, moveNumber: n },
      current_turn_user_id: nextTurn,
    });
    await refresh();
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      if (game.mode === "solo") {
        const g = await createSoloGame("tic_tac_toe", user.id, { board: EMPTY_BOARD, moveNumber: 0 });
        navigate(`/games/tic-tac-toe/${g.id}`, { replace: true });
      } else if (opponent?.user_id) {
        const g = await createMultiplayerGame("tic_tac_toe", user.id, opponent.user_id, {
          board: EMPTY_BOARD,
          moveNumber: 0,
        });
        toast({ title: `Rematch sent to ${opponentName}` });
        navigate(`/games/tic-tac-toe/${g.id}`, { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("tic_tac_toe", user.id, opponentId, {
        board: EMPTY_BOARD,
        moveNumber: 0,
      });
      setPicker(false);
      toast({ title: `Challenge sent to ${name}` });
      navigate(`/games/tic-tac-toe/${g.id}`, { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const outcome = draw ? "tied" : w === mySymbol ? "won" : "lost";
    const text = `I just ${outcome} a game of Tic-Tac-Toe on YAJ 🎮`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Result copied" });
      }
    } catch {
      /* user cancelled */
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">This game is no longer available.</p>
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to Games
        </button>
      </div>
    );
  }

  const statusLabel = (() => {
    if (game.status === "waiting") return `Waiting for ${opponentName} to accept`;
    if (game.status === "cancelled") return "Challenge declined";
    if (draw) return "Draw — nobody wins";
    if (w) return w === mySymbol ? "Victory — you win!" : `${opponentName} wins`;
    return myTurn ? "Your turn" : `${opponentName}'s turn`;
  })();

  return (
    <div className="min-h-[100dvh] bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/games")} aria-label="Back" className="rounded-full p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight">Tic-Tac-Toe</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-sm font-black">{statusLabel}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">You play {mySymbol}</p>
        </div>

        <div className="mx-auto mt-5 grid max-w-[360px] grid-cols-3 gap-2">
          {board.map((cell, i) => {
            const highlight = line?.includes(i);
            return (
              <button
                key={i}
                type="button"
                disabled={!myTurn || cell !== null}
                onClick={() => applyMove(i)}
                aria-label={`Square ${i + 1}`}
                className={`flex aspect-square items-center justify-center rounded-2xl border text-4xl font-black transition ${
                  highlight
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-foreground active:scale-[0.97]"
                } disabled:opacity-100`}
              >
                {cell}
              </button>
            );
          })}
        </div>

        {finished && (
          <div className="mx-auto mt-6 max-w-[360px] space-y-2">
            <button
              type="button"
              onClick={rematch}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" /> Rematch
            </button>
            <button
              type="button"
              onClick={() => setPicker(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-black active:scale-[0.98]"
            >
              <Users className="h-4 w-4" /> Challenge Someone
            </button>
            <button
              type="button"
              onClick={shareResult}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-black active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" /> Share Result
            </button>
          </div>
        )}
      </main>

      <OpponentPickerSheet
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(p) => challengeOther(p.user_id, p.display_name || "your opponent")}
        title="Challenge to Tic-Tac-Toe"
      />
    </div>
  );
}
