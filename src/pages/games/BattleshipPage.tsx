import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Anchor, ArrowLeft, Heart, Loader2, Radio, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameIntro from "@/components/games/GameIntro";
import { useGameRecord } from "@/components/games/GameQuickActions";
import PendingChallengeGate from "@/components/games/PendingChallengeGate";
import WaitingForOpponentGate from "@/components/games/WaitingForOpponentGate";
import GameLiveDock from "@/components/games/live/GameLiveDock";
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet, { type Person } from "@/components/games/OpponentPickerSheet";
import FleetClashStage, { FLEET_COURSES } from "@/components/games/battleship/FleetClashStage";
import { useTurnGame } from "@/hooks/use-turn-game";
import {
  bumpStats,
  createFleetClashCrewGame,
  createSoloGame,
  endGame,
  updateGameState,
} from "@/lib/games";
import { initialBattleship } from "@/lib/battleship";
import { gameRoute } from "@/lib/game-routes";
import fleetClashArtAsset from "@/assets/games/adventures/fleet-clash.png.asset.json";

const fleetClashArt = fleetClashArtAsset.url;

type FleetSnapshot = {
  level?: number;
  health?: number;
  rivalHealth?: number;
  progress?: number;
  rivalProgress?: number;
  crew?: number;
  rivalCrew?: number;
  score?: number;
  zone?: string;
};

