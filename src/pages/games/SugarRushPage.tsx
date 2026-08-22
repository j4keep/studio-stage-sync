import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useGameRecord } from "@/components/games/GameQuickActions";
import GameResultCard from "@/components/games/pro/GameResultCard";
import SugarRushMazeStage, { SugarRushOutcome } from "@/components/games/sugar-rush/SugarRushMazeStage";
import SugarRushIntro from "@/components/games/sugar-rush/SugarRushIntro";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";
import { useTurnGame } from "@/hooks/use-turn-game";
import { bumpStats, createSoloGame, endGame, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

export default function SugarRushPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [muted, setMuted] = useState(sugarRushSfx.muted);
  const [runKey, setRunKey] = useState(1);
  const [result, setResult] = useState<SugarRushOutcome | null>(null);
  const saved = useRef<number | null>(null);

  const { stats } = useGameRecord("sugar_rush", user?.id, result?.score ?? null);
  const best = stats?.highScore ?? null;

  const onEnd = (outcome: SugarRushOutcome) => {
    setResult(outcome);
    void (async () => {
      if (!user || !game) return;
      if (saved.current === runKey) return;
      saved.current = runKey;
      try {
        await bumpStats(user.id, "sugar_rush", outcome.completed ? "win" : "loss", outcome.score);
        await updateGameState(game.id, {
          game_state: {
            ...(game.game_state || {}),
            sugarRushRun: {
              score: outcome.score,
              treatsCollected: outcome.treatsCollected,
              rushActivations: outcome.rushActivations,
              heartsRemaining: outcome.heartsRemaining,
              completed: outcome.completed,
            },
          },
          status: "completed",
          is_draw: false,
          winner_user_id: outcome.completed ? user.id : null,
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
      const g = await createSoloGame("sugar_rush", user.id, { moveNumber: 0 });
      setResult(null);
      saved.current = null;
      setRunKey((k) => k + 1);
      navigate(gameRoute("sugar_rush", g.id), { replace: true });
      setSeated(true);
    } catch (e: any) {
      toast({ title: "Could not start a new run", description: e.message, variant: "destructive" });
    }
  };

  const share = async (text: string, copiedTitle: string) => {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: copiedTitle });
      }
    } catch {
      /* cancelled */
    }
  };

  const shareResult = () =>
    share(
      result
        ? `I scored ${result.score.toLocaleString()} in YAJ Sugar Rush — ${result.treatsCollected} treats, ${result.rushActivations} Sugar Rush activations! 🍬`
        : "YAJ Sugar Rush",
      "Result copied",
    );

  const challengeFriend = () =>
    share(
      result
        ? `I challenge you to beat my score of ${result.score.toLocaleString()} in YAJ Sugar Rush! 🍬`
        : "I challenge you to beat my score in YAJ Sugar Rush! 🍬",
      "Challenge copied",
    );

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sugarRushSfx.setMuted(next);
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
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
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
          <SugarRushMazeStage
            runKey={runKey}
            best={best}
            muted={muted}
            onToggleMute={toggleMute}
            onBack={() => navigate("/games")}
            onQuit={quitGame}
            onEnd={onEnd}
          />
        )}

        {!seated && (
          <SugarRushIntro
            bestScore={best}
            onBack={() => navigate("/games")}
            onPlaySolo={() => {
              setSeated(true);
              void sugarRushSfx.prime().then(() => sugarRushSfx.startMusic());
            }}
          />
        )}
      </div>

      <GameResultCard
        open={Boolean(result)}
        outcome={result?.completed ? "win" : "loss"}
        title={
          result?.completed
            ? best && result.score >= best
              ? "Sugar Rush Complete — new best score!"
              : "Sugar Rush Complete!"
            : "Dr. Cavity got you"
        }
        detail={detail}
        onRematch={runAgain}
        onChallenge={challengeFriend}
        onShare={shareResult}
      />
    </div>
  );
}
