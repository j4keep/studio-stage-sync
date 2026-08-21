import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HelpCircle, Loader2, RotateCw, Shuffle, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import OceanBoard from "@/components/games/battleship/OceanBoard";
import BoatStatusStrip from "@/components/games/battleship/BoatStatusStrip";
import SonarButton from "@/components/games/battleship/SonarButton";
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
  SONAR_USES,
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
  sonarUsesLeft,
  useSonar,
} from "@/lib/battleship";
import { GameStatsRow, bumpStats, createMultiplayerGame, createSoloGame, leaderboard, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";
import fleetClashArt from "@/assets/games/fleet-clash.svg";

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
  const [sonarMode, setSonarMode] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState<GameStatsRow[]>([]);
  const seenSonarTurn = useRef<number | null>(null);
  const outcomeSfxPlayed = useRef<string | null>(null);

  const rawState: BattleshipState = (game?.game_state?.battleship as BattleshipState) || initialBattleship();
  // Defensive default for any game started before Sonar Pulse existed.
  const battleship: BattleshipState = {
    ...rawState,
    sonarUses: rawState.sonarUses ?? [SONAR_USES, SONAR_USES],
    lastSonar: rawState.lastSonar ?? null,
  };
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
      const label = shot.shipId ? SHIP_LABELS[shot.shipId] : "boat";
      const mine = shot.seat === mySeat;
      const oppName = game?.mode === "solo" ? "Computer" : opponentName;
      setBanner(mine ? `You disabled the ${label}!` : `${oppName} disabled your ${label}!`);
      window.setTimeout(() => setBanner(null), 2400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleship.lastShot, battleship.turn]);

  // Sound + a "Ship detected!" / "Clear water" banner whenever a Sonar Pulse resolves.
  useEffect(() => {
    if (!battleship.lastSonar || seenSonarTurn.current === battleship.lastSonar.turn) return;
    seenSonarTurn.current = battleship.lastSonar.turn;
    const sonar = battleship.lastSonar;
    battleshipSfx.sonarPulse();
    const mine = sonar.seat === mySeat;
    if (mine) setBanner(sonar.found ? "Ship detected!" : "Clear water.");
    window.setTimeout(() => setBanner(null), 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleship.lastSonar]);

  useEffect(() => {
    if (!game || !user || !finished || statsWritten.current === game.id) return;
    if (game.status === "completed") {
      statsWritten.current = game.id;
      return;
    }
    statsWritten.current = game.id;
    const iWon = battleship.winnerSeat === mySeat;
    if (outcomeSfxPlayed.current !== game.id) {
      outcomeSfxPlayed.current = game.id;
      if (iWon) battleshipSfx.victory();
      else battleshipSfx.defeat();
    }
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

  // Gentle ocean bed while the game is open, muted the same way everything else is.
  useEffect(() => {
    if (!muted) battleshipSfx.ambienceStart();
    return () => battleshipSfx.ambienceStop();
  }, [muted]);

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
    battleshipSfx.launch();
    const next = fireShot(battleship, mySeat, x, y);
    const n = moveNumber + 1;
    await recordMove(game.id, user.id, n, { x, y, seat: mySeat });
    const nextTurnUserId = game.mode === "solo" ? user.id : next.turnSeat === mySeat ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  const pulseSonar = async (x: number, y: number) => {
    if (!game || !user || !myTurn || sonarUsesLeft(battleship, mySeat) <= 0) return;
    void battleshipSfx.prime();
    const next = useSonar(battleship, mySeat, x, y);
    const n = moveNumber + 1;
    await recordMove(game.id, user.id, n, { sonar: { x, y, seat: mySeat } });
    const nextTurnUserId = game.mode === "solo" ? user.id : next.turnSeat === mySeat ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
    setSonarMode(false);
  };

  // Drive the computer's shot in solo mode.
  useEffect(() => {
    if (!game || game.mode !== "solo" || finished) return;
    if (battleship.phase !== "battle" || battleship.turnSeat !== oppSeat) return;
    battleshipSfx.turnChange();
    const t = window.setTimeout(() => {
      if (!user) return;
      const state = stateRef.current;
      const shot = computerShot(state, oppSeat);
      battleshipSfx.launch();
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
        outcomeSfxPlayed.current = null;
        setPlacedShips([]);
        setSelectedShip(SHIP_ORDER[0]);
        setSonarMode(false);
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
            ? "Fleet Victory — every enemy boat disabled!"
            : `${oppLabel} disabled your fleet`
          : battleship.phase === "placing"
            ? myFleetSet
              ? `Waiting for ${oppLabel} to place their fleet`
              : "Place your fleet"
            : myTurn
              ? sonarMode
                ? "Choose a zone to pulse"
                : "Your turn — choose a target"
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

  const openLeaderboard = () => {
    setLeaderboardOpen(true);
    void leaderboard("battleship", 10).then(setLeaderboardRows);
  };

  return (
    <GameShell
      gameType="battleship"
      title="YAJ Fleet Clash"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      artUrl={fleetClashArt}
      status={status}
      finished={finished}
      shareText={`I just ${iWon ? "won" : "lost"} a battle of YAJ Fleet Clash 🌊`}
      onRematch={rematch}
      onChallenge={challengeOther}
      me={{ name: "You", meta: battleship.phase === "battle" || finished ? `${shipsRemaining(battleship.fleets[mySeat])} boats left` : undefined }}
      them={{
        name: oppLabel,
        avatarUrl: game.mode === "solo" ? null : opponentAvatar,
        isComputer: game.mode === "solo",
        meta: battleship.phase === "battle" || finished ? `${shipsRemaining(battleship.fleets[oppSeat])} boats left` : undefined,
      }}
      myTurn={myTurn}
      outcome={outcome as any}
      resultTitle={iWon ? "Fleet Victory!" : "Fleet Defeated"}
      resultDetail={iWon ? "Every enemy boat disabled." : "Line up a rematch."}
    >
      <div className="mx-auto mb-2 flex max-w-[380px] items-center justify-end gap-2">
        <button type="button" onClick={openLeaderboard} aria-label="Leaderboard" className="rounded-full bg-white/10 p-1.5 text-white/80 active:scale-95">
          <Trophy className="h-4 w-4" />
        </button>
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

          <OceanBoard fleet={placedShips} shots={[]} showShips interactive onTap={tryPlace} variant="a" />

          <p className="mt-2 text-center text-[11px] text-white/50">
            {selectedShip
              ? `Tap the water to place the ${SHIP_LABELS[selectedShip]} (${orientation === "H" ? "horizontal" : "vertical"}).`
              : remainingShips.length
                ? "Pick a boat above to place it."
                : "All boats placed — tap Ready when you're set."}
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
          <OceanBoard fleet={battleship.fleets[mySeat]} shots={battleship.shotsAt[oppSeat]} showShips interactive={false} variant="a" />
        </div>
      ) : (
        <div className="mx-auto max-w-[380px] space-y-4">
          <div>
            <p className="mb-2 text-center text-xs font-bold text-white/60">Enemy waters</p>
            <OceanBoard
              fleet={null}
              shots={battleship.shotsAt[mySeat]}
              showShips={false}
              interactive={Boolean(myTurn)}
              twoStep
              confirmMode={sonarMode ? "sonar" : "fire"}
              onTap={(x, y) => void (sonarMode ? pulseSonar(x, y) : fire(x, y))}
              variant="a"
              dim
              prompt={sonarMode ? "CHOOSE A ZONE TO PULSE" : "YOUR TURN — CHOOSE A TARGET"}
              sonarResult={battleship.lastSonar?.seat === mySeat ? battleship.lastSonar : null}
            />
          </div>

          {myTurn && (
            <div className="flex items-center justify-center gap-2">
              <SonarButton usesLeft={sonarUsesLeft(battleship, mySeat)} onUse={() => setSonarMode((v) => !v)} disabled={false} />
              {sonarMode && (
                <button type="button" onClick={() => setSonarMode(false)} className="text-[11px] font-bold text-white/50 underline">
                  Cancel
                </button>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-center text-xs font-bold text-white/60">Your waters</p>
            <OceanBoard
              fleet={battleship.fleets[mySeat]}
              shots={battleship.shotsAt[oppSeat]}
              showShips
              interactive={false}
              variant="b"
              sonarResult={battleship.lastSonar?.seat === oppSeat ? battleship.lastSonar : null}
            />
            <div className="mt-2">
              <BoatStatusStrip fleet={battleship.fleets[mySeat]} />
            </div>
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

      {leaderboardOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 px-4" onClick={() => setLeaderboardOpen(false)}>
          <div
            className="w-full max-w-sm rounded-3xl border border-primary/30 p-5"
            style={{ background: "linear-gradient(180deg, hsl(232 42% 12%), hsl(234 45% 7%))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Fleet Clash Leaderboard</h2>
              <button type="button" onClick={() => setLeaderboardOpen(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            {leaderboardRows.length === 0 ? (
              <p className="text-xs font-semibold text-white/55">No captains ranked yet — win a battle to get on the board.</p>
            ) : (
              <div className="space-y-1.5">
                {leaderboardRows.map((row, i) => (
                  <div key={row.user_id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-xs font-black text-white">
                      #{i + 1} · {row.wins}W / {row.losses}L
                    </span>
                    <span className="text-xs font-bold text-primary">{row.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </GameShell>
  );
}
