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
import FootballPlay from "@/components/games/football/FootballPlay";
import { footballSfx } from "@/lib/football-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import { DriveResult, FootballRunState, PlayType, Seat, applyDriveResult, initialFootballRun } from "@/lib/football-run";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const SEAT_ACCENTS = ["hsl(204 100% 55%)", "#f59e0b"];

export default function FootballPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);
  const computerPlayType = useRef<PlayType>("run");

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(footballSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [chosenPlay, setChosenPlay] = useState<PlayType | null>(null);

  const run: FootballRunState = (game?.game_state?.footballRun as FootballRunState) || initialFootballRun();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = run.phase === "over";
  const myTurn = game?.status === "active" && !finished && run.possession === mySeat;
  const computersTurn = game?.mode === "solo" && !finished && run.possession === oppSeat;

  const { stats, matchups } = useGameRecord("football", user?.id, finished);

  // Reset the play-call choice whenever a new drive comes up for me.
  useEffect(() => {
    setChosenPlay(null);
  }, [run.driveNumber, mySeat]);

  useEffect(() => {
    if (computersTurn) computerPlayType.current = Math.random() < 0.55 ? "run" : "pass";
  }, [computersTurn, run.driveNumber]);

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
      await bumpStats(user.id, "football", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: FootballRunState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { footballRun: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { footballRun: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const finishDrive = async (seat: Seat, result: DriveResult) => {
    if (!game || !user) return;
    const next = applyDriveResult(run, seat, result);
    const n = moveNumber + 1;
    await recordMove(game.id, seat === mySeat ? user.id : null, n, { result, seat });
    const nextTurnUserId = game.mode === "solo" ? user.id : next.possession === mySeat ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { footballRun: initialFootballRun(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("football", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("football", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("football", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("football", user.id, opponentId, { footballRun: initialFootballRun(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("football", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = run.winnerSeat === null;
    const iWon = run.winnerSeat === mySeat;
    const text = `I just ${draw ? "drew" : iWon ? "won" : "lost"} a game of Football on YAJ 🏈`;
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
        <p className="font-bold">This game is no longer available.</p>
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

  const myDriveNumber = run.drivesPlayed[mySeat] + 1;
  const oppDriveNumber = run.drivesPlayed[oppSeat] + 1;
  const driveLabel = myTurn
    ? `Your drive — ${Math.min(myDriveNumber, run.maxDrives)} of ${run.maxDrives}`
    : `${oppLabel}'s drive — ${Math.min(oppDriveNumber, run.maxDrives)} of ${run.maxDrives}`;

  const resultTitle = draw ? "Ends in a tie" : iWon ? "You win!" : `${oppLabel} wins`;
  const resultDetail = finished
    ? `Final score — you ${run.scores[mySeat]} · ${oppLabel} ${run.scores[oppSeat]}  •  TDs ${run.touchdowns[mySeat]}-${run.touchdowns[oppSeat]}  •  ${run.totalYards[mySeat]} total yds, ${run.totalDodges[mySeat]} dodges`
    : undefined;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    footballSfx.setMuted(next);
  };

  const showPlayCall = seated && !finished && myTurn && !chosenPlay;
  const activePlayType = myTurn ? chosenPlay : computersTurn ? computerPlayType.current : null;

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        {seated && !finished && (myTurn || computersTurn) && activePlayType && !showPlayCall && (
          <FootballPlay
            key={`${run.possession}-${run.driveNumber}`}
            active
            playType={activePlayType}
            auto={!myTurn}
            carrierAccent={SEAT_ACCENTS[run.possession]}
            defenderAccent={SEAT_ACCENTS[run.possession === 0 ? 1 : 0]}
            driveLabel={driveLabel}
            myScore={run.scores[mySeat]}
            oppScore={run.scores[oppSeat]}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onComplete={(result) => void finishDrive(run.possession, result)}
          />
        )}

        {seated && !finished && !myTurn && !computersTurn && (
          <FootballPlay
            active={false}
            playType="run"
            carrierAccent={SEAT_ACCENTS[mySeat]}
            defenderAccent={SEAT_ACCENTS[oppSeat]}
            driveLabel={driveLabel}
            myScore={run.scores[mySeat]}
            oppScore={run.scores[oppSeat]}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onComplete={() => {}}
          />
        )}

        {showPlayCall && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/75 px-6">
            <p className="text-xs font-black uppercase tracking-widest text-white/60">{driveLabel}</p>
            <p className="text-lg font-black text-white">Call your play</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setChosenPlay("run")}
                className="flex w-32 flex-col items-center gap-1 rounded-2xl border-2 border-[hsl(204,100%,55%)] bg-[hsl(210,60%,14%)] px-4 py-4 text-white active:scale-95"
              >
                <span className="text-2xl">🏃</span>
                <span className="text-sm font-black uppercase">Run</span>
                <span className="text-[10px] text-white/60">Hand off, dodge live</span>
              </button>
              <button
                type="button"
                onClick={() => setChosenPlay("pass")}
                className="flex w-32 flex-col items-center gap-1 rounded-2xl border-2 border-[#f59e0b] bg-[hsl(30,50%,14%)] px-4 py-4 text-white active:scale-95"
              >
                <span className="text-2xl">🏈</span>
                <span className="text-sm font-black uppercase">Pass</span>
                <span className="text-[10px] text-white/60">Aim &amp; throw, then dodge</span>
              </button>
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
          placement="rail"
          onChanged={refresh}
        />

        <GameIntro
          open={!seated && !finished}
          title="Football"
          subtitle={game.mode === "solo" ? "Call the play — solo vs Computer" : `Call the play — you vs ${opponentName}`}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: oppLabel, avatarUrl: game.mode === "solo" ? null : opponentAvatar, isComputer: game.mode === "solo" }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSeated(true);
            void footballSfx.prime();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              void footballSfx.prime();
              return;
            }
            void (async () => {
              if (!user) return;
              try {
                const g = await createSoloGame("football", user.id, { footballRun: initialFootballRun(), moveNumber: 0 });
                statsWritten.current = null;
                navigate(gameRoute("football", g.id), { replace: true });
              } catch (e: any) {
                toast({ title: "Could not start a solo game", description: e.message, variant: "destructive" });
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
        title="Challenge to Football"
      />
    </LandscapeStage>
  );
}
