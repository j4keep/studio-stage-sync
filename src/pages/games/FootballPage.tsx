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
import FootballField from "@/components/games/football/FootballField";
import { footballSfx } from "@/lib/football-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import { FootballState, MAX_PLAYS, PlayType, Seat, computerPlay, initialFootball, resolvePlay } from "@/lib/football";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const SEAT_ACCENTS = ["hsl(204 100% 55%)", "#f59e0b"];

export default function FootballPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);
  const footballRef = useRef<FootballState>(initialFootball());

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(footballSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  const football: FootballState = (game?.game_state?.football as FootballState) || initialFootball();
  footballRef.current = football;
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = football.phase === "over";
  const myTurn = game?.status === "active" && !finished && football.possession === mySeat;

  const { stats, matchups } = useGameRecord("football", user?.id, finished);

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
    const draw = football.winnerSeat === null;
    const iWon = football.winnerSeat === mySeat;
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

  const commit = async (state: FootballState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { football: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { football: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const applyPlay = async (play: PlayType) => {
    if (!game || !user || !myTurn) return;
    const next = resolvePlay(football, mySeat, play);
    const n = moveNumber + 1;
    await recordMove(game.id, user.id, n, { play, seat: mySeat });
    const nextTurnUserId = game.mode === "solo" ? user.id : next.possession === mySeat ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  // Drive the computer's play-calling in solo mode.
  useEffect(() => {
    if (!game || game.mode !== "solo" || finished) return;
    if (football.possession !== oppSeat) return;
    const t = window.setTimeout(() => {
      if (!user) return;
      const state = footballRef.current;
      const play = computerPlay(state);
      const next = resolvePlay(state, oppSeat, play);
      void commit(next, moveNumber + 1, user.id);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [game?.id, football.possession, finished, moveNumber]);

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { football: initialFootball(), moveNumber: 0 };
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
      const g = await createMultiplayerGame("football", user.id, opponentId, { football: initialFootball(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("football", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = football.winnerSeat === null;
    const iWon = football.winnerSeat === mySeat;
    const text = `I just ${draw ? "drew" : iWon ? "won" : "lost"} a football game on YAJ 🏈`;
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
  const draw = finished && football.winnerSeat === null;
  const iWon = finished && football.winnerSeat === mySeat;
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : iWon ? "win" : "loss";

  const statusLabel =
    game.status === "waiting"
      ? "Waiting"
      : game.status === "cancelled"
        ? "Declined"
        : finished
          ? draw
            ? "Draw"
            : iWon
              ? "You won"
              : "You lost"
          : myTurn
            ? "Your ball"
            : `${oppLabel} has the ball`;

  const resultTitle = draw ? "Ends in a tie" : iWon ? "You win!" : `${oppLabel} wins`;
  const resultDetail = finished ? `Final score — you ${football.scores[mySeat]} · ${oppLabel} ${football.scores[oppSeat]}` : undefined;

  const myBall = football.possession === mySeat;
  const ballOnFromMyGoal = myBall ? football.ballOn : 100 - football.ballOn;
  const lastPlayView = football.lastPlay
    ? { play: football.lastPlay.play, kind: football.lastPlay.kind, yards: football.lastPlay.yards, message: football.lastPlay.message, mine: football.lastPlay.seat === mySeat }
    : null;

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        <FootballField
          myName={myName}
          oppName={oppLabel}
          isComputer={game.mode === "solo"}
          myAccent={SEAT_ACCENTS[mySeat]}
          oppAccent={SEAT_ACCENTS[oppSeat]}
          myScore={football.scores[mySeat]}
          oppScore={football.scores[oppSeat]}
          myBall={myBall}
          down={football.down}
          yardsToGo={football.yardsToGo}
          ballOnFromMyGoal={ballOnFromMyGoal}
          lastPlay={lastPlayView}
          interactive={Boolean(myTurn) && seated}
          finished={finished}
          winnerIsMe={finished ? iWon : null}
          statusLabel={statusLabel}
          playNumber={football.play}
          maxPlays={MAX_PLAYS}
          muted={muted}
          onToggleMute={() => {
            const next = !muted;
            setMuted(next);
            footballSfx.setMuted(next);
          }}
          onBack={() => navigate("/games")}
          onPlay={(play) => void applyPlay(play)}
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
          placement="rail"
          onChanged={refresh}
        />

        <GameIntro
          open={!seated && !finished}
          title="Football"
          subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
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
                const g = await createSoloGame("football", user.id, { football: initialFootball(), moveNumber: 0 });
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
