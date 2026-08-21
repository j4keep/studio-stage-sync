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
import FleetClashStage from "@/components/games/battleship/FleetClashStage";
import { useTurnGame } from "@/hooks/use-turn-game";
import { bumpStats, createMultiplayerGame, createSoloGame, updateGameState } from "@/lib/games";
import { initialBattleship } from "@/lib/battleship";
import { gameRoute } from "@/lib/game-routes";
import fleetClashArt from "@/assets/games/fleet-clash.svg";

export default function BattleshipPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [muted, setMuted] = useState(false);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const saved = useRef(false);

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
    saved.current = false;
  }, [game?.id]);

  const finishRun = async (didWin: boolean, finalScore: number) => {
    setFinished(true);
    setWon(didWin);
    setScore(finalScore);
    if (!game || !user || saved.current) return;
    saved.current = true;
    try {
      await updateGameState(game.id, {
        status: "completed",
        winner_user_id: didWin ? user.id : (game.mode === "multiplayer" ? opponent?.user_id ?? null : null),
        is_draw: false,
        finished_at: new Date().toISOString(),
        game_state: { ...(game.game_state || {}), fleetClashAction: { score: finalScore, won: didWin } },
      });
      await bumpStats(user.id, "battleship", didWin ? "win" : "loss");
      await refresh();
    } catch {
      // The run itself is local/action gameplay; a stats sync failure should not break the result screen.
    }
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { battleship: initialBattleship(), moveNumber: 0 };
      const next = game.mode === "solo"
        ? await createSoloGame("battleship", user.id, state)
        : opponent?.user_id
          ? await createMultiplayerGame("battleship", user.id, opponent.user_id, state)
          : null;
      if (next) navigate(gameRoute("battleship", next.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e?.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const next = await createMultiplayerGame("battleship", user.id, opponentId, { battleship: initialBattleship(), moveNumber: 0 });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("battleship", next.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e?.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = `I just scored ${score.toLocaleString()} in YAJ Fleet Clash 🌊`;
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
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!game) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">This game is no longer available.</p>
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">Back to Games</button>
      </div>
    );
  }

  const oppLabel = game.mode === "solo" ? "Computer" : opponentName;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <div className="relative h-full w-full">
        {seated && (
          <FleetClashStage
            key={game.id}
            opponentName={oppLabel}
            muted={muted}
            onToggleMute={() => setMuted((v) => !v)}
            onStatus={() => {}}
            onFinish={(didWin, finalScore) => void finishRun(didWin, finalScore)}
            onBack={() => navigate("/games")}
          />
        )}

        <PendingChallengeGate
          gameId={game.id}
          userId={user?.id}
          waiting={game.status === "waiting" && game.host_user_id !== user?.id}
          challengerName={opponentName}
          onAccepted={refresh}
        />
        <GameLiveDock
          gameId={game.id}
          userId={user?.id}
          isPlayer={!!me}
          isLive={Boolean((game as any).is_live)}
          hasHumanOpponent={game.mode === "multiplayer" && !!opponent?.user_id}
          placement="rail"
          onChanged={refresh}
        />

        <GameIntro
          open={!seated && !finished}
          title="YAJ Fleet Clash"
          subtitle={game.mode === "solo" ? "River race — solo run" : `River race — you vs ${opponentName}`}
          artUrl={fleetClashArt}
          me={{ name: myName, avatarUrl: myAvatar }}
          them={{ name: oppLabel, avatarUrl: game.mode === "solo" ? null : opponentAvatar, isComputer: game.mode === "solo" }}
          stats={stats}
          matchups={matchups}
          onStart={() => setSeated(true)}
          onBack={() => navigate("/games")}
          onPlaySolo={() => {
            if (game.mode === "solo" && game.status === "active") {
              setSeated(true);
              return;
            }
            void (async () => {
              try {
                const next = await createSoloGame("battleship", user!.id, { battleship: initialBattleship(), moveNumber: 0 });
                navigate(gameRoute("battleship", next.id), { replace: true });
              } catch (e: any) {
                toast({ title: "Could not start a solo game", description: e?.message, variant: "destructive" });
              }
            })();
          }}
          onQuickMatch={() => setPicker(true)}
        />
      </div>

      <GameResultCard
        open={finished}
        outcome={won ? "win" : "loss"}
        title={won ? "Fleet Victory!" : "Boat Disabled"}
        detail={won ? `Your crew crossed the final cove first with ${score.toLocaleString()} points.` : `The rival crossed first. You scored ${score.toLocaleString()} points — run the river again.`}
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
        title="Challenge to YAJ Fleet Clash"
      />
    </div>
  );
}
