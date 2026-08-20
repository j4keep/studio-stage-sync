import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameIntro from "@/components/games/GameIntro";
import { useGameRecord } from "@/components/games/GameQuickActions";
import GameResultCard from "@/components/games/pro/GameResultCard";
import CityRunStage from "@/components/games/city-run/CityRunStage";
import { useTurnGame } from "@/hooks/use-turn-game";
import { obbySfx } from "@/lib/obby-sfx";
import { bumpStats, createSoloGame, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";
import cityArt from "@/assets/games/adventures/city-run.png.asset.json";

const HOW_TO_PLAY = [
  "You run automatically — the longer you survive, the faster the city gets.",
  "One stick does everything — push it left or right to switch lanes and dodge cars and buses.",
  "Swipe the stick up to jump cones and barriers, swipe it down to slide under low signs.",
  "Collect coins for 10 points each — 🧲 magnet pulls them in, 🛡️ shield saves you from one crash, ⚡ boost speeds you up.",
  "One crash without a shield ends the run. Score = distance + coins.",
];

const MY_COLOR = "#2f7bff";

export default function CityRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [muted, setMuted] = useState(obbySfx.muted);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(1);
  const [result, setResult] = useState<{ score: number; coins: number; distance: number } | null>(null);
  const saved = useRef<number | null>(null);

  const { stats, matchups } = useGameRecord("city_run", user?.id, result?.score ?? null);
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

  const onEnd = (score: number, coins: number, distance: number) => {
    setResult({ score, coins, distance });
    void (async () => {
      if (!user || !game) return;
      if (saved.current === runKey) return;
      saved.current = runKey;
      try {
        await bumpStats(user.id, "city_run", "win", score);
        await updateGameState(game.id, {
          game_state: { ...(game.game_state || {}), cityRun: { score, coins, distance } },
          status: "completed",
          is_draw: false,
          winner_user_id: user.id,
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
      const g = await createSoloGame("city_run", user.id, { moveNumber: 0 });
      setResult(null);
      saved.current = null;
      setRunKey((k) => k + 1);
      navigate(gameRoute("city_run", g.id), { replace: true });
      setSeated(true);
    } catch (e: any) {
      toast({ title: "Could not start a new run", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = `I just ran ${Math.round(result?.distance ?? 0)}m in YAJ City Run for ${result?.score ?? 0} points 🏃‍♂️🌆`;
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

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    obbySfx.setMuted(next);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        {seated && (
          <CityRunStage
            runKey={runKey}
            myColor={MY_COLOR}
            onBack={() => navigate("/games")}
            onEnd={onEnd}
            headline="YAJ City Run"
            subline="Endless sprint through the city — dodge, jump, slide"
            howToPlay={HOW_TO_PLAY}
            muted={muted}
            onToggleMute={toggleMute}
            best={best}
          />
        )}

        <GameIntro
          open={!seated}
          title="YAJ City Run"
          subtitle="Endless runner — how far can you get before you crash?"
          artUrl={cityArt.url}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: "The city", avatarUrl: null, isComputer: true }}
          stats={stats}
          matchups={matchups}
          onStart={() => {
            setSeated(true);
            void obbySfx.prime();
          }}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            setSeated(true);
            void obbySfx.prime();
          }}
        />
      </div>

      <GameResultCard
        open={Boolean(result)}
        outcome="win"
        title={result && best && result.score >= best ? "New personal best!" : "Run over"}
        detail={result ? `${result.score.toLocaleString()} pts — ${Math.round(result.distance)}m and ${result.coins} coins` : undefined}
        onRematch={runAgain}
        onShare={shareResult}
      />
    </div>
  );
}
