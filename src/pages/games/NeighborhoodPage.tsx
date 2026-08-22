import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Share2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameIntro from "@/components/games/GameIntro";
import { useGameRecord } from "@/components/games/GameQuickActions";
import NeighborhoodStage from "@/components/games/neighborhood/NeighborhoodStage";
import MissionListSheet from "@/components/games/neighborhood/MissionListSheet";
import TutorialOverlay from "@/components/games/neighborhood/TutorialOverlay";
import { useTurnGame } from "@/hooks/use-turn-game";
import { neighborhoodMuted, neighborhoodSetMuted, neighborhoodSfx } from "@/lib/neighborhood-sfx";
import { NeighborhoodEvent, NeighborhoodState, fromSave, toSave } from "@/lib/neighborhood/engine";
import { MISSIONS, initialMissionsState, missionsCompleteCount } from "@/lib/neighborhood/missions";
import { NeighborhoodScore, scoreNeighborhood } from "@/lib/neighborhood/score";
import { bumpStats, updateGameState } from "@/lib/games";
import neighborhoodArt from "@/assets/games/adventures/neighborhood.png.asset.json";

const TUTORIAL_KEY = "wheuat.neighborhood.tutorialSeen";

export default function NeighborhoodPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [muted, setMuted] = useState(neighborhoodMuted());
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [preMissionsOpen, setPreMissionsOpen] = useState(false);
  const [complete, setComplete] = useState(false);
  const [completeSummary, setCompleteSummary] = useState<NeighborhoodScore | null>(null);

  const celebratedRef = useRef(false);

  const { stats, matchups } = useGameRecord("neighborhood", user?.id, undefined);

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

  const savedMissions = game?.game_state?.neighborhood?.missions ?? initialMissionsState();

  useEffect(() => {
    celebratedRef.current = missionsCompleteCount(savedMissions) >= MISSIONS.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  const initialEngineState = useMemo(() => fromSave(game?.game_state?.neighborhood ?? null), [game?.id]);

  const persist = (st: NeighborhoodState) => {
    if (!game) return;
    void updateGameState(game.id, {
      game_state: { ...(game.game_state || {}), neighborhood: toSave(st) },
    });
  };

  const onCheckpoint = (st: NeighborhoodState, event?: NeighborhoodEvent) => {
    persist(st);
    if (event === "mission_completed" && user) {
      const score = scoreNeighborhood(
        st.missions,
        st.starsCollected.filter(Boolean).length,
        st.starsCollected.length,
        st.discoveriesFound.size,
        st.map.discoverySpots.length,
      );
      void bumpStats(user.id, "neighborhood", "win", score.xp);
      if (score.missionsComplete >= score.missionsTotal && !celebratedRef.current) {
        celebratedRef.current = true;
        setCompleteSummary(score);
        setComplete(true);
        neighborhoodSfx.completion();
      }
    }
  };

  const enter = () => {
    setSeated(true);
    neighborhoodSfx.unlock();
    let seenTutorial = false;
    try {
      seenTutorial = localStorage.getItem(TUTORIAL_KEY) === "1";
    } catch {
      /* storage unavailable */
    }
    if (!seenTutorial) setTutorialOpen(true);
  };

  const closeTutorial = () => {
    setTutorialOpen(false);
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    neighborhoodSetMuted(next);
  };

  const shareProgress = async () => {
    const text = completeSummary
      ? `I just finished all 5 missions in YAJ Central — ${completeSummary.starsFound}/${completeSummary.starsTotal} stars, ${completeSummary.xp} XP! 🏙️`
      : "YAJ Neighborhood Adventure";
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Progress copied" });
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
        <p className="font-bold">This neighborhood isn't available right now.</p>
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

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        {seated && (
          <NeighborhoodStage
            initial={initialEngineState}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onCheckpoint={onCheckpoint}
          />
        )}

        <GameIntro
          showCharacterCustomize
          open={!seated}
          title="YAJ Neighborhood Adventure"
          subtitle="Explore. Help out. Discover your block."
          artUrl={neighborhoodArt.url}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: "YAJ Central", avatarUrl: null, isComputer: true }}
          stats={stats}
          matchups={matchups}
          onStart={enter}
          onBack={() => navigate("/games")}
          onPlaySolo={enter}
        />

        {!seated && (
          <div className="pointer-events-none absolute inset-x-0 bottom-28 z-[71] flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="pointer-events-auto rounded-full border border-white/25 bg-black/50 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur"
            >
              How to Play
            </button>
            <button
              type="button"
              onClick={() => setPreMissionsOpen(true)}
              className="pointer-events-auto rounded-full border border-white/25 bg-black/50 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur"
            >
              Missions
            </button>
          </div>
        )}

        {!seated && <MissionListSheet open={preMissionsOpen} missions={savedMissions} onClose={() => setPreMissionsOpen(false)} />}
      </div>

      <TutorialOverlay open={tutorialOpen} onClose={closeTutorial} />

      {complete && completeSummary && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-3xl border border-[#FFD166]/50 bg-gradient-to-b from-[#241a3d] to-[#160f27] p-5 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD166] to-[#c79a2c] shadow-[0_0_30px_rgba(255,209,102,0.5)]">
              <Sparkles className="h-8 w-8 text-[#3a2a06]" />
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white">YAJ Central Complete</h2>
            <p className="mt-1 text-sm text-white/70">Missions: {completeSummary.missionsComplete} / {completeSummary.missionsTotal}</p>
            <p className="text-sm text-white/70">
              Stars Found: {completeSummary.starsFound} / {completeSummary.starsTotal}
            </p>
            <p className="text-sm text-white/70">Secrets Found: {completeSummary.secretsFound}</p>
            <p className="text-sm text-white/70">XP Earned: {completeSummary.xp}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFD166]">
              Neighborhood Completion: {completeSummary.completionPct}%
            </p>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => setComplete(false)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground active:scale-[0.98]"
              >
                Keep Exploring
              </button>
              <button
                type="button"
                onClick={shareProgress}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4" /> Share Progress
              </button>
              <button
                type="button"
                onClick={() => navigate("/games")}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white active:scale-[0.98]"
              >
                Back to Games
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
