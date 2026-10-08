import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Crown, Loader2, Sparkles, Swords } from "lucide-react";
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
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import { checkersSfx } from "@/lib/checkers-sfx";

export default function CheckersPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const [selected, setSelected] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
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
  const selectable = new Set(moves.map((m) => m.from));
  const forcedCapture = moves.some((m) => m.capture !== null);

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
    if (!game || !user || thinking) return;

    const movingPiece = board[move.from];
    let { board: next, againFrom } = applyMove(board, move);
    const promoted =
      (movingPiece === "r" && next[move.to] === "R") ||
      (movingPiece === "b" && next[move.to] === "B");
    let n = moveNumber + 1;
    setLastMove({ from: move.from, to: move.to });

    if (move.capture !== null) void checkersSfx.capture();
    else void checkersSfx.move();
    if (promoted) window.setTimeout(() => void checkersSfx.king(), 90);

    try {
      navigator.vibrate?.(18);
    } catch {
      /* vibration is optional */
    }

    // Move immediately on-screen; sync afterward so mobile taps never feel frozen.
    setGame({ ...game, game_state: { board: next, moveNumber: n } });

    try {
      await recordMove(game.id, user.id, n, move as any);

      if (againFrom !== null) {
        setSelected(againFrom);
        await updateGameState(game.id, { game_state: { board: next, moveNumber: n } });
        return;
      }

      setSelected(null);
      let nextTurn = opponent?.user_id ?? null;

      if (game.mode === "solo" && !checkersWinner(next)) {
        setThinking(true);
        await updateGameState(game.id, {
          game_state: { board: next, moveNumber: n },
          current_turn_user_id: user.id,
        });

        // Keep the player's move visible before the computer answers.
        await new Promise((resolve) => window.setTimeout(resolve, 520));

        let guard = 0;
        let cpu = checkersComputerMove(next, oppSide);
        while (cpu && guard < 12) {
          const cpuPiece = next[cpu.from];
          const res = applyMove(next, cpu);
          const cpuPromoted =
            (cpuPiece === "r" && res.board[cpu.to] === "R") ||
            (cpuPiece === "b" && res.board[cpu.to] === "B");
          setLastMove({ from: cpu.from, to: cpu.to });
          if (cpu.capture !== null) void checkersSfx.capture();
          else void checkersSfx.move();
          if (cpuPromoted) window.setTimeout(() => void checkersSfx.king(), 90);
          next = res.board;
          n += 1;
          setGame({ ...game, game_state: { board: next, moveNumber: n }, current_turn_user_id: user.id });
          await recordMove(game.id, null, n, cpu as any);

          if (res.againFrom === null) break;
          await new Promise((resolve) => window.setTimeout(resolve, 320));
          cpu = legalMoves(next, oppSide).find((m) => m.from === res.againFrom && m.capture !== null) || null;
          guard += 1;
        }

        nextTurn = user.id;
        setThinking(false);
      }

      setGame({ ...game, game_state: { board: next, moveNumber: n }, current_turn_user_id: nextTurn });
      await updateGameState(game.id, {
        game_state: { board: next, moveNumber: n },
        current_turn_user_id: nextTurn,
      });
    } catch (e: any) {
      setThinking(false);
      toast({
        title: "Move could not sync",
        description: e?.message || "Please try the move again.",
        variant: "destructive",
      });
      await refresh();
    }
  };

  const tap = (cell: number) => {
    if (!myTurn || thinking) return;

    const target = targets.find((m) => m.to === cell);
    if (target) {
      void commit(target);
      return;
    }

    if (sideOf(board[cell]) === mySide && selectable.has(cell)) {
      setSelected(cell);
      void checkersSfx.prime().then(() => checkersSfx.select());
      try { navigator.vibrate?.(8); } catch { /* optional */ }
      return;
    }

    setSelected(null);
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
        : thinking ? "Computer is thinking…" : myTurn ? (forcedCapture ? "Your turn — capture required" : "Your turn — choose a glowing piece") : `${opponentName}'s turn`;

  const myPieces = board.filter((p) => p && sideOf(p) === mySide).length;
  const oppPieces = board.filter((p) => p && sideOf(p) === oppSide).length;
  const outcome = finished ? (w === mySide ? "win" : "loss") : undefined;
  const myCaptured = 12 - oppPieces;
  const oppCaptured = 12 - myPieces;

  return (
    <GameShell
      gameType="checkers"
      gameId={game.id}
      waitingForOpponent={game.mode === "multiplayer" && game.status === "waiting" && game.host_user_id === user?.id}
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
      <div className="mx-auto mb-3 grid max-w-[420px] grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/45">You captured</p>
          <p className="mt-0.5 text-xl font-black text-rose-300">{myCaptured}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-center">
          <Swords className="mx-auto h-4 w-4 text-amber-300" />
          <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-white/55">
            {forcedCapture && myTurn ? "Capture!" : thinking ? "Thinking…" : "Match"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Rival captured</p>
          <p className="mt-0.5 text-xl font-black text-slate-300">{oppCaptured}</p>
        </div>
      </div>

      <div
        className="mx-auto max-w-[420px] rounded-[30px] p-3.5"
        onPointerDownCapture={() => { void checkersSfx.prime(); }}
        style={{
          background: "linear-gradient(145deg,#7a4528 0%,#4c2818 46%,#25130c 100%)",
          boxShadow:
            "0 32px 70px -24px rgba(0,0,0,.9), inset 0 2px 1px rgba(255,255,255,.18), inset 0 -4px 10px rgba(0,0,0,.35)",
        }}
      >
        <div className="overflow-hidden rounded-[18px] border-2 border-black/45 shadow-[inset_0_0_24px_rgba(0,0,0,.28)]">
          <div className="grid grid-cols-8">
            {board.map((piece, i) => {
              const r = Math.floor(i / 8);
              const c = i % 8;
              const dark = (r + c) % 2 === 1;
              const isTarget = targets.some((m) => m.to === i);
              const isSelected = selected === i;
              const isSelectable = myTurn && selectable.has(i) && sideOf(piece) === mySide;
              const isLastFrom = lastMove?.from === i;
              const isLastTo = lastMove?.to === i;
              const side = piece ? sideOf(piece) : null;
              const isKing = piece === "R" || piece === "B";

              return (
                <button
                  key={i}
                  type="button"
                  aria-label={isTarget ? "Legal move" : `Square ${i + 1}`}
                  onClick={() => tap(i)}
                  disabled={thinking}
                  className="relative flex aspect-square items-center justify-center overflow-hidden transition active:scale-[0.96] disabled:cursor-wait"
                  style={{
                    background: dark
                      ? "linear-gradient(145deg,#814d2f 0%,#60351f 100%)"
                      : "linear-gradient(145deg,#f2dfba 0%,#d9bc88 100%)",
                    boxShadow:
                      isLastFrom || isLastTo
                        ? "inset 0 0 0 3px rgba(250,204,21,.55)"
                        : "inset 0 0 0 1px rgba(0,0,0,.08)",
                  }}
                >
                  {dark && !piece && isTarget && (
                    <span className="absolute flex h-[48%] w-[48%] items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-400/45 shadow-[0_0_18px_rgba(52,211,153,.9)]">
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  )}

                  {isSelected && (
                    <span className="absolute inset-[3px] rounded-md border-[3px] border-cyan-300 shadow-[inset_0_0_14px_rgba(34,211,238,.45),0_0_14px_rgba(34,211,238,.6)]" />
                  )}

                  {piece && (
                    <span
                      className={`relative flex h-[77%] w-[77%] items-center justify-center rounded-full transition-all duration-150 ${
                        isSelected ? "scale-110" : isSelectable ? "scale-[1.04]" : ""
                      }`}
                      style={{
                        background:
                          side === "r"
                            ? "radial-gradient(circle at 34% 25%,#ffb0b6 0%,#ef4b5b 34%,#9e1725 74%,#5d0912 100%)"
                            : "radial-gradient(circle at 34% 25%,#7d8798 0%,#323a48 35%,#10151e 74%,#02050a 100%)",
                        border: isSelectable
                          ? "2px solid rgba(103,232,249,.95)"
                          : "2px solid rgba(255,255,255,.10)",
                        boxShadow: isSelectable
                          ? "inset 0 -6px 9px rgba(0,0,0,.48), inset 0 4px 6px rgba(255,255,255,.34), 0 0 0 3px rgba(34,211,238,.16), 0 0 18px rgba(34,211,238,.48), 0 7px 8px rgba(0,0,0,.46)"
                          : "inset 0 -6px 9px rgba(0,0,0,.5), inset 0 4px 6px rgba(255,255,255,.28), 0 6px 8px rgba(0,0,0,.5)",
                      }}
                    >
                      <span className="absolute inset-[14%] rounded-full border border-white/10" />
                      {isKing ? (
                        <span className="relative flex h-[56%] w-[56%] items-center justify-center rounded-full bg-amber-300/95 text-[#4b250b] shadow-[0_2px_8px_rgba(0,0,0,.45)]">
                          <Crown className="h-[64%] w-[64%]" strokeWidth={2.8} />
                        </span>
                      ) : isSelectable ? (
                        <Sparkles className="h-[30%] w-[30%] text-cyan-100/90" />
                      ) : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-[420px] rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center">
        <p className="text-[12px] font-black text-white/85">
          {thinking
            ? "Computer is making its move…"
            : selected !== null
              ? targets.length
                ? "Tap one of the glowing green landing spots."
                : "Choose another glowing piece."
              : forcedCapture && myTurn
                ? "A capture is available — glowing pieces can jump."
                : myTurn
                  ? "Tap a glowing piece, then tap a highlighted landing spot."
                  : `Waiting for ${opponentName}…`}
        </p>
        <p className="mt-1 text-[10px] text-white/40">
          {mySide === "r" ? "Red moves upward" : "Black moves downward"} · Reach the opposite side to become a king.
        </p>
      </div>
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

