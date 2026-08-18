import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PoolTable from "@/components/games/pool/PoolTable";
import PoolIntro, { PoolMatchup, PoolStats } from "@/components/games/pool/PoolIntro";
import LandscapeStage from "@/components/games/pro/LandscapeStage";
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import { useTurnGame } from "@/hooks/use-turn-game";
import { casinoMusic } from "@/lib/casino-music";
import { poolSfx } from "@/lib/pool-sfx";
import {
  PoolState,
  Seat,
  ShotSimResult,
  ballsRemaining,
  computerPlacement,
  computerShot,
  initialPool,
  placeCueBall,
  resolveShot,
  simulateShot,
} from "@/lib/pool";
import {
  bumpStats,
  createMultiplayerGame,
  createSoloGame,
  getMyStats,
  listMyGames,
  recordMove,
  updateGameState,
} from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const HOW_TO_PLAY = [
  "Drag anywhere on the table to aim the cue.",
  "Hold and drag the side slider up to charge power, then release to shoot.",
  "Pot one of your group (solids or stripes) to keep shooting.",
  "Clear your group, then legally pocket the 8-ball to win.",
  "Fouls (scratch, wrong ball first, no rail) hand the other player ball in hand — tap anywhere to place the cue ball.",
];

type Pending = { resolution: ReturnType<typeof resolveShot>; moveNumber: number; seat: Seat };

