import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGameRecord } from "@/components/games/GameQuickActions";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import SugarRushBoard, { SugarRushOutcome, sugarRushBg } from "@/components/games/sugar-rush/SugarRushBoard";
import SugarRushIntro from "@/components/games/sugar-rush/SugarRushIntro";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import { RoundResult, Seat, SugarRushState, applyRoundResult, initialSugarRush } from "@/lib/sugar-rush-run";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const HOW_TO_PLAY = [
  "Drag a candy into a neighbor to swap them — or tap one candy, then tap the one next to it.",
  "Line up 3+ of the same candy in a row or column to clear them.",
  "Match 4 in a line for a striped candy (clears a row/column). Match 5 for a color bomb (clears every candy of that color).",
  "60 seconds per round, 2 rounds each, alternating with your opponent — highest total score wins.",
];

export default function SugarRushPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(sugarRushSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  const run: SugarRushState = (game?.game_state?.sugarRush as SugarRushState) || initialSugarRush();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = run.phase === "over";
  const myTurn = game?.status === "active" && !finished && run.possession === mySeat;
  const computersTurn = game?.mode === "solo" && !finished && run.possession === oppSeat;

  const { stats, matchups } = useGameRecord("sugar_rush", user?.id, finished);

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
    if (iWon) sugarRushSfx.win();
    const outcome = draw ? "draw" : iWon ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "sugar_rush", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: SugarRushState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { sugarRush: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { sugarRush: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const finishRound = async (seat: Seat, outcome: SugarRushOutcome) => {
    if (!game || !user) return;
    const result: RoundResult = { score: outcome.score, bestCascade: outcome.bestCascade, candiesCleared: outcome.candiesCleared };
    const next = applyRoundResult(run, seat, result);
    const n = moveNumber + 1;
    await recordMove(game.id, seat === mySeat ? user.id : null, n, { result, seat });
    const nextTurnUserId = game.mode === "solo" ? user.id : next.possession === mySeat ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { sugarRush: initialSugarRush(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("sugar_rush", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("sugar_rush", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("sugar_rush", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("sugar_rush", user.id, opponentId, { sugarRush: initialSugarRush(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("sugar_rush", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = run.winnerSeat === null;
    const iWon = run.winnerSeat === mySeat;
    const text = `I just ${draw ? "tied" : iWon ? "won" : "lost"} a game of YAJ Sugar Rush 🍬`;
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
    ? `Final score — you ${run.scores[mySeat].toLocaleString()} · ${oppLabel} ${run.scores[oppSeat].toLocaleString()}`
    : undefined;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sugarRushSfx.setMuted(next);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        {seated && !finished && (myTurn || computersTurn) && (
          <SugarRushBoard
            key={`${run.possession}-${run.roundNumber}`}
            mode={{ kind: "timed", gridSize: 8, seconds: 60 }}
            active
            auto={!myTurn}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            howToPlay={HOW_TO_PLAY}
            headerLeft={roundLabel}
            scoreLine={`You ${run.scores[mySeat]} · ${oppLabel} ${run.scores[oppSeat]}`}
            onComplete={(o) => void finishRound(run.possession, o)}
          />
        )}

        {seated && !finished && !myTurn && !computersTurn && (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-cover bg-center text-white"
            style={{ backgroundImage: `linear-gradient(180deg, rgba(30,10,50,.25), rgba(20,8,40,.55)), url(${sugarRushBg})` }}
          >
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm font-bold">Waiting on {oppLabel}'s round…</p>
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

        {!seated && !finished && (
          <SugarRushIntro
            opponentLabel={oppLabel}
            isComputer={game.mode === "solo"}
            bestScore={stats?.highScore}
            onBack={() => navigate("/games")}
            onPlaySolo={() => {
              if (game.status === "active") {
                setSeated(true);
                return;
              }
              void (async () => {
                if (!user) return;
                try {
                  const g = await createSoloGame("sugar_rush", user.id, { sugarRush: initialSugarRush(), moveNumber: 0 });
                  statsWritten.current = null;
                  navigate(gameRoute("sugar_rush", g.id), { replace: true });
                } catch (e: any) {
                  toast({ title: "Could not start a solo game", description: e.message, variant: "destructive" });
                }
              })();
            }}
            onQuickMatch={() => setPicker(true)}
            onPlayLevels={() => navigate("/games/sugar-rush-levels")}
          />
        )}
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
        title="Challenge to YAJ Sugar Rush"
      />
    </div>
  );
}
