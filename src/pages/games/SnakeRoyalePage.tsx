import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useGameRecord } from "@/components/games/GameQuickActions";
import GameResultCard from "@/components/games/pro/GameResultCard";
import SnakeRoyaleIntro from "@/components/games/snake-royale/SnakeRoyaleIntro";
import SnakeRoyaleStage, { SnakeRoyaleOutcome } from "@/components/games/snake-royale/SnakeRoyaleStage";
import { useTurnGame } from "@/hooks/use-turn-game";
import { snakeRoyaleMuted, snakeRoyaleSetMuted } from "@/lib/snake-royale-sfx";
import { bumpStats, createSoloGame, endGame, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

export default function SnakeRoyalePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [solo, setSolo] = useState(false);
  const [muted, setMuted] = useState(snakeRoyaleMuted());
  const [runKey, setRunKey] = useState(1);
  const [result, setResult] = useState<SnakeRoyaleOutcome | null>(null);
  const saved = useRef<number | null>(null);

  const { stats } = useGameRecord("snake_royale", user?.id, result?.total ?? null);
  const best = stats?.highScore ?? null;

  const onEnd = (outcome: SnakeRoyaleOutcome) => {
    setResult(outcome);
    void (async () => {
      if (!user || !game) return;
      if (saved.current === runKey) return;
      saved.current = runKey;
      try {
        await bumpStats(user.id, "snake_royale", outcome.survived ? "win" : "loss", outcome.total);
        await updateGameState(game.id, {
          game_state: {
            ...(game.game_state || {}),
            snakeRoyale: {
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
      const g = await createSoloGame("snake_royale", user.id, { moveNumber: 0 });
      setResult(null);
      saved.current = null;
      setRunKey((k) => k + 1);
      navigate(gameRoute("snake_royale", g.id), { replace: true });
      setSeated(true);
    } catch (e: any) {
      toast({ title: "Could not start a new run", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = result
      ? `I scored ${result.total.toLocaleString()} surviving YAJ Snake Royale (${Math.floor(result.survivedMs / 1000)}s, wave ${result.wave}) 🐍🌿`
      : "YAJ Snake Royale";
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
    snakeRoyaleSetMuted(next);
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
          <SnakeRoyaleStage
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

        {!seated && (
          <SnakeRoyaleIntro
            bestScore={best}
            solo={solo}
            onSetSolo={setSolo}
            onPlay={() => setSeated(true)}
            onBack={() => navigate("/games")}
          />
        )}
      </div>

      <GameResultCard
        open={Boolean(result)}
        outcome={result?.survived ? "win" : "loss"}
        title={
          result?.survived
            ? best && result.total >= best
              ? "You escaped — new jungle record!"
              : "You made it through the jungle!"
            : solo
              ? best && result && result.total >= best
                ? "Solo run over — new jungle record!"
                : "Solo run over"
              : "The jungle got you"
        }
        detail={detail}
        onRematch={runAgain}
        onShare={shareResult}
      />
    </div>
  );
}
