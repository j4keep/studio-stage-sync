import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameIntro from "@/components/games/GameIntro";
import { useGameRecord } from "@/components/games/GameQuickActions";
import GameResultCard from "@/components/games/pro/GameResultCard";
import SurvivalIslandStage, { IslandOutcome } from "@/components/games/survival-island/SurvivalIslandStage";
import { useTurnGame } from "@/hooks/use-turn-game";
import { islandMuted, islandSetMuted, islandSfx } from "@/lib/survival-island-sfx";
import { bumpStats, createSoloGame, endGame, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";
import islandArt from "@/assets/games/adventures/survival-island.png.asset.json";

export default function SurvivalIslandPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [solo, setSolo] = useState(false);
  const [muted, setMuted] = useState(islandMuted());
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(1);
  const [result, setResult] = useState<IslandOutcome | null>(null);
  const saved = useRef<number | null>(null);

  const { stats, matchups } = useGameRecord("survival_island", user?.id, result?.total ?? null);
  const best = stats?.highScore ?? null;

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

  const onEnd = (outcome: IslandOutcome) => {
    setResult(outcome);
    void (async () => {
      if (!user || !game) return;
      if (saved.current === runKey) return;
      saved.current = runKey;
      try {
        await bumpStats(user.id, "survival_island", outcome.survived ? "win" : "loss", outcome.total);
        await updateGameState(game.id, {
          game_state: {
            ...(game.game_state || {}),
            survivalIsland: {
              total: outcome.total,
              stars: outcome.stars,
              hearts: outcome.hearts,
              wave: outcome.wave,
              survivedMs: outcome.survivedMs,
              survived: outcome.survived,
            },
          },
          status: "completed",
          is_draw: false,
          winner_user_id: outcome.survived ? user.id : null,
          finished_at: new Date().toISOString(),
        });
      } catch {
        /* score keeping is non-critical */
      }
    })();
  };

  const runAgain = async () => {
    if (!user) return;
    try {
      const g = await createSoloGame("survival_island", user.id, { moveNumber: 0 });
      setResult(null);
      saved.current = null;
      setRunKey((k) => k + 1);
      navigate(gameRoute("survival_island", g.id), { replace: true });
      setSeated(true);
    } catch (e: any) {
      toast({ title: "Could not start a new run", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = result
      ? `I scored ${result.total.toLocaleString()} surviving YAJ Survival Island (${Math.floor(result.survivedMs / 1000)}s, wave ${result.wave}) 🏝️`
      : "YAJ Survival Island";
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
    islandSetMuted(next);
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
        <p className="font-bold">This island run is no longer available.</p>
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

  const detail = result
    ? result.lines.map((l) => `${l.label}: ${l.value.toLocaleString()}`).join(" · ")
    : undefined;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        {seated && (
          <SurvivalIslandStage
            runKey={runKey}
            best={best}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onQuit={quitGame}
            onEnd={onEnd}
            endless={solo}
          />
        )}

        <GameIntro
          showCharacterCustomize
          open={!seated}
          title="YAJ Survival Island"
          subtitle="Sunset Island — dodge falling coconuts, rising water, wild winds and crates. Survive 2:30."
          artUrl={islandArt.url}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: "The Island", avatarUrl: null, isComputer: true }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSolo(false);
            setSeated(true);
            islandSfx.unlock();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            setSolo(true);
            setSeated(true);
            islandSfx.unlock();
          }}
          soloLabel={"Solo Mode\nNo timer"}
        />
      </div>

      <GameResultCard
        open={Boolean(result)}
        outcome={result?.survived ? "win" : "loss"}
        title={
          result?.survived
            ? best && result.total >= best
              ? "You survived — new island record!"
              : "You survived Sunset Island!"
            : solo
              ? best && result && result.total >= best
                ? "Solo run over — new island record!"
                : "Solo run over"
              : "You didn't make it"
        }
        detail={detail}
        onRematch={runAgain}
        onShare={shareResult}
      />
    </div>
  );
}
