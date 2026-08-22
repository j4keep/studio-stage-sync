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
import PokerTable from "@/components/games/poker/PokerTable";
import { pokerSfx } from "@/lib/poker-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import { PokerAction, PokerState, Seat, applyAction, computerAction, initialPoker, legalActions, nextHand } from "@/lib/poker";
import { bumpStats, createMultiplayerGame, createSoloGame, endGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const HOW_TO_PLAY = [
  "Heads-up Texas Hold'em — best hand over 12 rounds, or bust your opponent first.",
  "Check, call, raise, or fold on your turn. The button posts the small blind and acts first preflop.",
  "Community cards deal on the flop, turn, and river. Best 5-card hand wins the pot at showdown.",
  "Going all-in commits your whole stack — the hand runs out to showdown once both sides are in.",
];

export default function PokerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);
  const actingRef = useRef(false);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(pokerSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  const poker: PokerState = (game?.game_state?.poker as PokerState) || initialPoker();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const matchOver = poker.phase === "over";
  const handOver = poker.street === "showdown" && poker.phase === "active";
  const myTurn = game?.status === "active" && !matchOver && !handOver && poker.turnSeat === mySeat;
  const computersTurn = game?.mode === "solo" && !matchOver && !handOver && poker.turnSeat === oppSeat;

  const { stats, matchups } = useGameRecord("poker", user?.id, matchOver);

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
    if (!game || !user || !matchOver || statsWritten.current === game.id) return;
    if (game.status === "completed") {
      statsWritten.current = game.id;
      return;
    }
    statsWritten.current = game.id;
    const draw = poker.winnerSeat === null;
    const iWon = poker.winnerSeat === mySeat;
    if (iWon) pokerSfx.win();
    else if (!draw) pokerSfx.lose();
    const outcome = draw ? "draw" : iWon ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "poker", outcome);
      await refresh();
    })();
  }, [matchOver, game?.id, game?.status]);

  // Sound cues on state transitions.
  const lastSeenAction = useRef<string | null>(null);
  useEffect(() => {
    if (!poker.lastAction) return;
    const key = `${poker.handNumber}-${poker.street}-${poker.lastAction.seat}-${poker.lastAction.action}-${poker.lastAction.amount}`;
    if (lastSeenAction.current === key) return;
    lastSeenAction.current = key;
    if (poker.lastAction.action === "fold") pokerSfx.fold();
    else if (poker.lastAction.action === "check") pokerSfx.check();
    else if (poker.lastAction.action === "all_in") pokerSfx.allIn();
    else pokerSfx.chipBet(poker.lastAction.amount > 60);
  }, [poker.lastAction, poker.handNumber, poker.street]);

  const lastSeenStreet = useRef<string | null>(null);
  useEffect(() => {
    const key = `${poker.handNumber}-${poker.street}-${poker.community.length}`;
    if (lastSeenStreet.current === key) return;
    const isNewDeal = lastSeenStreet.current === null || !lastSeenStreet.current.startsWith(`${poker.handNumber}-`);
    lastSeenStreet.current = key;
    if (isNewDeal) pokerSfx.dealBurst(4);
    else if (poker.community.length > 0) pokerSfx.dealBurst(poker.community.length <= 3 ? 3 : 1);
  }, [poker.handNumber, poker.street, poker.community.length]);

  const commit = async (state: PokerState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    setGame({ ...game, game_state: { poker: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: { poker: state, moveNumber: n }, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const act = async (seat: Seat, action: PokerAction, amount = 0) => {
    if (!game || !user || actingRef.current) return;
    actingRef.current = true;
    try {
      const base: PokerState = (game.game_state?.poker as PokerState) || poker;
      const next = applyAction(base, seat, action, amount, Math.random);
      const n = moveNumber + 1;
      await recordMove(game.id, seat === mySeat ? user.id : null, n, { action, amount, seat });
      const nextTurnUserId =
        game.mode === "solo" ? user.id : next.turnSeat === mySeat ? user.id : (opponent?.user_id ?? null);
      await commit(next, n, nextTurnUserId);
    } finally {
      actingRef.current = false;
    }
  };

  const dealNext = async () => {
    if (!game || !user || actingRef.current) return;
    actingRef.current = true;
    try {
      const base: PokerState = (game.game_state?.poker as PokerState) || poker;
      const next = nextHand(base, Math.random);
      const n = moveNumber + 1;
      const nextTurnUserId =
        game.mode === "solo" ? user.id : next.turnSeat === mySeat ? user.id : (opponent?.user_id ?? null);
      await commit(next, n, nextTurnUserId);
    } finally {
      actingRef.current = false;
    }
  };

  // Drive the computer's turn in solo mode.
  useEffect(() => {
    if (!game || game.mode !== "solo" || matchOver || handOver) return;
    if (poker.turnSeat !== oppSeat) return;
    const t = window.setTimeout(() => {
      const { action, amount } = computerAction(poker, oppSeat, Math.random);
      void act(oppSeat, action, amount ?? 0);
    }, 900);
    return () => window.clearTimeout(t);
  }, [game?.id, poker.turnSeat, poker.handNumber, poker.street, matchOver, handOver, moveNumber]);

  // Solo mode auto-deals the next hand after a short beat so the player isn't blocked on a tap.
  useEffect(() => {
    if (!game || game.mode !== "solo" || matchOver || !handOver) return;
    const t = window.setTimeout(() => void dealNext(), 2200);
    return () => window.clearTimeout(t);
  }, [game?.id, handOver, matchOver, poker.handNumber]);

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { poker: initialPoker(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("poker", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("poker", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("poker", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("poker", user.id, opponentId, { poker: initialPoker(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("poker", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = poker.winnerSeat === null;
    const iWon = poker.winnerSeat === mySeat;
    const text = `I just ${draw ? "tied" : iWon ? "won" : "lost"} a heads-up poker match on YAJ ♠️`;
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
    pokerSfx.setMuted(next);
  };

  const quitGame = () => {
    if (!game) return;
    void (async () => {
      await endGame(game.id);
      navigate("/games");
    })();
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
  const draw = matchOver && poker.winnerSeat === null;
  const iWon = matchOver && poker.winnerSeat === mySeat;
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : iWon ? "win" : "loss";
  const resultTitle = draw ? "Match tied" : iWon ? "You win!" : `${oppLabel} wins`;
  const resultDetail = matchOver ? `Final stacks — you $${poker.stacks[mySeat]} · ${oppLabel} $${poker.stacks[oppSeat]}` : undefined;

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        {seated && (
          <PokerTable
            state={poker}
            mySeat={mySeat}
            myTurn={Boolean(myTurn)}
            matchOver={matchOver}
            myName={myName}
            myAvatar={myAvatar}
            oppName={oppLabel}
            oppAvatar={game.mode === "solo" ? null : opponentAvatar}
            isComputer={game.mode === "solo"}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onQuit={quitGame}
            howToPlay={HOW_TO_PLAY}
            onAction={(action, amount) => void act(mySeat, action, amount ?? 0)}
            onNextHand={() => void dealNext()}
            sideDock={
              <GameLiveDock
                gameId={game.id}
                userId={user?.id}
                isPlayer={!!me}
                isLive={Boolean((game as any).is_live)}
                hasHumanOpponent={game.mode === "multiplayer" && !!opponent?.user_id}
                placement="rail"
                onChanged={refresh}
              />
            }
          />
        )}

        <PendingChallengeGate
          gameId={game.id}
          userId={user?.id}
          waiting={game.status === "waiting" && game.host_user_id !== user?.id}
          challengerName={opponentName}
          onAccepted={refresh}
        />

        <GameIntro
          open={!seated && !matchOver}
          title="Texas Hold'em"
          subtitle={game.mode === "solo" ? "Heads-up — solo vs Computer" : `Heads-up — you vs ${opponentName}`}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: oppLabel, avatarUrl: game.mode === "solo" ? null : opponentAvatar, isComputer: game.mode === "solo" }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSeated(true);
            void pokerSfx.prime();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              void pokerSfx.prime();
              return;
            }
            void (async () => {
              if (!user) return;
              try {
                const g = await createSoloGame("poker", user.id, { poker: initialPoker(), moveNumber: 0 });
                statsWritten.current = null;
                navigate(gameRoute("poker", g.id), { replace: true });
              } catch (e: any) {
                toast({ title: "Could not start a solo match", description: e.message, variant: "destructive" });
              }
            })();
          }}
          onQuickMatch={() => setPicker(true)}
        />
      </div>

      <GameResultCard
        open={matchOver}
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
        title="Challenge to Poker"
      />
    </LandscapeStage>
  );
}
