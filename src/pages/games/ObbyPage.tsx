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
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import ObbyStage from "@/components/games/obby/ObbyStage";
import { useObbyLive } from "@/hooks/use-obby-live";
import { useTurnGame } from "@/hooks/use-turn-game";
import { ObbyState, formatMs, initialObby } from "@/lib/obby";
import { obbySfx } from "@/lib/obby-sfx";
import { bumpStats, createMultiplayerGame, createSoloGame, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";
import obbyArt from "@/assets/games/yaj-obby-intro.png";

const HOW_TO_PLAY = [
  "One stick does everything: drag it to run, and flick it up hard to jump — on a laptop use WASD and Space.",
  "Hop platform to platform down the floating course. Fall off and you respawn at the last blue checkpoint.",
  "Orange lava blocks reset you instantly, so pick your line on the narrow beams.",
  "Some platforms slide side to side or up and down — time your jump and ride them.",
  "First racer to touch the gold finish pad wins. You can see your opponent running live beside you.",
];

const MY_COLOR = "#2f7bff";
const OPP_COLOR = "#ff8a3d";

export default function ObbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(obbySfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const obby: ObbyState = (game?.game_state?.obby as ObbyState) || initialObby();
  const mySeat: 0 | 1 = ((me?.seat ?? 1) === 1 ? 0 : 1) as 0 | 1;
  const oppSeat: 0 | 1 = mySeat === 0 ? 1 : 0;
  const finished = obby.phase === "over";
  const isMultiplayer = game?.mode === "multiplayer";

  const { stats, matchups } = useGameRecord("obby", user?.id, finished);
  const { ghosts, sample, announceFinish, oppFinishMs } = useObbyLive({
    gameId: game?.id,
    userId: user?.id,
    name: myName,
    color: mySeat === 0 ? MY_COLOR : OPP_COLOR,
    enabled: Boolean(seated && isMultiplayer && game?.status === "active"),
  });

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

  const commitResult = async (winnerSeat: 0 | 1, ms: number) => {
    if (!game || !user) return;
    const times: [number | null, number | null] = [...obby.times] as [number | null, number | null];
    times[winnerSeat] = ms;
    const next: ObbyState = { winnerSeat, times, phase: "over" };
    setGame({ ...game, game_state: { ...(game.game_state || {}), obby: next } });
    await updateGameState(game.id, {
      game_state: { ...(game.game_state || {}), obby: next },
      status: "completed",
      is_draw: false,
      winner_user_id: winnerSeat === mySeat ? user.id : (opponent?.user_id ?? null),
      finished_at: new Date().toISOString(),
    });
    await refresh();
  };

  const onFinish = (ms: number) => {
    if (finished || !user) return;
    obbySfx.win();
    announceFinish(ms);
    void (async () => {
      await commitResult(mySeat, ms);
      if (statsWritten.current !== game?.id) {
        statsWritten.current = game?.id ?? null;
        await bumpStats(user.id, "obby", "win", Math.max(0, 200000 - ms));
      }
    })();
  };

  // Opponent crossed the line first.
  useEffect(() => {
    if (oppFinishMs === null || finished || !user) return;
    void (async () => {
      await commitResult(oppSeat, oppFinishMs);
      if (statsWritten.current !== game?.id) {
        statsWritten.current = game?.id ?? null;
        await bumpStats(user.id, "obby", "loss");
      }
    })();
  }, [oppFinishMs]);

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { obby: initialObby(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("obby", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("obby", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        setStartedAt(null);
        navigate(gameRoute("obby", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("obby", user.id, opponentId, { obby: initialObby(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("obby", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const iWon = obby.winnerSeat === mySeat;
    const t = obby.times[obby.winnerSeat ?? 0];
    const text = `I just ${iWon ? "won" : "lost"} a YAJ Obby race${t ? ` — ${formatMs(t)}` : ""} 🧱`;
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

  const oppLabel = game.mode === "solo" ? "Time trial" : opponentName;
  const iWon = obby.winnerSeat === mySeat;
  const winTime = obby.times[obby.winnerSeat ?? 0];

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    obbySfx.setMuted(next);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        {seated && (
          <ObbyStage
            myColor={mySeat === 0 ? MY_COLOR : OPP_COLOR}
            ghosts={ghosts}
            onSample={isMultiplayer ? sample : undefined}
            onFinish={onFinish}
            onBack={() => navigate("/games")}
            raceStartedAt={startedAt}
            headline={game.mode === "solo" ? "YAJ Obby — time trial" : `YAJ Obby — you vs ${opponentName}`}
            subline={
              finished
                ? iWon
                  ? "You reached the finish first"
                  : `${oppLabel} reached the finish first`
                : "Hop the floating course to the gold pad"
            }
            howToPlay={HOW_TO_PLAY}
            muted={muted}
            onToggleMute={toggleMute}
            frozen={finished}
            liveDock={
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
          open={!seated && !finished}
          title="YAJ Obby"
          subtitle={game.mode === "solo" ? "Beat the course — solo time trial" : `Race the course — you vs ${opponentName}`}
          artUrl={obbyArt}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: oppLabel, avatarUrl: game.mode === "solo" ? null : opponentAvatar, isComputer: game.mode === "solo" }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSeated(true);
            setStartedAt(Date.now());
            void obbySfx.prime();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              setStartedAt(Date.now());
              void obbySfx.prime();
              return;
            }
            void (async () => {
              if (!user) return;
              try {
                const g = await createSoloGame("obby", user.id, { obby: initialObby(), moveNumber: 0 });
                statsWritten.current = null;
                navigate(gameRoute("obby", g.id), { replace: true });
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
        outcome={iWon ? "win" : "loss"}
        title={iWon ? "You win the race!" : `${oppLabel} wins the race`}
        detail={winTime ? `Winning time — ${formatMs(winTime)}` : undefined}
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
        title="Challenge to YAJ Obby"
      />
    </div>
  );
}
