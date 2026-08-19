import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Shuffle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import { useTurnGame } from "@/hooks/use-turn-game";
import {
  BOARD_SIZE,
  BattleshipState,
  Fleet,
  SHIP_LABELS,
  Seat,
  alreadyShot,
  computerShot,
  fireShot,
  initialBattleship,
  placeFleet,
  randomFleet,
  shipsRemaining,
} from "@/lib/battleship";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

function shotMap(shots: { x: number; y: number; result: string }[]) {
  const m = new Map<string, "hit" | "miss">();
  shots.forEach((s) => m.set(`${s.x},${s.y}`, s.result === "miss" ? "miss" : "hit"));
  return m;
}

function Grid({
  fleet,
  shots,
  showShips,
  interactive,
  onTap,
}: {
  fleet: Fleet | null;
  shots: { x: number; y: number; result: string }[];
  showShips: boolean;
  interactive: boolean;
  onTap?: (x: number, y: number) => void;
}) {
  const hits = shotMap(shots);
  const shipCells = new Set<string>();
  if (showShips && fleet) fleet.forEach((ship) => ship.cells.forEach((c) => shipCells.add(`${c.x},${c.y}`)));

  return (
    <div
      className="mx-auto grid overflow-hidden rounded-xl border border-white/10"
      style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`, maxWidth: 340 }}
    >
      {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
        const x = i % BOARD_SIZE;
        const y = Math.floor(i / BOARD_SIZE);
        const key = `${x},${y}`;
        const mark = hits.get(key);
        const isShip = shipCells.has(key);
        return (
          <button
            key={key}
            type="button"
            disabled={!interactive || !!mark}
            onClick={() => onTap?.(x, y)}
            className="relative aspect-square border border-white/5"
            style={{
              background: isShip
                ? mark
                  ? "linear-gradient(160deg, #b91c1c, #7f1d1d)"
                  : "linear-gradient(160deg, #64748b, #334155)"
                : mark === "hit"
                  ? "linear-gradient(160deg, #b91c1c, #7f1d1d)"
                  : "linear-gradient(160deg, hsl(205 55% 22%), hsl(210 55% 14%))",
              cursor: interactive && !mark ? "pointer" : "default",
            }}
          >
            {mark === "miss" && <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-white/70" />}
            {mark === "hit" && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">✕</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function BattleshipPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);
  const stateRef = useRef<BattleshipState>(initialBattleship());
  const [previewFleet, setPreviewFleet] = useState<Fleet>(() => randomFleet());

  const battleship: BattleshipState = (game?.game_state?.battleship as BattleshipState) || initialBattleship();
  stateRef.current = battleship;
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = battleship.phase === "over";
  const myFleetSet = battleship.fleets[mySeat] !== null;
  const myTurn = game?.status === "active" && !finished && battleship.phase === "battle" && battleship.turnSeat === mySeat;

  useEffect(() => {
    if (!game || !user || !finished || statsWritten.current === game.id) return;
    if (game.status === "completed") {
      statsWritten.current = game.id;
      return;
    }
    statsWritten.current = game.id;
    const iWon = battleship.winnerSeat === mySeat;
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: false,
        winner_user_id: iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "battleship", iWon ? "win" : "loss");
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: BattleshipState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { battleship: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { battleship: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const submitPlacement = async (fleet: Fleet) => {
    if (!game || !user) return;
    const next = placeFleet(battleship, mySeat, fleet);
    const n = moveNumber + 1;
    await recordMove(game.id, user.id, n, { placed: mySeat });
    const nextTurnUserId =
      next.phase === "battle" ? (game.mode === "solo" ? user.id : next.turnSeat === mySeat ? user.id : (opponent?.user_id ?? null)) : game.current_turn_user_id;
    await commit(next, n, nextTurnUserId);
  };

  const fire = async (x: number, y: number) => {
    if (!game || !user || !myTurn || alreadyShot(battleship, mySeat, x, y)) return;
    const next = fireShot(battleship, mySeat, x, y);
    const n = moveNumber + 1;
    await recordMove(game.id, user.id, n, { x, y, seat: mySeat });
    const nextTurnUserId = game.mode === "solo" ? user.id : next.turnSeat === mySeat ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  // Drive the computer's shot in solo mode.
  useEffect(() => {
    if (!game || game.mode !== "solo" || finished) return;
    if (battleship.phase !== "battle" || battleship.turnSeat !== oppSeat) return;
    const t = window.setTimeout(() => {
      if (!user) return;
      const state = stateRef.current;
      const shot = computerShot(state, oppSeat);
      const next = fireShot(state, oppSeat, shot.x, shot.y);
      void commit(next, moveNumber + 1, user.id);
    }, 850);
    return () => window.clearTimeout(t);
  }, [game?.id, battleship.phase, battleship.turnSeat, finished, moveNumber]);

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state =
        game.mode === "solo"
          ? { battleship: placeFleet(initialBattleship(), 1, randomFleet()), moveNumber: 0 }
          : { battleship: initialBattleship(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("battleship", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("battleship", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        setPreviewFleet(randomFleet());
        navigate(gameRoute("battleship", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("battleship", user.id, opponentId, { battleship: initialBattleship(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("battleship", g.id), { replace: true });
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

  const oppLabel = game.mode === "solo" ? "Computer" : opponentName;
  const iWon = finished && battleship.winnerSeat === mySeat;
  const outcome = finished ? (iWon ? "win" : "loss") : undefined;

  const status =
    game.status === "waiting"
      ? `Waiting for ${opponentName} to accept`
      : game.status === "cancelled"
        ? "Challenge declined"
        : finished
          ? iWon
            ? "Victory — enemy fleet destroyed!"
            : `${oppLabel} sank your fleet`
          : battleship.phase === "placing"
            ? myFleetSet
              ? `Waiting for ${oppLabel} to place their fleet`
              : "Place your fleet"
            : myTurn
              ? "Your turn — fire!"
              : `${oppLabel}'s turn`;

  return (
    <GameShell
      gameType={"battleship"}
      title="Battleship"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I just ${iWon ? "won" : "lost"} a game of Battleship on YAJ 🚢`}
      onRematch={rematch}
      onChallenge={challengeOther}
      me={{ name: "You", meta: battleship.phase === "battle" || finished ? `${shipsRemaining(battleship.fleets[mySeat])} ships left` : undefined }}
      them={{
        name: oppLabel,
        avatarUrl: game.mode === "solo" ? null : opponentAvatar,
        isComputer: game.mode === "solo",
        meta: battleship.phase === "battle" || finished ? `${shipsRemaining(battleship.fleets[oppSeat])} ships left` : undefined,
      }}
      myTurn={myTurn}
      outcome={outcome as any}
      resultTitle={iWon ? "Enemy fleet destroyed!" : `${oppLabel} wins`}
      resultDetail={iWon ? "Every last ship sunk." : "Line up a rematch."}
    >
      {battleship.phase === "placing" && !myFleetSet ? (
        <div className="mx-auto max-w-[380px]">
          <p className="mb-2 text-center text-xs font-bold text-white/60">
            Your fleet: {SHIP_LABELS.carrier}, {SHIP_LABELS.battleship}, {SHIP_LABELS.cruiser}, {SHIP_LABELS.submarine}, {SHIP_LABELS.destroyer}
          </p>
          <Grid fleet={previewFleet} shots={[]} showShips interactive={false} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPreviewFleet(randomFleet())}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white active:scale-[0.98]"
            >
              <Shuffle className="h-4 w-4" /> Shuffle
            </button>
            <button
              type="button"
              onClick={() => void submitPlacement(previewFleet)}
              className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground active:scale-[0.98]"
            >
              Ready
            </button>
          </div>
        </div>
      ) : battleship.phase === "placing" ? (
        <div className="mx-auto max-w-[380px]">
          <p className="mb-2 text-center text-xs font-bold text-white/60">Your fleet</p>
          <Grid fleet={battleship.fleets[mySeat]} shots={battleship.shotsAt[oppSeat]} showShips interactive={false} />
        </div>
      ) : (
        <div className="mx-auto max-w-[380px] space-y-5">
          <div>
            <p className="mb-2 text-center text-xs font-bold text-white/60">Enemy waters — tap to fire</p>
            <Grid fleet={null} shots={battleship.shotsAt[mySeat]} showShips={false} interactive={Boolean(myTurn)} onTap={(x, y) => void fire(x, y)} />
          </div>
          <div>
            <p className="mb-2 text-center text-xs font-bold text-white/60">Your waters</p>
            <Grid fleet={battleship.fleets[mySeat]} shots={battleship.shotsAt[oppSeat]} showShips interactive={false} />
          </div>
        </div>
      )}

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
