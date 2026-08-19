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
import { Action, Appearance, BoxingState, DEFAULT_APPEARANCE, Seat, computerAction, initialBoxing, resolveAction } from "@/lib/boxing";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const OPP_DEFAULT_APPEARANCE: Appearance = { skin: SKIN_TONES[3], build: "athletic", fem: false, character: "man" };

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
  const boxingRef = useRef<BoxingState>(initialBoxing());

  const [seated, setSeated] = useState(false);
  const [picker, setPicker] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [muted, setMuted] = useState(false);
  const [myName, setMyName] = useState("You");
  const [myAvatar, setMyAvatar] = useState<string | null>(null);

  const { stats, matchups } = useGameRecord("boxing", user?.id, finishedDep(game));

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

  const boxing: BoxingState = (game?.game_state?.boxing as BoxingState) || initialBoxing();
  boxingRef.current = boxing;
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: Seat = ((me?.seat ?? 1) === 1 ? 0 : 1) as Seat;
  const oppSeat: Seat = mySeat === 0 ? 1 : 0;
  const finished = boxing.phase === "over";
  const myTurn = game?.status === "active" && !finished && boxing.turnSeat === mySeat;

  const appearanceMap = (game?.game_state?.appearance as Record<number, Appearance>) || {};
  const myAppearance: Appearance = appearanceMap[mySeat] || DEFAULT_APPEARANCE;
  const oppAppearance: Appearance = appearanceMap[oppSeat] || OPP_DEFAULT_APPEARANCE;

  // Persist stats once when a match finishes.
  useEffect(() => {
    if (!game || !user || !finished || statsWritten.current === game.id) return;
    if (game.status === "completed") {
      statsWritten.current = game.id;
      return;
    }
    statsWritten.current = game.id;
    const draw = boxing.winnerSeat === null;
    const iWon = boxing.winnerSeat === mySeat;
    const outcome = draw ? "draw" : iWon ? "win" : "loss";
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "boxing", outcome);
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const commit = async (state: BoxingState, n: number, nextTurnUserId: string | null) => {
    if (!game || !user) return;
    const nextGameState = { ...game.game_state, boxing: state, moveNumber: n };
    setGame({ ...game, game_state: nextGameState, current_turn_user_id: nextTurnUserId });
    await updateGameState(game.id, { game_state: nextGameState, current_turn_user_id: nextTurnUserId });
    await refresh();
  };

  const applyAction = async (action: Action) => {
    if (!game || !user || !myTurn) return;
    const next = resolveAction(boxing, mySeat, action);
    const n = moveNumber + 1;
    await recordMove(game.id, user.id, n, { action, seat: mySeat });
    const nextTurnUserId = game.mode === "solo" ? user.id : (opponent?.user_id ?? null);
    await commit(next, n, nextTurnUserId);
  };

  const setMyAppearance = async (partial: Partial<Appearance>) => {
    if (!game || !user) return;
    const nextAppearance = { ...appearanceMap, [mySeat]: { ...myAppearance, ...partial } };
    const nextGameState = { ...game.game_state, appearance: nextAppearance };
    setGame({ ...game, game_state: nextGameState });
    await updateGameState(game.id, { game_state: nextGameState });
  };

  // Drive the computer's turn in solo mode — delayed so the human's own punch animates first.
  useEffect(() => {
    if (!game || game.mode !== "solo" || finished) return;
    if (boxing.turnSeat !== oppSeat) return;
    const t = window.setTimeout(() => {
      if (!user) return;
      const state = boxingRef.current;
      const action = computerAction(state, oppSeat);
      const next = resolveAction(state, oppSeat, action);
      void commit(next, moveNumber + 1, user.id);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [game?.id, boxing.turnSeat, finished, moveNumber]);

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { boxing: initialBoxing(), moveNumber: 0, appearance: { [mySeat]: myAppearance } };
      const g =
        game.mode === "solo"
          ? await createSoloGame("boxing", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("boxing", user.id, opponent.user_id, state)
            : null;
      if (g) {
        statsWritten.current = null;
        navigate(gameRoute("boxing", g.id), { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Could not start a rematch", description: e.message, variant: "destructive" });
    }
  };

  const challengeOther = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("boxing", user.id, opponentId, {
        boxing: initialBoxing(),
        moveNumber: 0,
        appearance: { 0: myAppearance },
      });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("boxing", g.id), { replace: true });
    } catch (e: any) {
      toast({ title: "Could not send the challenge", description: e.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const draw = boxing.winnerSeat === null;
    const iWon = boxing.winnerSeat === mySeat;
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
  const draw = finished && boxing.winnerSeat === null;
  const iWon = finished && boxing.winnerSeat === mySeat;
  const outcome: "win" | "loss" | "draw" = draw ? "draw" : iWon ? "win" : "loss";

  const turnLabel =
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
          : myTurn
            ? "Your turn"
            : `${oppLabel}'s turn`;

  const resultTitle = draw ? "Goes the distance" : iWon ? "Victory by knockout!" : `${oppLabel} wins`;
  const resultDetail = finished
    ? `Final health — you ${Math.round(boxing.boxers[mySeat].health)} · ${oppLabel} ${Math.round(boxing.boxers[oppSeat].health)}`
    : undefined;

  return (
    <LandscapeStage auto>
      <div className="relative h-full w-full">
        <BoxingRing
          myName={myName}
          myAppearance={myAppearance}
          myHealth={boxing.boxers[mySeat].health}
          myStamina={boxing.boxers[mySeat].stamina}
          oppName={oppLabel}
          oppAppearance={oppAppearance}
          isComputer={game.mode === "solo"}
          oppHealth={boxing.boxers[oppSeat].health}
          oppStamina={boxing.boxers[oppSeat].stamina}
          lastAction={boxing.lastAction ? { ...boxing.lastAction, seat: boxing.lastAction.seat === mySeat ? 0 : 1 } : null}
          interactive={Boolean(myTurn) && seated}
          finished={finished}
          winnerIsMe={finished ? iWon : null}
          turnLabel={turnLabel}
          myTurn={Boolean(myTurn)}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onBack={() => navigate("/games")}
          onCustomize={() => setShowCustomize(true)}
          onAction={(action) => void applyAction(action)}
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
          subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
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
                const g = await createSoloGame("boxing", user.id, { boxing: initialBoxing(), moveNumber: 0 });
                statsWritten.current = null;
                navigate(gameRoute("boxing", g.id), { replace: true });
              } catch (e: any) {
                toast({ title: "Could not start a solo match", description: e.message, variant: "destructive" });
              }
            })();
          }}
          onQuickMatch={() => setPicker(true)}
        />

        {showCustomize && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowCustomize(false)}
          >
            <div className="w-full max-w-xs rounded-2xl bg-[#11151f] p-4" onClick={(e) => e.stopPropagation()}>
              <p className="mb-3 text-center text-sm font-black text-white">Customize Your Fighter</p>

              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">Skin Tone</p>
              <div className="mb-3 flex gap-2">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => void setMyAppearance({ skin: tone })}
                    className="h-9 w-9 rounded-full border-2"
                    style={{ background: tone, borderColor: myAppearance.skin === tone ? "hsl(var(--primary))" : "transparent" }}
                    aria-label={`Skin tone ${tone}`}
                  />
                ))}
              </div>

              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">Build</p>
              <div className="mb-3 flex gap-2">
                {(["lean", "athletic", "heavy"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => void setMyAppearance({ build: b })}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-black capitalize ${
                      myAppearance.build === b ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/70"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">Presenting Fem</p>
                <button
                  type="button"
                  onClick={() => void setMyAppearance({ fem: !myAppearance.fem })}
                  className={`h-6 w-11 rounded-full p-0.5 transition-colors ${myAppearance.fem ? "bg-primary" : "bg-white/15"}`}
                  aria-label="Toggle presenting fem"
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white transition-transform ${myAppearance.fem ? "translate-x-5" : ""}`}
                  />
                </button>
              </div>

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

function finishedDep(game: any) {
  return game?.game_state?.boxing?.phase === "over";
}
