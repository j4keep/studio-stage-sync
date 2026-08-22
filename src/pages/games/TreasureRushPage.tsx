import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameIntro from "@/components/games/GameIntro";
import { useGameRecord } from "@/components/games/GameQuickActions";
import GameResultCard from "@/components/games/pro/GameResultCard";
import TreasureRushStage, { TrOutcome } from "@/components/games/treasure-rush/TreasureRushStage";
import { useTurnGame } from "@/hooks/use-turn-game";
import { trSfx } from "@/lib/treasure-rush-sfx";
import { bumpStats, createSoloGame, endGame, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";
import treasureArt from "@/assets/games/adventures/treasure-rush.png.asset.json";

const MY_COLOR = "#f0b429";

export default function TreasureRushPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [solo, setSolo] = useState(false);
  const [muted, setMuted] = useState(trSfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(1);
  const [result, setResult] = useState<TrOutcome | null>(null);
  const saved = useRef<number | null>(null);

  const { stats, matchups } = useGameRecord("treasure_rush", user?.id, result?.total ?? null);
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

  const onEnd = (outcome: TrOutcome) => {
    setResult(outcome);
    void (async () => {
      if (!user || !game) return;
      if (saved.current === runKey) return;
      saved.current = runKey;
      try {
        await bumpStats(user.id, "treasure_rush", outcome.escaped ? "win" : "loss", outcome.total);
        await updateGameState(game.id, {
          game_state: {
            ...(game.game_state || {}),
            treasureRush: {
              total: outcome.total,
              coins: outcome.coins,
              gems: outcome.gems,
              chests: outcome.chests + outcome.goldChests,
              escaped: outcome.escaped,
            },
          },
          status: "completed",
          is_draw: false,
          winner_user_id: outcome.escaped ? user.id : null,
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
      const g = await createSoloGame("treasure_rush", user.id, { moveNumber: 0 });
      setResult(null);
      saved.current = null;
      setRunKey((k) => k + 1);
      navigate(gameRoute("treasure_rush", g.id), { replace: true });
      setSeated(true);
    } catch (e: any) {
      toast({ title: "Could not start a new run", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = result
      ? `I scored ${result.total.toLocaleString()} in YAJ Treasure Rush — Lost City Market 💎`
      : "YAJ Treasure Rush";
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
    trSfx.setMuted(next);
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
        <p className="font-bold">This run is no longer available.</p>
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
          <TreasureRushStage
            runKey={runKey}
            myColor={MY_COLOR}
            best={best}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onQuit={quitGame}
            onEnd={onEnd}
            noTimer={solo}
          />
        )}

        <GameIntro
          showCharacterCustomize
          open={!seated}
          title="YAJ Treasure Rush"
          subtitle="Lost City Market — loot the ruins and escape before the timer runs out"
          artUrl={treasureArt.url}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: "The Lost City", avatarUrl: null, isComputer: true }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSolo(false);
            setSeated(true);
            void trSfx.prime();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            setSolo(true);
            setSeated(true);
            void trSfx.prime();
          }}
          soloLabel={"Solo Mode\nNo timer"}
        />
      </div>

      <GameResultCard
        open={Boolean(result)}
        outcome={result?.escaped ? "win" : "loss"}
        title={
          result?.escaped
            ? best && result.total >= best
              ? "Escaped with a new best haul!"
              : "Escaped the Lost City!"
            : result?.status === "timeup"
              ? "Out of time"
              : "You were overrun"
        }
        detail={detail}
        onRematch={runAgain}
        onShare={shareResult}
      />
    </div>
  );
}
