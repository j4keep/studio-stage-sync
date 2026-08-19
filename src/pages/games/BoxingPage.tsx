import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import BoxingRing from "@/components/games/boxing/BoxingRing";
import { useTurnGame } from "@/hooks/use-turn-game";
import { Action, BoxingState, Seat, computerAction, initialBoxing, resolveAction } from "@/lib/boxing";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

export default function BoxingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);
  const boxingRef = useRef<BoxingState>(initialBoxing());

  const boxing: BoxingState = (game?.game_state?.boxing as BoxingState) || initialBoxing();
  boxingRef.current = boxing;
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = boxing.phase === "over";
  const myTurn = game?.status === "active" && !finished && boxing.turnSeat === mySeat;

  // Persist stats once when a match finishes.
  useEffect(() => {
    if (!game || !user || !finished || statsWritten.current === game.id) return;
    if (game.status === "completed") {
      statsWritten.current = game.id;
      return;
    }
    statsWritten.current = game.id;
    const draw = boxing.winnerSeat === null;
    const iWon = boxing.winnerSeat === mySeat;
    const outcome = draw ? "draw" : iWon ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "boxing", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: BoxingState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { boxing: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { boxing: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const applyAction = async (action: Action) => {
    if (!game || !user || !myTurn) return;
    const next = resolveAction(boxing, mySeat, action);
    const n = moveNumber + 1;
    await recordMove(game.id, user.id, n, { action, seat: mySeat });
    const nextTurnUserId = game.mode === "solo" ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  // Drive the computer's turn in solo mode — delayed so the human's own punch animates first.
  useEffect(() => {
    if (!game || game.mode !== "solo" || finished) return;
    if (boxing.turnSeat !== oppSeat) return;
    const t = window.setTimeout(() => {
      if (!user) return;
      const state = boxingRef.current;
      const action = computerAction(state, oppSeat);
      const next = resolveAction(state, oppSeat, action);
      void commit(next, moveNumber + 1, user.id);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [game?.id, boxing.turnSeat, finished, moveNumber]);

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { boxing: initialBoxing(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("boxing", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("boxing", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("boxing", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("boxing", user.id, opponentId, { boxing: initialBoxing(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("boxing", g.id), { replace: true });
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
        <p className="font-bold">This match is no longer available.</p>
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to Games
        </button>
      </div>
    );
  }

  const oppLabel = game.mode === "solo" ? "Computer" : opponentName;
  const draw = finished && boxing.winnerSeat === null;
  const iWon = finished && boxing.winnerSeat === mySeat;

  const status = (() => {
    if (game.status === "waiting") return `Waiting for ${opponentName} to accept`;
    if (game.status === "cancelled") return "Challenge declined";
    if (draw) return "Goes the distance — a draw";
    if (finished) return iWon ? "You win by knockout!" : `${oppLabel} wins`;
    if (boxing.lastAction && boxing.message) return boxing.message;
    return myTurn ? "Your turn — throw a punch or guard up" : `${oppLabel}'s turn`;
  })();

  const outcome = finished ? (draw ? "draw" : iWon ? "win" : "loss") : undefined;

  return (
    <GameShell
      gameType="boxing"
      title="Boxing"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I just ${draw ? "drew" : iWon ? "won" : "lost"} a boxing match on YAJ 🥊`}
      onRematch={rematch}
      onChallenge={challengeOther}
      myTurn={myTurn}
      outcome={outcome as any}
      resultTitle={draw ? "Goes the distance" : iWon ? "Victory by knockout!" : `${oppLabel} wins`}
      resultDetail={
        finished
          ? `Final health — you ${Math.round(boxing.boxers[mySeat].health)} · ${oppLabel} ${Math.round(boxing.boxers[oppSeat].health)}`
          : undefined
      }
    >
      <BoxingRing
        myName="You"
        myAvatar={null}
        myHealth={boxing.boxers[mySeat].health}
        myStamina={boxing.boxers[mySeat].stamina}
        myStance={boxing.boxers[mySeat].stance}
        oppName={oppLabel}
        oppAvatar={game.mode === "solo" ? null : opponentAvatar}
        isComputer={game.mode === "solo"}
        oppHealth={boxing.boxers[oppSeat].health}
        oppStamina={boxing.boxers[oppSeat].stamina}
        oppStance={boxing.boxers[oppSeat].stance}
        lastAction={
          boxing.lastAction ? { ...boxing.lastAction, seat: boxing.lastAction.seat === mySeat ? 0 : 1 } : null
        }
        interactive={Boolean(myTurn)}
        finished={finished}
        winnerIsMe={finished ? iWon : null}
        onAction={(action) => void applyAction(action)}
      />
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