export default function BattleshipPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    game,
    loading,
    refresh,
    me,
    players,
    opponentName,
    opponentAvatar,
  } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(false);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const saved = useRef(false);
  const lastSnapshotAt = useRef(0);

  const { stats, matchups } = useGameRecord("battleship", user?.id, finished);

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
    setFinished(false);
    setWon(false);
    setScore(0);
    // Every fresh visit begins at Level 1. Advancing inside the same campaign still
    // moves forward normally, but leaving the game never strands the next visit on Level 2+.
    setLevel(1);
    setSeated(false);
    saved.current = false;
    lastSnapshotAt.current = 0;
  }, [game?.id]);

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

  const humanPlayers = players.filter((player) => !player.is_computer && player.user_id);
  const crewMode = game.mode === "multiplayer" && Boolean(game.game_state?.fleetClashCrewMode);
  const isCaptain = game.host_user_id === user?.id;
  const crewSize = game.mode === "solo" ? 2 : Math.max(2, Math.min(4, humanPlayers.length));
  const course = FLEET_COURSES[level - 1] || FLEET_COURSES[0];
  const snapshot = (game.game_state?.fleetClashSnapshot || {}) as FleetSnapshot;

  const quitGame = () => {
    void resetAndExit();
  };

  const publishSnapshot = (next: FleetSnapshot) => {
    if (!crewMode || !isCaptain) return;
    const now = Date.now();
    if (now - lastSnapshotAt.current < 850) return;
    lastSnapshotAt.current = now;
    void (supabase as any)
      .rpc("fleet_clash_update_snapshot", {
        p_game_id: game.id,
        p_snapshot: next,
      })
      .catch(() => undefined);
  };

  const finishRun = async (didWin: boolean, finalScore: number) => {
    setFinished(true);
    setWon(didWin);
    setScore(finalScore);

    // Levels 1–4 are campaign checkpoints, not separate finished game records.
    if (!didWin || level < 5) return;
    if (!user || saved.current) return;

    saved.current = true;
    try {
      await updateGameState(game.id, {
        status: "completed",
        winner_user_id: user.id,
        is_draw: false,
        finished_at: new Date().toISOString(),
        game_state: {
          ...(game.game_state || {}),
          fleetClashLevel: 5,
          fleetClashAction: { score: finalScore, won: true, campaignComplete: true },
        },
      });
      await bumpStats(user.id, "battleship", "win", finalScore);
      await refresh();
    } catch {
      // The run itself is local/action gameplay; a stats sync failure should not break the result screen.
    }
  };

  const persistLevel = async (nextLevel: number) => {
    if (!isCaptain) return;
    try {
      await (supabase as any)
        .from("games")
        .update({
          game_state: {
            ...(game.game_state || {}),
            fleetClashLevel: nextLevel,
            fleetClashSnapshot: null,
          },
        })
        .eq("id", game.id)
        .eq("host_user_id", user?.id);
    } catch {
      // Level progression still works locally if a background sync is briefly unavailable.
    }
  };

  const resetAndExit = async () => {
    if (!game) {
      navigate("/games");
      return;
    }

    try {
      if (isCaptain) {
        await (supabase as any)
          .from("games")
          .update({
            game_state: {
              ...(game.game_state || {}),
              fleetClashLevel: 1,
              fleetClashSnapshot: null,
            },
          })
          .eq("id", game.id)
          .eq("host_user_id", user?.id);
      }
      await endGame(game.id);
    } catch {
      // Always let the player leave even if the cleanup request briefly fails.
    } finally {
      setLevel(1);
      setFinished(false);
      setSeated(false);
      navigate("/games");
    }
  };

  const chooseLevel = (nextLevel: number) => {
    const next = Math.max(1, Math.min(5, nextLevel));
    setLevel(next);
    setFinished(false);
    setScore(0);
    void persistLevel(next);
  };

  const primaryResultAction = () => {
    if (won && level < 5) {
      const next = level + 1;
      setLevel(next);
      setFinished(false);
      setScore(0);
      setSeated(true);
      void persistLevel(next);
      return;
    }

    if (!won) {
      setFinished(false);
      setScore(0);
      setSeated(true);
      return;
    }

    void startNewCampaign();
  };

  const startNewCampaign = async () => {
    if (!user) return;
    try {
      const state = { battleship: initialBattleship(), moveNumber: 0, fleetClashLevel: 1 };
      let next = null;

      if (crewMode) {
        const invitees = humanPlayers
          .map((player) => player.user_id)
          .filter((uid): uid is string => Boolean(uid && uid !== user.id));
        next = invitees.length
          ? await createFleetClashCrewGame(user.id, invitees, state)
          : await createSoloGame("battleship", user.id, state);
      } else {
        next = await createSoloGame("battleship", user.id, state);
      }

      navigate(gameRoute("battleship", next.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not start a new campaign", description: e?.message, variant: "destructive" });
    }
  };

  const challengeCrew = async (people: Person[]) => {
    if (!user || !people.length) return;
    try {
      const next = await createFleetClashCrewGame(
        user.id,
        people.map((person) => person.user_id),
        { battleship: initialBattleship(), moveNumber: 0, fleetClashLevel: 1 },
      );
      toast({
        title: people.length === 1 ? "Crew invite sent" : `${people.length} crew invites sent`,
        description: "Fleet Clash starts when everyone responds.",
      });
      setPicker(false);
      navigate(gameRoute("battleship", next.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not create the crew", description: e?.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text =
      level >= 5 && won
        ? `I cleared all 5 levels of YAJ Fleet Clash with ${score.toLocaleString()} points 🌊`
        : `I scored ${score.toLocaleString()} on Level ${level} of YAJ Fleet Clash 🌊`;
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

  const rivalLabel = "Rival Fleet";



  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        {crewMode && !isCaptain && (
          <FleetCrewView
            gameId={game.id}
            userId={user?.id}
            isLive={Boolean((game as any).is_live)}
            crewCount={crewSize}
            captainName={opponentName || "Captain"}
            snapshot={snapshot}
            waiting={game.status === "waiting"}
            onBack={() => navigate("/games")}
            onRefresh={refresh}
          />
        )}

        {seated && isCaptain && (
          <FleetClashStage
            key={`${game.id}-level-${level}-crew-${crewSize}`}
            opponentName={rivalLabel}
            level={level}
            crewSize={crewSize}
            muted={muted}
            onToggleMute={() => setMuted((value) => !value)}
            onStatus={() => {}}
            onSnapshot={publishSnapshot}
            onFinish={(didWin, finalScore) => void finishRun(didWin, finalScore)}
            onBack={() => navigate("/games")}
            onQuit={quitGame}
            liveDock={
              <GameLiveDock
                gameId={game.id}
                userId={user?.id}
                isPlayer={!!me}
                isLive={Boolean((game as any).is_live)}
                hasHumanOpponent={humanPlayers.length > 1}
                placement="rail"
                onChanged={refresh}
              />
            }
          />
        )}

        <PendingChallengeGate
          gameId={game.id}
          userId={user?.id}
          waiting={game.host_user_id !== user?.id && game.status !== "cancelled" && game.status !== "completed"}
          challengerName={opponentName}
          onAccepted={refresh}
        />

        <WaitingForOpponentGate
          show={crewMode && game.status === "waiting" && isCaptain}
          opponentName={humanPlayers.length > 2 ? "your crew" : opponentName}
          onCancel={quitGame}
        />

        {(!crewMode || isCaptain) && (
          <GameIntro
            showCharacterCustomize
            open={!seated && !finished && game.status !== "waiting"}
            title="YAJ Fleet Clash"
            subtitle={
              game.mode === "solo"
                ? `5-level river campaign · Level ${level}: ${course.name}`
                : `${crewSize}-player crew · Captain + crew vs the Rival Fleet`
            }
            artUrl={fleetClashArt}
            me={{ name: myName, avatarUrl: myAvatar }}
            them={{
              name: game.mode === "solo" ? "Computer" : `${crewSize}-player crew`,
              avatarUrl: game.mode === "solo" ? null : opponentAvatar,
              isComputer: game.mode === "solo",
            }}
            stats={stats}
            matchups={matchups}
            extraContent={
              <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/45 p-3 backdrop-blur-md">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Choose Level</p>
                    <p className="mt-0.5 text-xs font-bold text-white">{course.name}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-cyan-200">
                    {course.condition}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {FLEET_COURSES.map((item) => (
                    <button
                      key={item.level}
                      type="button"
                      onClick={() => chooseLevel(item.level)}
                      aria-label={`Choose Level ${item.level}: ${item.name}`}
                      className={`min-h-11 rounded-xl border text-sm font-black transition active:scale-95 ${
                        level === item.level
                          ? "border-cyan-300 bg-cyan-300 text-slate-950"
                          : "border-white/15 bg-white/5 text-white"
                      }`}
                    >
                      {item.level}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-[10px] font-bold text-white/50">
                  Pick any course before you start.
                </p>
              </div>
            }
            onStart={() => setSeated(true)}
            onBack={() => void resetAndExit()}
            onPlaySolo={() => {
              if (game.mode === "solo" && game.status === "active") {
                setSeated(true);
                return;
              }
              void (async () => {
                try {
                  const next = await createSoloGame("battleship", user!.id, {
                    battleship: initialBattleship(),
                    moveNumber: 0,
                    fleetClashLevel: 1,
                  });
                  navigate(gameRoute("battleship", next.id), { replace: true });
                } catch (e: any) {
                  toast({ title: "Could not start a solo game", description: e?.message, variant: "destructive" });
                }
              })();
            }}
            onQuickMatch={() => setPicker(true)}
          />
        )}
      </div>

      {isCaptain && (
        <GameResultCard
          open={finished}
          outcome={won ? "win" : "loss"}
          title={
            won
              ? level < 5
                ? `${course.name} Cleared!`
                : "Fleet Champion!"
              : `${course.name} Defeated You`
          }
          detail={
            won
              ? level < 5
                ? `Level ${level} complete with ${score.toLocaleString()} points. Next: ${FLEET_COURSES[level]?.name}.`
                : `You conquered all five Fleet Clash courses with ${score.toLocaleString()} points.`
              : `You scored ${score.toLocaleString()} points. Retry Level ${level} and take the river back.`
          }
          primaryLabel={won ? (level < 5 ? "Next Level" : "New Campaign") : "Retry Level"}
          onRematch={primaryResultAction}
          onChallenge={() => setPicker(true)}
          onShare={shareResult}
          onExit={() => void resetAndExit()}
          exitLabel="Exit to Games"
        />
      )}

      <OpponentPickerSheet
        open={picker}
        onClose={() => setPicker(false)}
        onPick={() => {}}
        multiSelect
        maxSelections={3}
        onConfirmMultiple={(people) => void challengeCrew(people)}
        title="Build Your Fleet Clash Crew"
      />
    </div>
  );
}

function FleetCrewView({
  gameId,
  userId,
  isLive,
  crewCount,
  captainName,
  snapshot,
  waiting,
  onBack,
  onRefresh,
}: {
  gameId: string;
  userId: string | undefined;
  isLive: boolean;
  crewCount: number;
  captainName: string;
  snapshot: FleetSnapshot;
  waiting: boolean;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const level = Math.max(1, Math.min(5, Number(snapshot.level || 1)));
  const course = FLEET_COURSES[level - 1] || FLEET_COURSES[0];
  const progress = Math.round(Number(snapshot.progress || 0) * 100);
  const rivalProgress = Math.round(Number(snapshot.rivalProgress || 0) * 100);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[radial-gradient(circle_at_top,#16456b,#07111f_60%)] text-white">
      <div className="absolute inset-0 opacity-25">
        <img src={fleetClashArt} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 flex h-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="rounded-full bg-cyan-400/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
            Crew View
          </div>
          <GameLiveDock
            gameId={gameId}
            userId={userId}
            isPlayer
            isLive={isLive}
            hasHumanOpponent
            placement="rail"
            onChanged={onRefresh}
          />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="rounded-[28px] border border-white/15 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15">
                <Anchor className="h-6 w-6 text-cyan-200" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">YAJ Fleet Clash</p>
                <h1 className="mt-1 text-xl font-black">You're on {captainName}'s crew</h1>
                {waiting ? (
                  <p className="mt-1 text-[10px] font-bold text-amber-200">Waiting for the remaining crew invites to be answered…</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/8 p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-white/50">Course</p>
                <p className="mt-1 text-sm font-black">Level {level}/5</p>
                <p className="mt-0.5 text-xs text-cyan-200">{course.name}</p>
              </div>
              <div className="rounded-2xl bg-white/8 p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-white/50">Boat Crew</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-black"><Users className="h-4 w-4" /> {crewCount}/4</p>
                <p className="mt-0.5 text-xs text-white/55">Captain controls the boat</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-200">Your boat</p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-bold">
                    <Heart className="h-3.5 w-3.5 fill-red-400 text-red-400" /> {Math.max(0, Number(snapshot.health ?? 3))} hull
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-wider text-orange-200">Rival Fleet</p>
                  <p className="mt-1 text-xs font-bold">{snapshot.zone || course.condition}</p>
                </div>
              </div>

              <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${progress}%` }} />
                <div className="absolute inset-y-0 w-1 bg-orange-300" style={{ left: `${rivalProgress}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-black">
                <span>{waiting ? "Ready" : `${progress}%`}</span>
                <span>{waiting ? "Crew lobby" : `${rivalProgress}% rival`}</span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
              <Radio className="mx-auto h-5 w-5 text-cyan-200" />
              <p className="mt-2 text-xs font-black">Stay with the captain</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/55">
                Use the Live button above for crew voice/chat while the captain drives, fires and advances through the five courses.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
