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

  return (
    <GameShell
      title="Checkers"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I just ${w === mySide ? "won" : "lost"} a game of Checkers on YAJ ⛃`}
      onRematch={rematch}
      onChallenge={challenge}
    >
      <div className="mx-auto grid max-w-[380px] grid-cols-8 overflow-hidden rounded-2xl border-4 border-[hsl(20_60%_28%)]">
        {board.map((piece, i) => {
          const r = Math.floor(i / 8);
          const c = i % 8;
          const dark = (r + c) % 2 === 1;
          const isTarget = targets.some((m) => m.to === i);
          return (
            <button
              key={i}
              type="button"
              aria-label={`Square ${i + 1}`}
              onClick={() => tap(i)}
              className={`relative flex aspect-square items-center justify-center ${
                dark ? "bg-[hsl(28_45%_38%)]" : "bg-[hsl(38_70%_82%)]"
              } ${isTarget ? "ring-2 ring-inset ring-primary" : ""} ${selected === i ? "ring-2 ring-inset ring-white" : ""}`}
            >
              {piece && (
                <span
                  className={`flex h-[76%] w-[76%] items-center justify-center rounded-full text-[10px] font-black ${
                    sideOf(piece) === "r"
                      ? "bg-red-600 text-white shadow-inner"
                      : "bg-neutral-900 text-white shadow-inner"
                  }`}
                >
                  {piece === "R" || piece === "B" ? "♛" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        You play {mySide === "r" ? "red (moving up)" : "black (moving down)"} — captures are forced.
      </p>
    </GameShell>
  );
}
