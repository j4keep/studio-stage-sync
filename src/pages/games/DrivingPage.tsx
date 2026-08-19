import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameIntro from "@/components/games/GameIntro";
import { useGameRecord } from "@/components/games/GameQuickActions";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import LandscapeStage from "@/components/games/pro/LandscapeStage";
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import DrivingRace from "@/components/games/driving/DrivingRace";
import { drivingSfx } from "@/lib/driving-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import { DrivingRunState, RunResult, Seat, applyRunResult, initialDrivingRun } from "@/lib/driving-run";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const SEAT_COLORS = ["#2563eb", "#e0453f"];

export default function DrivingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(drivingSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  const run: DrivingRunState = (game?.game_state?.drivingRun as DrivingRunState) || initialDrivingRun();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = run.phase === "over";
  const myTurn = game?.status === "active" && !finished && run.possession === mySeat;
  const computersTurn = game?.mode === "solo" && !finished && run.possession === oppSeat;

  const { stats, matchups } = useGameRecord("driving", user?.id, finished);

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

  useEffect(() => {
    if (!game || !user || !finished || statsWritten.current === game.id) return;
    if (game.status === "completed") {
      statsWritten.current = game.id;
      return;
    }
    statsWritten.current = game.id;
    const draw = run.winnerSeat === null;
    const iWon = run.winnerSeat === mySeat;
    const outcome = draw ? "draw" : iWon ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "driving", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: DrivingRunState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { drivingRun: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { drivingRun: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const finishRun = async (seat: Seat, result: RunResult) => {
    if (!game || !user) return;
    const next = applyRunResult(run, seat, result);
    const n = moveNumber + 1;
    await recordMove(game.id, seat === mySeat ? user.id : null, n, { result, seat });
    const nextTurnUserId = game.mode === "solo" ? user.id : next.possession === mySeat ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { drivingRun: initialDrivingRun(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("driving", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("driving", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("driving", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("driving", user.id, opponentId, { drivingRun: initialDrivingRun(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("driving", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = run.winnerSeat === null;
    const iWon = run.winnerSeat === mySeat;
    const text = `I just ${draw ? "drew" : iWon ? "won" : "lost"} a race on YAJ 🏎️`;
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
        <p className="font-bold">This race is no longer available.</p>
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to Games
        </button>
      </div>
    );
  }

  const oppLabel = game.mode === "solo" ? "Computer" : opponentName;
  const draw = finished && run.winnerSeat === null;
  const iWon = finished && run.winnerSeat === mySeat;
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : iWon ? "win" : "loss";

  const myRunNumber = run.runsPlayed[mySeat] + 1;
  const oppRunNumber = run.runsPlayed[oppSeat] + 1;
  const driveLabel = myTurn
    ? `Your run — ${Math.min(myRunNumber, run.maxRuns)} of ${run.maxRuns}`
    : `${oppLabel}'s run — ${Math.min(oppRunNumber, run.maxRuns)} of ${run.maxRuns}`;

  const resultTitle = draw ? "Ends in a tie" : iWon ? "You win!" : `${oppLabel} wins`;
  const resultDetail = finished
    ? `Final score — you ${run.scores[mySeat]} · ${oppLabel} ${run.scores[oppSeat]}  •  Clean runs ${run.finishes[mySeat]}-${run.finishes[oppSeat]}`
    : undefined;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    drivingSfx.setMuted(next);
  };

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        {seated && !finished && (myTurn || computersTurn) && (
          <DrivingRace
            key={`${run.possession}-${run.runNumber}`}
            active
            auto={!myTurn}
            carColor={SEAT_COLORS[run.possession]}
            driveLabel={driveLabel}
            myScore={run.scores[mySeat]}
            oppScore={run.scores[oppSeat]}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onComplete={(result) => void finishRun(run.possession, result)}
          />
        )}

        {seated && !finished && !myTurn && !computersTurn && (
          <DrivingRace
            active={false}
            carColor={SEAT_COLORS[mySeat]}
            driveLabel={driveLabel}
            myScore={run.scores[mySeat]}
            oppScore={run.scores[oppSeat]}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onComplete={() => {}}
          />
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
          placement="rail"
          onChanged={refresh}
        />

        <GameIntro
          open={!seated && !finished}
          title="Drive"
          subtitle={game.mode === "solo" ? "Dodge traffic — solo vs Computer" : `Dodge traffic — you vs ${opponentName}`}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: oppLabel, avatarUrl: game.mode === "solo" ? null : opponentAvatar, isComputer: game.mode === "solo" }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSeated(true);
            void drivingSfx.prime();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              void drivingSfx.prime();
              return;
            }
            void (async () => {
              if (!user) return;
              try {
                const g = await createSoloGame("driving", user.id, { drivingRun: initialDrivingRun(), moveNumber: 0 });
                statsWritten.current = null;
                navigate(gameRoute("driving", g.id), { replace: true });
              } catch (e: any) {
                toast({ title: "Could not start a solo race", description: e.message, variant: "destructive" });
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
          void challengeOther(p.user_id, p.display_name || "your opponent");
        }}
        title="Challenge to Drive"
      />
    </LandscapeStage>
  );
}
