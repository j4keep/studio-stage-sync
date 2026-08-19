import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DominoTable from "@/components/games/pro/DominoTable";
import DominoIntro from "@/components/games/pro/DominoIntro";
import LandscapeStage from "@/components/games/pro/LandscapeStage";
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import { useTurnGame } from "@/hooks/use-turn-game";
import { casinoMusic } from "@/lib/casino-music";
import {
  DomState,
  dominoesComputerTurn,
  dominoesResult,
  drawOrPass,
  ends,
  initialDominoes,
  pipTotal,
  playTile,
  playableTiles,
} from "@/lib/dominoes";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import { useGameRecord } from "@/components/games/GameQuickActions";

const HOW_TO_PLAY = [
  "Drag a glowing tile from your hand onto a glowing open end of the chain.",
  "A tile only fits an end that matches one of its halves.",
  "No playable tile? Draw from the boneyard, or pass when it is empty.",
  "First player out of tiles wins. If the board blocks, the lowest pip total wins.",
];

export default function DominoesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(
    id,
    user?.id,
  );
  const written = useRef<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [seated, setSeated] = useState(false);
  const [muted, setMuted] = useState(casinoMusic.muted);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState("You");
  const { stats, matchups } = useGameRecord("dominoes", user?.id, game?.status);

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

  useEffect(() => () => casinoMusic.stop(), []);

  const dom: DomState = (game?.game_state?.dom as DomState) || initialDominoes();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: 0 | 1 = ((me?.seat ?? 1) === 1 ? 0 : 1) as 0 | 1;
  const oppSeat: 0 | 1 = mySeat === 0 ? 1 : 0;
  const result = dominoesResult(dom);
  const finished = result !== null;
  const myTurn = game?.status === "active" && game.current_turn_user_id === user?.id && !finished;
  const myHand = dom.hands[mySeat] || [];
  const playable = playableTiles(dom, mySeat);
  const e = ends(dom);

  useEffect(() => {
    if (!game || !user || !finished || written.current === game.id) return;
    written.current = game.id;
    if (result === mySeat) casinoMusic.fanfare();
    if (game.status === "completed") return;
    const draw = result === "draw";
    const iWon = result === mySeat;
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "dominoes", draw ? "draw" : iWon ? "win" : "loss");
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const advance = async (state: DomState, moves: number) => {
    if (!game || !user) return;
    let next = state;
    let n = moveNumber + moves;
    let nextTurn = opponent?.user_id ?? null;

    if (game.mode === "solo") {
      let guard = 0;
      while (dominoesResult(next) === null && next.turn === oppSeat && guard < 30) {
        next = dominoesComputerTurn(next);
        n += 1;
        guard += 1;
      }
      nextTurn = user.id;
    }

    setGame({ ...game, game_state: { dom: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await updateGameState(game.id, { game_state: { dom: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await refresh();
  };

  const play = async (handIndex: number, side: "left" | "right") => {
    if (!game || !user || !myTurn) return;
    casinoMusic.clack();
    const next = playTile(dom, mySeat, handIndex, side);
    await recordMove(game.id, user.id, moveNumber + 1, { tile: dom.hands[mySeat][handIndex], side });
    await advance(next, 1);
  };

  const draw = async () => {
    if (!game || !user || !myTurn) return;
    const next = drawOrPass(dom, mySeat);
    await recordMove(game.id, user.id, moveNumber + 1, { action: dom.pile.length ? "draw" : "pass" });
    await advance(next, 1);
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { dom: initialDominoes(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("dominoes", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("dominoes", user.id, opponent.user_id, state)
            : null;
      if (g) {
        written.current = null;
        navigate(gameRoute("dominoes", g.id), { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Could not start a rematch", description: err.message, variant: "destructive" });
    }
  };

  const challenge = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("dominoes", user.id, opponentId, {
        dom: initialDominoes(),
        moveNumber: 0,
      });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("dominoes", g.id), { replace: true });
    } catch (err: any) {
      toast({ title: "Could not send the challenge", description: err.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = `I just ${result === "draw" ? "tied" : result === mySeat ? "won" : "lost"} a game of Dominoes on YAJ 🁫`;
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
    casinoMusic.setMuted(next);
    if (!next) void casinoMusic.start();
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
          ? result === "draw"
            ? "Draw"
            : result === mySeat
              ? "You won"
              : "You lost"
          : myTurn
            ? "Your turn"
            : `${oppLabel}'s turn`;

  const outcome: "win" | "loss" | "draw" = result === "draw" ? "draw" : result === mySeat ? "win" : "loss";
  const resultTitle =
    outcome === "draw" ? "It's a draw" : outcome === "win" ? "You won!" : `${oppLabel} won`;
  const resultDetail = finished
    ? `Final pips — you ${pipTotal(dom.hands[mySeat] || [])} · ${oppLabel} ${pipTotal(dom.hands[oppSeat] || [])}`
    : undefined;

  return (
    <LandscapeStage>
      <div className="relative h-full w-full">
        <DominoTable
          layout={dom.layout}
          ends={e}
          pileCount={dom.pile.length}
          myHand={myHand}
          playable={playable}
          myTurn={!!myTurn}
          myName={myName}
          myAvatar={myAvatar}
          oppName={oppLabel}
          oppAvatar={game.mode === "solo" ? null : opponentAvatar}
          oppCount={dom.hands[oppSeat]?.length ?? 0}
          isComputer={game.mode === "solo"}
          turnLabel={turnLabel}
          finished={finished}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => navigate("/games")}
          onPlay={(i, side) => void play(i, side)}
          onDraw={() => void draw()}
          howToPlay={HOW_TO_PLAY}
        />

        <DominoIntro
          open={!seated && !finished}
          subtitle={game.mode === "solo" ? "Solo table vs the house computer" : `You vs ${opponentName}`}
          muted={muted}
          onToggleMute={toggleMute}
          onStart={() => {
            setSeated(true);
            if (!muted) void casinoMusic.start();
          }}
          onBack={() => navigate("/games")}
          stats={stats}
          matchups={matchups}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              if (!muted) void casinoMusic.start();
              return;
            }
            void (async () => {
              if (!user) return;
              try {
                const g = await createSoloGame("dominoes", user.id, { dom: initialDominoes(), moveNumber: 0 });
                written.current = null;
                navigate(gameRoute("dominoes", g.id), { replace: true });
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
        title="Challenge to Dominoes"
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
        onChanged={refresh}
      />

    </LandscapeStage>
  );
}
