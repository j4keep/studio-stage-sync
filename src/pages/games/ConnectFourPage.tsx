import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import { useTurnGame } from "@/hooks/use-turn-game";
import {
  C4Board,
  C4_COLS,
  C4_EMPTY,
  c4ComputerMove,
  c4IsDraw,
  c4Winner,
  c4WinningLine,
  canDrop,
  drop,
} from "@/lib/connect-four";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

export default function ConnectFourPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const [invalidCol, setInvalidCol] = useState<number | null>(null);
  const prevBoard = useRef<C4Board | null>(null);
  const written = useRef<string | null>(null);

  const board: C4Board = (game?.game_state?.board as C4Board) || C4_EMPTY;
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const myMark: "R" | "Y" = (me?.seat ?? 1) === 1 ? "R" : "Y";
  const oppMark: "R" | "Y" = myMark === "R" ? "Y" : "R";
  const line = c4WinningLine(board);
  const w = c4Winner(board);
  const draw = c4IsDraw(board);
  const finished = Boolean(w) || draw;
  const myTurn = game?.status === "active" && game.current_turn_user_id === user?.id && !finished;

  useEffect(() => {
    if (!game || !user || !finished || written.current === game.id) return;
    written.current = game.id;
    if (game.status === "completed") return;
    const outcome = draw ? "draw" : w === myMark ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : w === myMark ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "connect_four", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const play = async (col: number) => {
    if (!game || !user || !myTurn || !canDrop(board, col)) return;
    let next = drop(board, col, myMark) as C4Board;
    let n = moveNumber + 1;
    let nextTurn = opponent?.user_id ?? null;
    setGame({ ...game, game_state: { board: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await recordMove(game.id, user.id, n, { col, mark: myMark });

    if (game.mode === "solo" && !c4Winner(next) && !c4IsDraw(next)) {
      const cpuCol = c4ComputerMove(next, oppMark);
      if (cpuCol >= 0) {
        next = drop(next, cpuCol, oppMark) as C4Board;
        n += 1;
        await recordMove(game.id, null, n, { col: cpuCol, mark: oppMark });
      }
      nextTurn = user.id;
    }

    await updateGameState(game.id, { game_state: { board: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await refresh();
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { board: C4_EMPTY, moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("connect_four", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("connect_four", user.id, opponent.user_id, state)
            : null;
      if (g) navigate(gameRoute("connect_four", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challenge = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("connect_four", user.id, opponentId, { board: C4_EMPTY, moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("connect_four", g.id), { replace: true });
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
      : draw
        ? "Draw — board full"
        : w
          ? w === myMark ? "Victory — you win!" : `${opponentName} wins`
          : myTurn ? "Your turn" : `${opponentName}'s turn`;

  return (
    <GameShell
      title="Connect Four"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I just ${draw ? "tied" : w === myMark ? "won" : "lost"} a game of Connect Four on YAJ 🔴🔵`}
      onRematch={rematch}
      onChallenge={challenge}
    >
      <div className="mx-auto max-w-[380px] rounded-3xl bg-[hsl(200_70%_28%)] p-2">
        <div className="grid grid-cols-7 gap-1.5">
          {board.map((cell, i) => {
            const col = i % C4_COLS;
            const highlight = line?.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-label={`Column ${col + 1}`}
                disabled={!myTurn}
                onClick={() => play(col)}
                className={`aspect-square rounded-full border-2 transition ${
                  cell === "R"
                    ? "border-red-300 bg-red-500"
                    : cell === "Y"
                      ? "border-yellow-200 bg-yellow-400"
                      : "border-white/20 bg-background/25"
                } ${highlight ? "ring-2 ring-white" : ""}`}
              />
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        You are {myMark === "R" ? "red" : "yellow"} — tap a column to drop.
      </p>
    </GameShell>
  );
}
