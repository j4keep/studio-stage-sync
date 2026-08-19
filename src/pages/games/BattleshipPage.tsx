import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HelpCircle, Loader2, RotateCw, Shuffle, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import FleetGrid from "@/components/games/battleship/FleetGrid";
import HowToPlayModal from "@/components/games/battleship/HowToPlayModal";
import { battleshipSfx } from "@/lib/battleship-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import {
  BattleshipState,
  Fleet,
  Orientation,
  SHIP_LABELS,
  SHIP_LENGTHS,
  SHIP_ORDER,
  Seat,
  ShipId,
  alreadyShot,
  canPlaceShip,
  cellsForShip,
  computerShot,
  fireShot,
  initialBattleship,
  placeFleet,
  randomFleet,
  shipsRemaining,
} from "@/lib/battleship";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const HOWTO_KEY = "yaj.games.battleship.howto.seen";

export default function BattleshipPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);
  const stateRef = useRef<BattleshipState>(initialBattleship());
  const seenTurn = useRef<number | null>(null);

  const [placedShips, setPlacedShips] = useState<Fleet>([]);
  const [selectedShip, setSelectedShip] = useState<ShipId | null>(SHIP_ORDER[0]);
  const [orientation, setOrientation] = useState<Orientation>("H");
  const [muted, setMuted] = useState(battleshipSfx.muted);
  const [howTo, setHowTo] = useState(() => typeof localStorage !== "undefined" && localStorage.getItem(HOWTO_KEY) !== "1");
  const [banner, setBanner] = useState<string | null>(null);

  const battleship: BattleshipState = (game?.game_state?.battleship as BattleshipState) || initialBattleship();
  stateRef.current = battleship;
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = battleship.phase === "over";
  const myFleetSet = battleship.fleets[mySeat] !== null;
  const myTurn = game?.status === "active" && !finished && battleship.phase === "battle" && battleship.turnSeat === mySeat;

  // Sound + a "you/they sank the X!" banner whenever a new shot lands, for either side.
  useEffect(() => {
    if (!battleship.lastShot || seenTurn.current === battleship.turn) return;
    seenTurn.current = battleship.turn;
    const shot = battleship.lastShot;
    if (shot.result === "miss") battleshipSfx.miss();
    else if (shot.result === "hit") battleshipSfx.hit();
    else if (shot.result === "sunk") {
      battleshipSfx.sunk();
      const label = shot.shipId ? SHIP_LABELS[shot.shipId] : "ship";
      const mine = shot.seat === mySeat;
      const oppName = game?.mode === "solo" ? "Computer" : opponentName;
      setBanner(mine ? `You sank the ${label}!` : `${oppName} sank your ${label}!`);
      window.setTimeout(() => setBanner(null), 2400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleship.lastShot, battleship.turn]);

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
    void battleshipSfx.prime();
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

  // ---- Placement interactions ----
  const remainingShips = SHIP_ORDER.filter((id) => !placedShips.some((s) => s.id === id));

  const tryPlace = (x: number, y: number) => {
    void battleshipSfx.prime();
    const occupying = placedShips.find((s) => s.cells.some((c) => c.x === x && c.y === y));
    if (occupying) {
      setPlacedShips((prev) => prev.filter((s) => s.id !== occupying.id));
      setSelectedShip(occupying.id);
      battleshipSfx.place();
      return;
    }
    if (!selectedShip) return;
    if (!canPlaceShip(placedShips, selectedShip, x, y, orientation)) {
      toast({ title: "Can't place there", description: "Ships can't overlap or run off the board." });
      return;
    }
    const cells = cellsForShip(x, y, SHIP_LENGTHS[selectedShip], orientation);
    const next = [...placedShips, { id: selectedShip, cells, hits: cells.map(() => false) }];
    setPlacedShips(next);
    battleshipSfx.place();
    const remaining = SHIP_ORDER.filter((id) => !next.some((s) => s.id === id));
    setSelectedShip(remaining[0] ?? null);
  };

  const shuffleFleet = () => {
    void battleshipSfx.prime();
    setPlacedShips(randomFleet());
    setSelectedShip(null);
  };

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
        setPlacedShips([]);
        setSelectedShip(SHIP_ORDER[0]);
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

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    battleshipSfx.setMuted(next);
  };

  const closeHowTo = () => {
    setHowTo(false);
    try {
      localStorage.setItem(HOWTO_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <GameShell
      gameType="battleship"
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
      <div className="mx-auto mb-2 flex max-w-[380px] items-center justify-end gap-2">
        <button type="button" onClick={() => setHowTo(true)} aria-label="How to play" className="rounded-full bg-white/10 p-1.5 text-white/80 active:scale-95">
          <HelpCircle className="h-4 w-4" />
        </button>
        <button type="button" onClick={toggleMute} aria-label="Mute" className="rounded-full bg-white/10 p-1.5 text-white/80 active:scale-95">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {banner && (
        <div className="mx-auto mb-3 max-w-[380px] animate-fade-in rounded-xl border border-primary/40 bg-primary/15 py-2 text-center text-sm font-black text-white">
          {banner}
        </div>
      )}

      {battleship.phase === "placing" && !myFleetSet ? (
        <div className="mx-auto max-w-[380px]">
          <div className="mb-3 flex flex-wrap justify-center gap-1.5">
            {SHIP_ORDER.map((id) => {
              const placed = placedShips.some((s) => s.id === id);
              const active = selectedShip === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (placed) {
                      setPlacedShips((prev) => prev.filter((s) => s.id !== id));
                    }
                    setSelectedShip(id);
                  }}
                  className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase"
                  style={{
                    borderColor: active ? "hsl(var(--primary))" : "rgba(255,255,255,0.15)",
                    background: active ? "hsl(var(--primary) / 0.2)" : placed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                    color: placed && !active ? "#86efac" : "#fff",
                  }}
                >
                  {SHIP_LABELS[id]} · {SHIP_LENGTHS[id]}
                </button>
              );
            })}
          </div>

          <FleetGrid fleet={placedShips} shots={[]} showShips interactive onTap={tryPlace} />

          <p className="mt-2 text-center text-[11px] text-white/50">
            {selectedShip
              ? `Tap a cell to place the ${SHIP_LABELS[selectedShip]} (${orientation === "H" ? "horizontal" : "vertical"}).`
              : remainingShips.length
                ? "Pick a ship above to place it."
                : "All ships placed — tap Ready when you're set."}
          </p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setOrientation((o) => (o === "H" ? "V" : "H"))}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-3 py-3 text-sm font-black text-white active:scale-[0.98]"
            >
              <RotateCw className="h-4 w-4" /> Rotate
            </button>
            <button
              type="button"
              onClick={shuffleFleet}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-3 py-3 text-sm font-black text-white active:scale-[0.98]"
            >
              <Shuffle className="h-4 w-4" /> Random
            </button>
          </div>
          <button
            type="button"
            disabled={remainingShips.length > 0}
            onClick={() => void submitPlacement(placedShips)}
            className="mt-2 w-full rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground active:scale-[0.98] disabled:opacity-40"
          >
            Ready
          </button>
        </div>
      ) : battleship.phase === "placing" ? (
        <div className="mx-auto max-w-[380px]">
          <p className="mb-2 text-center text-xs font-bold text-white/60">Your fleet</p>
          <FleetGrid fleet={battleship.fleets[mySeat]} shots={battleship.shotsAt[oppSeat]} showShips interactive={false} />
        </div>
      ) : (
        <div className="mx-auto max-w-[380px] space-y-5">
          <div>
            <p className="mb-2 text-center text-xs font-bold text-white/60">Enemy waters — tap to fire</p>
            <FleetGrid fleet={null} shots={battleship.shotsAt[mySeat]} showShips={false} interactive={Boolean(myTurn)} onTap={(x, y) => void fire(x, y)} />
          </div>
          <div>
            <p className="mb-2 text-center text-xs font-bold text-white/60">Your waters</p>
            <FleetGrid fleet={battleship.fleets[mySeat]} shots={battleship.shotsAt[oppSeat]} showShips interactive={false} />
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

      <HowToPlayModal open={howTo} onClose={closeHowTo} />
    </GameShell>
  );
}
