import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameIntro from "@/components/games/GameIntro";
import { useGameRecord } from "@/components/games/GameQuickActions";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import WaitingForOpponentGate from "@/components/games/WaitingForOpponentGate";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import MiniGolfBoard from "@/components/games/mini-golf/MiniGolfBoard";
import { miniGolfSfx } from "@/lib/mini-golf-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import { MiniGolfState, RoundResult, Seat, applyRoundResult, initialMiniGolf } from "@/lib/mini-golf-run";
import { bumpStats, createMultiplayerGame, createSoloGame, endGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const HOW_TO_PLAY = [
  "Drag anywhere on the green to aim, then charge the power slider on the right and let go to putt.",
  "Sink the ball in as few strokes as possible — fewer strokes than par scores more points.",
  "Water hazards cost a penalty stroke and send the ball back to where you last putted from.",
  "3 holes each, alternating with your opponent — highest total score wins.",
];

export default function MiniGolfPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(miniGolfSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  const run: MiniGolfState = (game?.game_state?.miniGolf as MiniGolfState) || initialMiniGolf();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = run.phase === "over";
  const myTurn = game?.status === "active" && !finished && run.possession === mySeat;
  const computersTurn = game?.mode === "solo" && !finished && run.possession === oppSeat;

  const { stats, matchups } = useGameRecord("mini_golf", user?.id, finished);

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
    if (iWon) miniGolfSfx.win();
    const outcome = draw ? "draw" : iWon ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "mini_golf", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: MiniGolfState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { miniGolf: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { miniGolf: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
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
      const state = { miniGolf: initialMiniGolf(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("mini_golf", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("mini_golf", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("mini_golf", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("mini_golf", user.id, opponentId, { miniGolf: initialMiniGolf(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("mini_golf", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = run.winnerSeat === null;
    const iWon = run.winnerSeat === mySeat;
    const text = `I just ${draw ? "tied" : iWon ? "won" : "lost"} a game of Mini Golf on YAJ ⛳`;
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
    ? `Your hole — ${Math.min(myRoundNumber, run.maxRounds)} of ${run.maxRounds}`
    : `${oppLabel}'s hole — ${Math.min(oppRoundNumber, run.maxRounds)} of ${run.maxRounds}`;

  const resultTitle = draw ? "Ends in a tie" : iWon ? "You win!" : `${oppLabel} wins`;
  const resultDetail = finished
    ? `Final score — you ${run.scores[mySeat]} · ${oppLabel} ${run.scores[oppSeat]}  •  Strokes ${run.strokesTaken[mySeat]}-${run.strokesTaken[oppSeat]}`
    : undefined;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    miniGolfSfx.setMuted(next);
  };

  const quitGame = () => {
    void (async () => {
      await endGame(game.id);
      navigate("/games");
    })();
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        {seated && !finished && (myTurn || computersTurn) && (
          <MiniGolfBoard
            key={`${run.possession}-${run.roundNumber}`}
            active
            auto={!myTurn}
            roundLabel={roundLabel}
            myScore={run.scores[mySeat]}
            oppScore={run.scores[oppSeat]}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onQuit={quitGame}
            howToPlay={HOW_TO_PLAY}
            onComplete={(result) => void finishRound(run.possession, result)}
          />
        )}

        {seated && !finished && !myTurn && !computersTurn && (
          <MiniGolfBoard
            active={false}
            roundLabel={roundLabel}
            myScore={run.scores[mySeat]}
            oppScore={run.scores[oppSeat]}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onQuit={quitGame}
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

        <WaitingForOpponentGate
          show={game.mode === "multiplayer" && game.status === "waiting" && game.host_user_id === user?.id}
          opponentName={opponentName}
          onCancel={quitGame}
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
          title="Mini Golf"
          subtitle={game.mode === "solo" ? "Putt through the course — solo vs Computer" : `Putt through the course — you vs ${opponentName}`}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: oppLabel, avatarUrl: game.mode === "solo" ? null : opponentAvatar, isComputer: game.mode === "solo" }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSeated(true);
            void miniGolfSfx.prime();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              void miniGolfSfx.prime();
              return;
            }
            void (async () => {
              if (!user) return;
              try {
                const g = await createSoloGame("mini_golf", user.id, { miniGolf: initialMiniGolf(), moveNumber: 0 });
                statsWritten.current = null;
                navigate(gameRoute("mini_golf", g.id), { replace: true });
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
        title="Challenge to Mini Golf"
      />
    </div>
  );
}
