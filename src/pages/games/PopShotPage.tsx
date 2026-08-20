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
import PopShotCourt from "@/components/games/pop-shot/PopShotCourt";
import { popShotSfx } from "@/lib/pop-shot-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import { PopShotState, RoundResult, Seat, applyRoundResult, initialPopShot } from "@/lib/pop-shot-run";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const HOW_TO_PLAY = [
  "Drag the power bar on the right upward to charge your shot, then let go to release it.",
  "Release inside the glowing green band for the best chance to swish it — too soft falls short, too hard sails long.",
  "Every make is worth 2 points. Sink 3 in a row and you're 'On Fire' — makes are worth 3 points until you miss.",
  "You've got 24 seconds to shoot as many as you can. 3 rounds each, alternating with your opponent — highest total score wins.",
];

export default function PopShotPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(popShotSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  const run: PopShotState = (game?.game_state?.popShot as PopShotState) || initialPopShot();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = run.phase === "over";
  const myTurn = game?.status === "active" && !finished && run.possession === mySeat;
  const computersTurn = game?.mode === "solo" && !finished && run.possession === oppSeat;

  const { stats, matchups } = useGameRecord("pop_shot", user?.id, finished);

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
    if (iWon) popShotSfx.win();
    const outcome = draw ? "draw" : iWon ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "pop_shot", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: PopShotState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { popShot: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { popShot: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const finishRound = async (seat: Seat, result: RoundResult) => {
    if (!game || !user) return;
    const next = applyRoundResult(run, seat, result);
    const n = moveNumber + 1;
    await recordMove(game.id, seat === mySeat ? user.id : null, n, { result, seat });
    const nextTurnUserId = game.mode === "solo" ? user.id : next.possession === mySeat ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { popShot: initialPopShot(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("pop_shot", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("pop_shot", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("pop_shot", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("pop_shot", user.id, opponentId, { popShot: initialPopShot(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("pop_shot", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = run.winnerSeat === null;
    const iWon = run.winnerSeat === mySeat;
    const text = `I just ${draw ? "tied" : iWon ? "won" : "lost"} a game of Pop Shot on YAJ 🏀`;
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

  const myRoundNumber = run.roundsPlayed[mySeat] + 1;
  const oppRoundNumber = run.roundsPlayed[oppSeat] + 1;
  const roundLabel = myTurn
    ? `Your round — ${Math.min(myRoundNumber, run.maxRounds)} of ${run.maxRounds}`
    : `${oppLabel}'s round — ${Math.min(oppRoundNumber, run.maxRounds)} of ${run.maxRounds}`;

  const resultTitle = draw ? "Ends in a tie" : iWon ? "You win!" : `${oppLabel} wins`;
  const resultDetail = finished
    ? `Final score — you ${run.scores[mySeat]} · ${oppLabel} ${run.scores[oppSeat]}  •  Makes ${run.makes[mySeat]}-${run.makes[oppSeat]}`
    : undefined;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    popShotSfx.setMuted(next);
  };

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        {seated && !finished && (myTurn || computersTurn) && (
          <PopShotCourt
            key={`${run.possession}-${run.roundNumber}`}
            active
            auto={!myTurn}
            roundLabel={roundLabel}
            myScore={run.scores[mySeat]}
            oppScore={run.scores[oppSeat]}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            howToPlay={HOW_TO_PLAY}
            onComplete={(result) => void finishRound(run.possession, result)}
          />
        )}

        {seated && !finished && !myTurn && !computersTurn && (
          <PopShotCourt
            active={false}
            roundLabel={roundLabel}
            myScore={run.scores[mySeat]}
            oppScore={run.scores[oppSeat]}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            howToPlay={HOW_TO_PLAY}
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
          title="Pop Shot"
          subtitle={game.mode === "solo" ? "24-second shootout — solo vs Computer" : `24-second shootout — you vs ${opponentName}`}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: oppLabel, avatarUrl: game.mode === "solo" ? null : opponentAvatar, isComputer: game.mode === "solo" }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSeated(true);
            void popShotSfx.prime();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              void popShotSfx.prime();
              return;
            }
            void (async () => {
              if (!user) return;
              try {
                const g = await createSoloGame("pop_shot", user.id, { popShot: initialPopShot(), moveNumber: 0 });
                statsWritten.current = null;
                navigate(gameRoute("pop_shot", g.id), { replace: true });
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
        title="Challenge to Pop Shot"
      />
    </LandscapeStage>
  );
}
