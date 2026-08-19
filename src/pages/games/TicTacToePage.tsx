import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import TicTacToeBoard from "@/components/games/TicTacToeBoard";
import { useTurnGame } from "@/hooks/use-turn-game";
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
  bumpStats,
  createMultiplayerGame,
  createSoloGame,
  recordMove,
  updateGameState,
} from "@/lib/games";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";

export default function TicTacToePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);
  const [invalid, setInvalid] = useState<number | null>(null);

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
      setInvalid(index);
      window.setTimeout(() => setInvalid(null), 340);
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
      const state = { board: EMPTY_BOARD, moveNumber: 0 };
      if (game.mode === "solo") {
        const g = await createSoloGame("tic_tac_toe", user.id, state);
        navigate(`/games/tic-tac-toe/${g.id}`, { replace: true });
      } else if (opponent?.user_id) {
        const g = await createMultiplayerGame("tic_tac_toe", user.id, opponent.user_id, state);
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
      toast({ title: `Challenge sent to ${name}` });
      navigate(`/games/tic-tac-toe/${g.id}`, { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
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

  const status = (() => {
    if (game.status === "waiting") return `Waiting for ${opponentName} to accept`;
    if (game.status === "cancelled") return "Challenge declined";
    if (draw) return "Draw — nobody wins";
    if (w) return w === mySymbol ? "Victory — you win!" : `${opponentName} wins`;
    return myTurn ? "Your turn" : `${opponentName}'s turn`;
  })();

  const outcome = finished ? (draw ? "draw" : w === mySymbol ? "win" : "loss") : undefined;

  return (
    <GameShell
      gameType="tic_tac_toe"
      title="Tic-Tac-Toe"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I just ${draw ? "tied" : w === mySymbol ? "won" : "lost"} a game of Tic-Tac-Toe on YAJ 🎮`}
      onRematch={rematch}
      onChallenge={challengeOther}
      me={{ name: "You", meta: `Plays ${mySymbol}` }}
      them={{
        name: opponentName,
        avatarUrl: opponentAvatar,
        isComputer: opponent?.is_computer ?? game.mode === "solo",
        meta: `Plays ${mySymbol === "X" ? "O" : "X"}`,
      }}
      myTurn={myTurn}
      outcome={outcome as any}
      resultTitle={draw ? "It's a draw" : w === mySymbol ? "Victory!" : `${opponentName} wins`}
      resultDetail={draw ? "Nobody claimed a line." : w === mySymbol ? "Three in a row — nicely played." : "Run it back for redemption."}
    >
      <TicTacToeBoard board={board} line={line} disabled={!myTurn} onPlay={applyMove} invalid={invalid} />
      <p className="mt-3 text-center text-[11px] text-white/50">
        {myTurn ? "Tap an empty square to place your mark." : "Waiting on the other player…"}
      </p>
      <PendingChallengeGate
        gameId={game.id}
        userId={user?.id}
        waiting={game.status === "waiting" && game.host_user_id !== user?.id}
        challengerName={opponentName}
        onAccepted={refresh}
      />
      <GameLiveDock
        gameId={game.id}
        userId={user?.id}
        isPlayer={!!me}
        isLive={Boolean((game as any).is_live)}
        hasHumanOpponent={game.mode === "multiplayer" && !!opponent?.user_id}
        onChanged={refresh}
      />

    </GameShell>
  );
}
