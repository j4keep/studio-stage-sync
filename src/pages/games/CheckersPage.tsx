import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import { useTurnGame } from "@/hooks/use-turn-game";
import {
  CBoard,
  Move,
  Side,
  applyMove,
  checkersComputerMove,
  checkersWinner,
  initialCheckers,
  legalMoves,
  sideOf,
} from "@/lib/checkers";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";
import GameLiveDock from "@/components/games/live/GameLiveDock";

export default function CheckersPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const [selected, setSelected] = useState<number | null>(null);
  const written = useRef<string | null>(null);

  const board: CBoard = (game?.game_state?.board as CBoard) || initialCheckers();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySide: Side = (me?.seat ?? 1) === 1 ? "r" : "b";
  const oppSide: Side = mySide === "r" ? "b" : "r";
  const w = checkersWinner(board);
  const finished = Boolean(w);
  const myTurn = game?.status === "active" && game.current_turn_user_id === user?.id && !finished;
  const moves = myTurn ? legalMoves(board, mySide) : [];
  const targets = selected === null ? [] : moves.filter((m) => m.from === selected);

  useEffect(() => {
    if (!game || !user || !finished || written.current === game.id) return;
    written.current = game.id;
    if (game.status === "completed") return;
    const outcome = w === mySide ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: false,
        winner_user_id: w === mySide ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "checkers", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (move: Move) => {
    if (!game || !user) return;
    let { board: next, againFrom } = applyMove(board, move);
    let n = moveNumber + 1;
    await recordMove(game.id, user.id, n, move as any);

    if (againFrom !== null) {
      setSelected(againFrom);
      setGame({ ...game, game_state: { board: next, moveNumber: n } });
      await updateGameState(game.id, { game_state: { board: next, moveNumber: n } });
      await refresh();
      return;
    }

    setSelected(null);
    let nextTurn = opponent?.user_id ?? null;

    if (game.mode === "solo" && !checkersWinner(next)) {
      let guard = 0;
      let cpu = checkersComputerMove(next, oppSide);
      while (cpu && guard < 12) {
        const res = applyMove(next, cpu);
        next = res.board;
        n += 1;
        await recordMove(game.id, null, n, cpu as any);
        if (res.againFrom === null) break;
        cpu = legalMoves(next, oppSide).find((m) => m.from === res.againFrom && m.capture !== null) || null;
        guard += 1;
      }
      nextTurn = user.id;
    }

    setGame({ ...game, game_state: { board: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await updateGameState(game.id, { game_state: { board: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await refresh();
  };

  const tap = (cell: number) => {
    if (!myTurn) return;
    const target = targets.find((m) => m.to === cell);
    if (target) {
      void commit(target);
      return;
    }
    if (sideOf(board[cell]) === mySide && moves.some((m) => m.from === cell)) setSelected(cell);
    else setSelected(null);
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { board: initialCheckers(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("checkers", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("checkers", user.id, opponent.user_id, state)
            : null;
      if (g) navigate(gameRoute("checkers", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challenge = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("checkers", user.id, opponentId, {
        board: initialCheckers(),
        moveNumber: 0,
      });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("checkers", g.id), { replace: true });
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

  const status = game.status === "waiting"
    ? `Waiting for ${opponentName} to accept`
    : game.status === "cancelled"
      ? "Challenge declined"
      : w
        ? w === mySide ? "Victory — you win!" : `${opponentName} wins`
        : myTurn ? "Your turn" : `${opponentName}'s turn`;

  const myPieces = board.filter((p) => p && sideOf(p) === mySide).length;
  const oppPieces = board.filter((p) => p && sideOf(p) === oppSide).length;
  const outcome = finished ? (w === mySide ? "win" : "loss") : undefined;

  return (
    <GameShell
      gameType="checkers"
      title="Checkers"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I just ${w === mySide ? "won" : "lost"} a game of Checkers on YAJ ⛃`}
      onRematch={rematch}
      onChallenge={challenge}
      me={{ name: "You", meta: `${myPieces} pieces • ${mySide === "r" ? "red" : "black"}` }}
      them={{
        name: opponentName,
        avatarUrl: opponentAvatar,
        isComputer: opponent?.is_computer ?? game.mode === "solo",
        meta: `${oppPieces} pieces • ${oppSide === "r" ? "red" : "black"}`,
      }}
      myTurn={myTurn}
      outcome={outcome as any}
      resultTitle={w === mySide ? "Board cleared — you win!" : `${opponentName} wins`}
      resultDetail={w === mySide ? "Every last piece captured." : "Line up a rematch."}
    >
      <div
        className="mx-auto max-w-[380px] rounded-[26px] p-3"
        style={{
          background: "linear-gradient(160deg, hsl(24 45% 30%), hsl(20 50% 16%))",
          boxShadow: "0 26px 54px -22px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.14)",
        }}
      >
        <div
          className="grid grid-cols-8 overflow-hidden rounded-xl"
          style={{ boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.45), inset 0 6px 16px rgba(0,0,0,0.5)" }}
        >
          {board.map((piece, i) => {
            const r = Math.floor(i / 8);
            const c = i % 8;
            const dark = (r + c) % 2 === 1;
            const isTarget = targets.some((m) => m.to === i);
            const isSelected = selected === i;
            const side = piece ? sideOf(piece) : null;
            const isKing = piece === "R" || piece === "B";
            return (
              <button
                key={i}
                type="button"
                aria-label={`Square ${i + 1}`}
                onClick={() => tap(i)}
                className="relative flex aspect-square items-center justify-center transition active:scale-95"
                style={{
                  background: dark
                    ? "linear-gradient(150deg, hsl(26 42% 34%), hsl(24 44% 26%))"
                    : "linear-gradient(150deg, hsl(38 58% 84%), hsl(36 48% 74%))",
                }}
              >
                {isTarget && (
                  <span
                    className="absolute h-[34%] w-[34%] rounded-full bg-primary/70"
                    style={{ boxShadow: "0 0 14px hsl(var(--primary) / 0.8)" }}
                  />
                )}
                {isSelected && <span className="absolute inset-0 ring-2 ring-inset ring-primary" />}
                {piece && (
                  <span
                    className={`relative flex h-[76%] w-[76%] items-center justify-center rounded-full game-piece-pop ${
                      isSelected ? "scale-105" : ""
                    }`}
                    style={{
                      background:
                        side === "r"
                          ? "radial-gradient(circle at 36% 28%, #ff8e8e, #a4121f 72%)"
                          : "radial-gradient(circle at 36% 28%, #5a5f6d, #101318 72%)",
                      boxShadow:
                        "inset 0 -4px 7px rgba(0,0,0,0.5), inset 0 3px 5px rgba(255,255,255,0.28), 0 3px 6px rgba(0,0,0,0.5)",
                    }}
                  >
                    {isKing && <span className="text-[11px] font-black text-[#f7e2a0]">♛</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-white/50">
        You play {mySide === "r" ? "red (moving up)" : "black (moving down)"} — captures are forced.
      </p>
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

