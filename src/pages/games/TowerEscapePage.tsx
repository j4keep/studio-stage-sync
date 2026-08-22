import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameIntro from "@/components/games/GameIntro";
import { useGameRecord } from "@/components/games/GameQuickActions";
import GameResultCard from "@/components/games/pro/GameResultCard";
import TowerEscapeStage, { TowerOutcome } from "@/components/games/tower-escape/TowerEscapeStage";
import { useTurnGame } from "@/hooks/use-turn-game";
import { towerMuted, towerSetMuted, towerSfx } from "@/lib/tower-escape-sfx";
import { bumpStats, createSoloGame, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";
import towerArt from "@/assets/games/adventures/tower-escape.png.asset.json";

export default function TowerEscapePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [muted, setMuted] = useState(towerMuted());
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(1);
  const [result, setResult] = useState<TowerOutcome | null>(null);
  const saved = useRef<number | null>(null);

  const { stats, matchups } = useGameRecord("tower_escape", user?.id, result?.total ?? null);
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

  const onEnd = (outcome: TowerOutcome) => {
    setResult(outcome);
    void (async () => {
      if (!user || !game) return;
      if (saved.current === runKey) return;
      saved.current = runKey;
      try {
        await bumpStats(user.id, "tower_escape", outcome.escaped ? "win" : "loss", outcome.total);
        await updateGameState(game.id, {
          game_state: {
            ...(game.game_state || {}),
            towerEscape: {
              total: outcome.total,
              stars: outcome.stars,
              hearts: outcome.hearts,
              checkpoint: outcome.checkpoint,
              climbedPct: outcome.climbedPct,
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
      const g = await createSoloGame("tower_escape", user.id, { moveNumber: 0 });
      setResult(null);
      saved.current = null;
      setRunKey((k) => k + 1);
      navigate(gameRoute("tower_escape", g.id), { replace: true });
      setSeated(true);
    } catch (e: any) {
      toast({ title: "Could not start a new climb", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = result
      ? `I scored ${result.total.toLocaleString()} climbing YAJ Tower Escape (${result.climbedPct}% of the tower) 🏙️`
      : "YAJ Tower Escape";
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
    towerSetMuted(next);
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
        <p className="font-bold">This climb is no longer available.</p>
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
          <TowerEscapeStage
            runKey={runKey}
            best={best}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onEnd={onEnd}
          />
        )}

        <GameIntro
          showCharacterCustomize
          open={!seated}
          title="YAJ Tower Escape"
          subtitle="Climb the YAJ tower floor by floor and reach the rooftop before the clock runs out"
          artUrl={towerArt.url}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: "The Tower", avatarUrl: null, isComputer: true }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSeated(true);
            towerSfx.unlock();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            setSeated(true);
            towerSfx.unlock();
          }}
        />
      </div>

      <GameResultCard
        open={Boolean(result)}
        outcome={result?.escaped ? "win" : "loss"}
        title={
          result?.escaped
            ? best && result.total >= best
              ? "Rooftop reached — new best climb!"
              : "You escaped the tower!"
            : result?.reason === "timeup"
              ? "Out of time"
              : "Tower run failed"
        }
        detail={detail}
        onRematch={runAgain}
        onShare={shareResult}
      />
    </div>
  );
}
