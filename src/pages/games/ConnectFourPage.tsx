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
import GameLiveDock from "@/components/games/live/GameLiveDock";

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

  // Indices added since the last render get the drop animation.
  const fresh = useMemo(() => {
    const before = prevBoard.current;
    const changed = new Set<number>();
    if (before) board.forEach((c, i) => { if (c && before[i] !== c) changed.add(i); });
    prevBoard.current = board;
    return changed;
  }, [board]);



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
    if (!game || !user || !myTurn) return;
    if (!canDrop(board, col)) {
      setInvalidCol(col);
      window.setTimeout(() => setInvalidCol(null), 340);
      toast({ title: "That column is full" });
      return;
    }
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

  const outcome = finished ? (draw ? "draw" : w === myMark ? "win" : "loss") : undefined;

  return (
    <GameShell
      title="Connect Four"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I just ${draw ? "tied" : w === myMark ? "won" : "lost"} a game of Connect Four on YAJ 🔴🔵`}
      onRematch={rematch}
      onChallenge={challenge}
      me={{ name: "You", meta: myMark === "R" ? "Red discs" : "Yellow discs" }}
      them={{
        name: opponentName,
        avatarUrl: opponentAvatar,
        isComputer: opponent?.is_computer ?? game.mode === "solo",
        meta: myMark === "R" ? "Yellow discs" : "Red discs",
      }}
      myTurn={myTurn}
      outcome={outcome as any}
      resultTitle={draw ? "It's a draw" : w === myMark ? "Four in a row!" : `${opponentName} wins`}
      resultDetail={draw ? "The board filled up." : w === myMark ? "You connected four — clean work." : "Rematch and take it back."}
    >
      <div
        className="mx-auto max-w-[380px] rounded-[28px] p-3"
        style={{
          background: "linear-gradient(165deg, hsl(214 80% 34%), hsl(222 78% 20%))",
          boxShadow: "0 26px 54px -22px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.16), inset 0 -6px 14px rgba(0,0,0,0.4)",
        }}
      >
        <div className="grid grid-cols-7 gap-1.5">
          {board.map((cell, i) => {
            const col = i % C4_COLS;
            const highlight = line?.includes(i);
            const dropping = fresh.has(i);
            return (
              <button
                key={i}
                type="button"
                aria-label={`Column ${col + 1}`}
                disabled={!myTurn}
                onClick={() => play(col)}
                className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-full transition ${
                  invalidCol === col ? "ttt-shake" : ""
                } ${myTurn && !cell ? "active:scale-95" : ""}`}
                style={{
                  background: "radial-gradient(circle at 50% 35%, rgba(0,0,0,0.55), rgba(0,0,0,0.28))",
                  boxShadow: "inset 0 3px 6px rgba(0,0,0,0.65), inset 0 -2px 0 rgba(255,255,255,0.08)",
                }}
              >
                {cell && (
                  <span
                    className={`block h-[86%] w-[86%] rounded-full ${dropping ? "c4-drop" : ""} ${highlight ? "win-glow" : ""}`}
                    style={{
                      background:
                        cell === "R"
                          ? "radial-gradient(circle at 35% 28%, #ff8b8b, #c31f2e 70%)"
                          : "radial-gradient(circle at 35% 28%, #ffeda1, #e0a410 70%)",
                      boxShadow: highlight
                        ? "inset 0 -3px 6px rgba(0,0,0,0.35), 0 0 0 2px rgba(247,226,160,0.9)"
                        : "inset 0 -3px 6px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.45)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-white/50">
        You are {myMark === "R" ? "red" : "yellow"} — tap a column to drop.
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