export default function PoolPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);

  const written = useRef<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [seated, setSeated] = useState(false);
  const [muted, setMuted] = useState(poolSfx.muted);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState("You");
  const [playback, setPlayback] = useState<ShotSimResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [matchups, setMatchups] = useState<PoolMatchup[]>([]);


  const poolRef = useRef<PoolState>(initialPool());
  const pendingRef = useRef<Pending | null>(null);
  const lastAnimatedMove = useRef<number>(0);
  const animatedForGame = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void (supabase as any)
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setMyAvatar(data?.avatar_url || null);
        setMyName(data?.display_name || "You");
      });
  }, [user?.id]);

  // Pool record + recent matchups shown behind the intro's "Track Your Best Break" action.
  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      try {
        const [rows, games] = await Promise.all([getMyStats(user.id), listMyGames(user.id)]);
        const s = rows.find((r) => r.game_type === "pool");
        setPoolStats({
          played: s?.games_played ?? 0,
          wins: s?.wins ?? 0,
          losses: s?.losses ?? 0,
          bestStreak: s?.best_streak ?? 0,
          highScore: s?.high_score ?? 0,
        });
        setMatchups(
          games
            .filter((g: any) => g.game_type === "pool")
            .slice(0, 10)
            .map((g: any) => ({
              id: g.id,
              label: g.mode === "solo" ? "Solo vs Computer" : "Head-to-head match",
              detail: new Date(g.updated_at || g.created_at).toLocaleDateString(),
              outcome:
                g.status !== "completed"
                  ? ("open" as const)
                  : g.winner_user_id === user.id
                    ? ("win" as const)
                    : ("loss" as const),
            })),
        );
      } catch {
        /* stats are non-critical */
      }
    })();
  }, [user?.id, game?.status]);



  const pool: PoolState = (game?.game_state?.pool as PoolState) || initialPool();
  poolRef.current = pool;
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = pool.phase === "over";
  const myTurn = game?.status === "active" && !finished && pool.turnSeat === mySeat;

  // Reset shot-replay bookkeeping whenever a different game is loaded.
  useEffect(() => {
    if (!game?.id) return;
    if (animatedForGame.current !== game.id) {
      animatedForGame.current = game.id;
      lastAnimatedMove.current = pool.lastShot?.moveNumber ?? 0;
    }
  }, [game?.id]);

  // Replay a shot that arrived from the network (opponent's move) using the exact same
  // deterministic simulation the shooter ran — no positions need to travel over the wire.
  useEffect(() => {
    if (!game || !pool.lastShot || !pool.preShotBalls) return;
    if (pool.lastShot.moveNumber <= lastAnimatedMove.current) return;
    lastAnimatedMove.current = pool.lastShot.moveNumber;
    const sim = simulateShot(pool.preShotBalls, pool.lastShot.angle, pool.lastShot.power);
    setPlayback(sim);
  }, [game?.game_state]);

  useEffect(() => {
    if (!game || !user || !finished || written.current === game.id) return;
    written.current = game.id;
    if (pool.winnerSeat === mySeat) casinoMusic.fanfare();
    if (game.status === "completed") return;
    const iWon = pool.winnerSeat === mySeat;
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: false,
        winner_user_id: iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "pool", iWon ? "win" : "loss");
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: PoolState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { pool: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, {
      game_state: { pool: state, moveNumber: n },
      current_turn_user_id: nextTurnUserId,
    });
    await refresh();
  };

  const takeShot = (seat: Seat, angle: number, power: number, base?: PoolState) => {
    if (!game || !user) return;
    const state = base ?? poolRef.current;
    const sim = simulateShot(state.balls, angle, power);
    const n = moveNumber + 1;
    const resolution = resolveShot(state, seat, angle, power, sim, n);
    pendingRef.current = { resolution, moveNumber: n, seat };
    lastAnimatedMove.current = n;
    setPlayback(sim);
  };

  const handleShoot = (angle: number, power: number) => {
    if (!myTurn || playback) return;
    takeShot(mySeat, angle, power);
  };

  const handlePlaceCue = (x: number, y: number) => {
    if (!game || !myTurn || !pool.ballInHand) return;
    const next = placeCueBall(pool, x, y);
    setGame({ ...game, game_state: { ...game.game_state, pool: next } });
  };

  const handlePlaybackDone = () => {
    setPlayback(null);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending || !game || !user) return;
    const { resolution, moveNumber: n, seat } = pending;
    const shooterIsMe = seat === mySeat;
    void recordMove(game.id, shooterIsMe ? user.id : null, n, {
      angle: resolution.nextState.lastShot?.angle ?? 0,
      power: resolution.nextState.lastShot?.power ?? 0,
      seat,
    });

    let nextTurnUserId: string | null;
    if (game.mode === "solo") {
      nextTurnUserId = user.id; // convention: solo mode's DB turn is always the human's id
    } else {
      const staysWithShooter = resolution.turnContinues;
      const shooterUserId = shooterIsMe ? user.id : (opponent?.user_id ?? null);
      const otherUserId = shooterIsMe ? (opponent?.user_id ?? null) : user.id;
      nextTurnUserId = staysWithShooter ? shooterUserId : otherUserId;
    }

    setCommitting(true);
    void commit(resolution.nextState, n, nextTurnUserId).finally(() => setCommitting(false));
    if (resolution.message) toast({ title: resolution.message });
  };

  // Drive the computer's turn in solo mode: place ball-in-hand if needed, then shoot.
  useEffect(() => {
    if (!game || game.mode !== "solo" || finished || playback) return;
    if (pool.turnSeat !== oppSeat) return;
    const t = window.setTimeout(() => {
      let state = poolRef.current;
      if (state.ballInHand) {
        const spot = computerPlacement(state);
        state = placeCueBall(state, spot.x, spot.y);
        poolRef.current = state;
        if (game) setGame({ ...game, game_state: { ...game.game_state, pool: state } });
      }
      const { angle, power } = computerShot(state, oppSeat);
      takeShot(oppSeat, angle, power, state);
    }, 900);
    return () => window.clearTimeout(t);
  }, [game?.id, pool.turnSeat, finished, playback, moveNumber]);

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { pool: initialPool(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("pool", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("pool", user.id, opponent.user_id, state)
            : null;
      if (g) {
        written.current = null;
        navigate(gameRoute("pool", g.id), { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Could not start a rematch", description: err.message, variant: "destructive" });
    }
  };

  const challenge = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("pool", user.id, opponentId, {
        pool: initialPool(),
        moveNumber: 0,
      });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("pool", g.id), { replace: true });
    } catch (err: any) {
      toast({ title: "Could not send the challenge", description: err.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const iWon = pool.winnerSeat === mySeat;
    const text = `I just ${iWon ? "won" : "lost"} a game of 8-Ball Pool on YAJ 🎱`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Result copied" });
      }
    } catch {
      /* cancelled */
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    poolSfx.setMuted(next);
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
        <button
          type="button"
          onClick={() => navigate("/games")}
          className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
        >
          Back to Games
        </button>
      </div>
    );
  }

  const oppLabel = game.mode === "solo" ? "Computer" : opponentName;
  const turnLabel =
    game.status === "waiting"
      ? "Waiting"
      : game.status === "cancelled"
        ? "Declined"
        : finished
          ? pool.winnerSeat === mySeat
            ? "You won"
            : "You lost"
          : myTurn
            ? pool.ballInHand
              ? "Ball in hand"
              : "Your turn"
            : `${oppLabel}'s turn`;

  const outcome: "win" | "loss" = pool.winnerSeat === mySeat ? "win" : "loss";
  const resultTitle = outcome === "win" ? "You won!" : `${oppLabel} won`;
  const resultDetail =
    finished && pool.groups[mySeat]
      ? `You played ${pool.groups[mySeat]} — ${ballsRemaining(pool.groups[mySeat], pool.balls)} left on the table.`
      : undefined;

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        <PoolTable
          balls={pool.balls}
          playback={playback}
          onPlaybackDone={handlePlaybackDone}
          interactive={Boolean(myTurn && !playback && !finished && !committing)}
          ballInHand={pool.ballInHand}
          onShoot={handleShoot}
          onPlaceCue={handlePlaceCue}
          myTurn={Boolean(myTurn)}
          finished={finished}
          myName={myName}
          myAvatar={myAvatar}
          myGroup={pool.groups[mySeat]}
          oppName={oppLabel}
          oppAvatar={game.mode === "solo" ? null : opponentAvatar}
          oppGroup={pool.groups[oppSeat]}
          isComputer={game.mode === "solo"}
          turnLabel={turnLabel}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => navigate("/games")}
          howToPlay={HOW_TO_PLAY}
        />

        <PoolIntro
          open={!seated && !finished}
          subtitle={game.mode === "solo" ? "Solo table vs the house computer" : `You vs ${opponentName}`}
          muted={muted}
          onToggleMute={toggleMute}
          onStart={() => {
            setSeated(true);
            void poolSfx.prime();
          }}
          onBack={() => navigate("/games")}
          stats={poolStats}
          matchups={matchups}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              void poolSfx.prime();
              return;
            }
            void (async () => {
              if (!user) return;
              try {
                const g = await createSoloGame("pool", user.id, { pool: initialPool(), moveNumber: 0 });
                written.current = null;
                navigate(gameRoute("pool", g.id), { replace: true });
              } catch (err: any) {
                toast({ title: "Could not start a solo table", description: err.message, variant: "destructive" });
              }
            })();
          }}
          onQuickMatch={() => setPicker(true)}
        />

      </div>

      <GameResultCard
        open={finished}
        outcome={outcome}
        title={resultTitle}
        detail={resultDetail}
        onRematch={rematch}
        onChallenge={() => setPicker(true)}
        onShare={shareResult}
      />

      <OpponentPickerSheet
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(p) => {
          setPicker(false);
          void challenge(p.user_id, p.display_name || "your opponent");
        }}
        title="Challenge to 8-Ball Pool"
      />
    </LandscapeStage>
  );
}
