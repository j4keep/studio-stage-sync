import { useEffect, useMemo, useRef, useState } from "react";
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
import LandscapeStage from "@/components/games/pro/LandscapeStage";
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet, { type Person } from "@/components/games/OpponentPickerSheet";
import DrivingRace, {
  DRIVE_CARS,
  DRIVE_COURSES,
  type DriveCarId,
} from "@/components/games/driving/DrivingRace";
import { drivingSfx } from "@/lib/driving-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import {
  bumpStats,
  createDriveRaceGame,
  createSoloGame,
  endGame,
} from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

type RacerProfile = { userId: string; name: string; avatarUrl: string | null };

export default function DrivingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading, refresh, me, players } = useTurnGame(id, user?.id);
  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(drivingSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, RacerProfile>>({});
  const [course, setCourse] = useState(1);
  const [carId, setCarId] = useState<DriveCarId>("gt");
  const [finished, setFinished] = useState(false);
  const [place, setPlace] = useState(1);
  const statsWritten = useRef(false);

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
    if (!game) return;
    setCourse(Math.max(1, Math.min(5, Number(game.game_state?.driveCourse || 1))));
    const selected = game.game_state?.driveCars?.[user?.id || ""] as DriveCarId | undefined;
    if (selected && DRIVE_CARS.some((car) => car.id === selected)) setCarId(selected);
    setFinished(false);
    setPlace(1);
    setSeated(false);
    statsWritten.current = false;
  }, [game?.id, user?.id]);

  useEffect(() => {
    const ids = players.map((p) => p.user_id).filter(Boolean) as string[];
    if (!ids.length) return;
    void (supabase as any)
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", ids)
      .then(({ data }: any) => {
        const map: Record<string, RacerProfile> = {};
        for (const row of data || []) {
          map[row.user_id] = {
            userId: row.user_id,
            name: row.display_name || "YAJ Racer",
            avatarUrl: row.avatar_url || null,
          };
        }
        setProfiles(map);
      });
  }, [players.map((p) => p.user_id).join("|")]);

  const humanPlayers = useMemo(
    () => players.filter((p) => !p.is_computer && p.user_id),
    [players],
  );
  const isHost = game?.host_user_id === user?.id;

  const racers = humanPlayers.map((p) => ({
    userId: p.user_id as string,
    name: profiles[p.user_id as string]?.name || (p.user_id === user?.id ? myName : "YAJ Racer"),
    carId: ((game?.game_state?.driveCars?.[p.user_id as string] as DriveCarId) || "gt"),
  }));

  const saveSetup = async (nextCar: DriveCarId, nextCourse = course) => {
    if (!game) return;
    setCarId(nextCar);
    if (isHost) setCourse(nextCourse);
    try {
      await (supabase as any).rpc("drive_update_setup", {
        p_game_id: game.id,
        p_car_id: nextCar,
        p_course: isHost ? nextCourse : null,
      });
      await refresh();
    } catch {
      // Keep the local selection responsive if the backend is briefly unavailable.
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    drivingSfx.setMuted(next);
  };

  const quitGame = () => {
    void (async () => {
      if (game) await endGame(game.id);
      navigate("/games");
    })();
  };

  const handleFinish = async (finishPlace: number) => {
    if (!game || !user || finished) return;
    setPlace(finishPlace);
    setFinished(true);
    setSeated(false);
    try {
      await (supabase as any).rpc("drive_finish_racer", {
        p_game_id: game.id,
        p_place: finishPlace,
        p_course: course,
      });
      if (!statsWritten.current) {
        statsWritten.current = true;
        await bumpStats(user.id, "driving", finishPlace === 1 ? "win" : "loss", Math.max(0, 5 - finishPlace) * 250 + course * 100);
      }
      await refresh();
    } catch {
      // The local finish/result should remain visible if result sync is delayed.
    }
  };

  const startCourse = async (nextCourse: number) => {
    if (!game || !user) return;
    const next = Math.max(1, Math.min(5, nextCourse));
    try {
      if (isHost) {
        await (supabase as any).rpc("drive_update_setup", {
          p_game_id: game.id,
          p_car_id: carId,
          p_course: next,
        });
      }
      setCourse(next);
      setFinished(false);
      setPlace(1);
      setSeated(true);
      await refresh();
    } catch (e: any) {
      toast({ title: "Could not start the next course", description: e?.message, variant: "destructive" });
    }
  };

  const nextCourseAction = () => {
    if (course < 5) {
      void startCourse(course + 1);
      return;
    }
    void startNewChampionship();
  };

  const startNewChampionship = async () => {
    if (!user) return;
    try {
      const invitees = humanPlayers
        .map((p) => p.user_id)
        .filter((uid): uid is string => Boolean(uid && uid !== user.id));
      const next = invitees.length
        ? await createDriveRaceGame(user.id, invitees, 1, carId)
        : await createDriveRaceGame(user.id, [], 1, carId);
      navigate(gameRoute("driving", next.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not start a new championship", description: e?.message, variant: "destructive" });
    }
  };

  const challengeRacers = async (people: Person[]) => {
    if (!user) return;
    try {
      const next = await createDriveRaceGame(
        user.id,
        people.map((p) => p.user_id),
        course,
        carId,
      );
      setPicker(false);
      toast({
        title: people.length === 1 ? "Race invite sent" : `${people.length} race invites sent`,
        description: "Everyone races together on the same track.",
      });
      navigate(gameRoute("driving", next.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not create the race", description: e?.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = `I finished #${place} on ${DRIVE_COURSES[course - 1]?.name || "YAJ Drive"} 🏁`;
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

  if (!game || !user) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">This race is no longer available.</p>
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to Games
        </button>
      </div>
    );
  }

  const courseInfo = DRIVE_COURSES[course - 1] || DRIVE_COURSES[0];
  const opponentCount = Math.max(1, humanPlayers.length - 1);

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        {seated && !finished && game.status === "active" && (
          <DrivingRace
            key={`${game.id}-course-${course}-${carId}`}
            gameId={game.id}
            userId={user.id}
            courseLevel={course}
            carId={carId}
            racers={racers}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onQuit={quitGame}
            onFinish={(finishPlace) => void handleFinish(finishPlace)}
          />
        )}

        <PendingChallengeGate
          gameId={game.id}
          userId={user.id}
          waiting={game.host_user_id !== user.id && game.status === "waiting"}
          challengerName={profiles[game.host_user_id]?.name || "YAJ Racer"}
          onAccepted={refresh}
        />

        <WaitingForOpponentGate
          show={game.mode === "multiplayer" && game.status === "waiting" && isHost}
          opponentName={humanPlayers.length > 2 ? "your racers" : "your opponent"}
          onCancel={quitGame}
        />

        {game.status === "active" && !finished && (
          <GameLiveDock
            gameId={game.id}
            userId={user.id}
            isPlayer={!!me}
            isLive={Boolean((game as any).is_live)}
            hasHumanOpponent={humanPlayers.length > 1}
            placement="rail"
            onChanged={refresh}
          />
        )}

        <GameIntro
          open={!seated && !finished && game.status === "active"}
          title="Drive"
          subtitle={
            game.mode === "solo"
              ? `Arcade Grand Prix · You vs 3 computer racers`
              : `${humanPlayers.length} racers together · ${courseInfo.name}`
          }
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{
            name: game.mode === "solo" ? "3 Racers" : `${opponentCount} Rival${opponentCount === 1 ? "" : "s"}`,
            avatarUrl: null,
            isComputer: game.mode === "solo",
          }}
          stats={stats}
          matchups={matchups}
          extraContent={
            <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/15 bg-black/55 p-3 backdrop-blur-md">
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white/55">Choose Your Car</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {DRIVE_CARS.map((car) => (
                    <button
                      key={car.id}
                      type="button"
                      onClick={() => void saveSetup(car.id)}
                      className={`min-h-12 rounded-xl border px-1 py-1.5 text-[9px] font-black leading-tight transition active:scale-95 ${
                        carId === car.id ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/15 bg-white/5 text-white"
                      }`}
                    >
                      <span className="mx-auto mb-1 block h-2.5 w-7 rounded-full" style={{ background: car.color, boxShadow: `0 0 8px ${car.accent}` }} />
                      {car.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/55">Course</p>
                  <p className="text-[10px] font-bold text-cyan-200">{courseInfo.condition}</p>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {DRIVE_COURSES.map((item) => (
                    <button
                      key={item.level}
                      type="button"
                      disabled={!isHost && game.mode === "multiplayer"}
                      onClick={() => {
                        if (isHost || game.mode === "solo") void saveSetup(carId, item.level);
                      }}
                      className={`min-h-11 rounded-xl border text-sm font-black transition active:scale-95 disabled:opacity-40 ${
                        course === item.level ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/15 bg-white/5 text-white"
                      }`}
                    >
                      {item.level}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-center text-[10px] font-bold text-white/45">
                  {isHost || game.mode === "solo" ? courseInfo.name : `Host selected: ${courseInfo.name}`}
                </p>
              </div>
            </div>
          }
          onStart={() => {
            setSeated(true);
            void drivingSfx.prime();
          }}
          onBack={quitGame}
          onPlaySolo={() => {
            void (async () => {
              try {
                const next = await createDriveRaceGame(user.id, [], course, carId);
                navigate(gameRoute("driving", next.id), { replace: true });
              } catch (e: any) {
                toast({ title: "Could not start a solo race", description: e?.message, variant: "destructive" });
              }
            })();
          }}
          onQuickMatch={() => setPicker(true)}
          soloLabel="Solo Grand Prix"
        />
      </div>

      <GameResultCard
        open={finished}
        outcome={place === 1 ? "win" : "loss"}
        title={place === 1 ? "1st Place!" : `Finished #${place}`}
        detail={
          course < 5
            ? `${courseInfo.name} complete. Next up: ${DRIVE_COURSES[course]?.name}.`
            : "You completed the five-course YAJ Drive championship."
        }
        primaryLabel={course < 5 ? "Next Course" : "New Championship"}
        onRematch={nextCourseAction}
        onChallenge={() => setPicker(true)}
        onShare={shareResult}
        onExit={quitGame}
        exitLabel="Exit to Games"
      />

      <OpponentPickerSheet
        open={picker}
        onClose={() => setPicker(false)}
        onPick={() => {}}
        multiSelect
        maxSelections={3}
        onConfirmMultiple={(people) => void challengeRacers(people)}
        title="Invite Racers"
      />
    </LandscapeStage>
  );
}
