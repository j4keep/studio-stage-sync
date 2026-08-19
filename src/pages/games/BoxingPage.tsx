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
import LandscapeStage from "@/components/games/pro/LandscapeStage";
import GameResultCard from "@/components/games/pro/GameResultCard";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import BoxingRing, { SKIN_TONES, CHARACTERS } from "@/components/games/boxing/BoxingRing";
import { useTurnGame } from "@/hooks/use-turn-game";
import { useBoxingLive } from "@/hooks/use-boxing-live";
import { Appearance, DEFAULT_APPEARANCE, Seat } from "@/lib/boxing";
import { bumpStats, createMultiplayerGame, createSoloGame, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const OPP_DEFAULT_APPEARANCE: Appearance = { skin: SKIN_TONES[3], build: "athletic", fem: true, character: "woman" };

/** Gives the computer a varied illustrated opponent per match instead of always the same fighter. */
function computerAppearance(gameId: string): Appearance {
  let h = 0;
  for (let i = 0; i < gameId.length; i++) h = (h * 31 + gameId.charCodeAt(i)) % 100000;
  const c = CHARACTERS[h % CHARACTERS.length];
  return { skin: SKIN_TONES[h % SKIN_TONES.length], build: "athletic", fem: false, character: c.id };
}

export default function BoxingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(id, user?.id);
  const statsWritten = useRef<string | null>(null);

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [muted, setMuted] = useState(false);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const { stats, matchups } = useGameRecord("boxing", user?.id, ended);

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

  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;

  /** Seat colours, so the same fighter is the same colour on every phone. */
  const SEAT_ACCENTS = ["hsl(204 100% 55%)", "#f59e0b"];
  const myAccent = SEAT_ACCENTS[mySeat];
  const oppAccent = SEAT_ACCENTS[oppSeat];

  const appearanceMap = (game?.game_state?.appearance as Record<number, Appearance>) || {};
  const myAppearance: Appearance = appearanceMap[mySeat] || (mySeat === 1 ? OPP_DEFAULT_APPEARANCE : DEFAULT_APPEARANCE);
  const oppAppearance: Appearance =
    appearanceMap[oppSeat] ||
    (game?.mode === "solo" && game?.id ? computerAppearance(game.id) : oppSeat === 1 ? OPP_DEFAULT_APPEARANCE : DEFAULT_APPEARANCE);


  /** Persist the result once, when the real-time match ends. */
  const handleFinish = async (winner: "me" | "opp" | null) => {
    setEnded(true);
    if (!game || !user || statsWritten.current === game.id) return;
    statsWritten.current = game.id;
    const draw = winner === null;
    const iWon = winner === "me";
    if (game.status !== "completed") {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
    }
    await bumpStats(user.id, "boxing", draw ? "draw" : iWon ? "win" : "loss");
    await refresh();
  };

  const live = useBoxingLive({
    gameId: game?.id,
    mode: (game?.mode as "solo" | "multiplayer") || "solo",
    enabled: Boolean(game) && seated,
    onFinish: (winner) => void handleFinish(winner),
  });

  // The bell rings as soon as both fighters are in the ring — no turn order at all.
  useEffect(() => {
    if (!game || !seated) return;
    if (game.status !== "active") return;
    live.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status, seated]);

  const finished = live.phase === "over";

  const setMyAppearance = async (partial: Partial<Appearance>) => {
    if (!game || !user) return;
    const nextAppearance = { ...appearanceMap, [mySeat]: { ...myAppearance, ...partial } };
    const nextGameState = { ...game.game_state, appearance: nextAppearance };
    setGame({ ...game, game_state: nextGameState });
    await updateGameState(game.id, { game_state: nextGameState });
  };

  const freshState = () => ({ live: true, appearance: { [mySeat]: myAppearance } });

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const g =
        game.mode === "solo"
          ? await createSoloGame("boxing", user.id, freshState())
          : opponent?.user_id
            ? await createMultiplayerGame("boxing", user.id, opponent.user_id, freshState())
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("boxing", g.id), { replace: true });
        window.location.reload();
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("boxing", user.id, opponentId, { live: true, appearance: { 0: myAppearance } });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("boxing", g.id), { replace: true });
      window.location.reload();
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = live.winner === null;
    const iWon = live.winner === "me";
    const text = `I just ${draw ? "drew" : iWon ? "won" : "lost"} a boxing match on YAJ 🥊`;
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
        <p className="font-bold">This match is no longer available.</p>
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to Games
        </button>
      </div>
    );
  }

  const oppLabel = game.mode === "solo" ? "Computer" : opponentName;
  const draw = finished && live.winner === null;
  const iWon = finished && live.winner === "me";
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : iWon ? "win" : "loss";

  const statusLabel =
    game.status === "waiting"
      ? "Waiting"
      : game.status === "cancelled"
        ? "Declined"
        : finished
          ? draw
            ? "Draw"
            : iWon
              ? "You won"
              : "You lost"
          : live.phase === "fighting"
            ? "Live — fight!"
            : "Get ready";

  const resultTitle = draw
    ? "Goes the distance"
    : iWon
      ? live.decision
        ? "Victory by decision!"
        : "Victory by knockout!"
      : `${oppLabel} wins`;
  const resultDetail = finished ? `Final health — you ${Math.round(live.me.health)} · ${oppLabel} ${Math.round(live.opp.health)}` : undefined;

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        <BoxingRing
          myName={myName}
          myAppearance={myAppearance}
          myHealth={live.me.health}
          myStamina={live.me.stamina}
          myAdvance={live.me.advance}
          oppName={oppLabel}
          oppAppearance={oppAppearance}
          isComputer={game.mode === "solo"}
          oppHealth={live.opp.health}
          oppStamina={live.opp.stamina}
          oppAdvance={live.opp.advance}
          myAccent={myAccent}
          oppAccent={oppAccent}

          myAnim={live.myAnim}
          oppAnim={live.oppAnim}
          impact={live.impact}
          gap={live.gap}
          cooldowns={live.cooldowns}
          guardCooldown={live.guardCooldown}
          secondsLeft={live.secondsLeft}
          message={live.message}
          interactive={seated && live.phase === "fighting"}
          finished={finished}
          winnerIsMe={finished ? iWon : null}
          statusLabel={statusLabel}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onBack={() => navigate("/games")}
          onCustomize={() => setShowCustomize(true)}
          onPunch={live.punch}
          onGuard={live.guard}
          onMove={live.move}
        />

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
          title="Boxing"
          subtitle={game.mode === "solo" ? "Solo vs Computer — real-time" : `You vs ${opponentName} — real-time`}
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
              if (!user) return;
              try {
                const g = await createSoloGame("boxing", user.id, { live: true });
                statsWritten.current = null;
                navigate(gameRoute("boxing", g.id), { replace: true });
                window.location.reload();
              } catch (e: any) {
                toast({ title: "Could not start a solo match", description: e.message, variant: "destructive" });
              }
            })();
          }}
          onQuickMatch={() => setPicker(true)}
        />

        {showCustomize && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCustomize(false)}>
            <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
              <p className="mb-3 text-center text-sm font-black text-white">Choose Your Fighter</p>

              <div className="mb-3 grid grid-cols-3 gap-2">
                {CHARACTERS.map((c) => {
                  const active = (myAppearance.character ?? "man") === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void setMyAppearance({ character: c.id, build: c.scale > 1.15 ? "heavy" : c.scale < 0.9 ? "lean" : "athletic", fem: Boolean(c.fem) })}
                      className={`rounded-xl border-2 px-1.5 py-2 text-[11px] font-black ${
                        active ? "border-primary bg-primary/20 text-white" : "border-white/10 bg-white/5 text-white/70"
                      }`}
                    >
                      <span className="block text-base leading-none">{c.emoji}</span>
                      <span className="mt-1 block leading-none">{c.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">Skin Tone</p>
              <div className="mb-1 flex flex-wrap gap-2">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => void setMyAppearance({ skin: tone })}
                    className="h-8 w-8 rounded-full border-2"
                    style={{ background: tone, borderColor: myAppearance.skin === tone ? "hsl(var(--primary))" : "transparent" }}
                    aria-label={`Skin tone ${tone}`}
                  />
                ))}
              </div>
              <p className="text-[9px] text-white/35">Robot and bear fighters use their own colors.</p>

              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                className="mt-4 w-full rounded-full bg-primary py-2 text-xs font-black text-primary-foreground"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      <GameResultCard
        open={finished}
        outcome={outcome}
        title={resultTitle}
        detail={resultDetail}
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
        title="Challenge to Boxing"
      />
    </LandscapeStage>
  );
}
