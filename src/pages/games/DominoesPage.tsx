import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layers, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import GameShellPro from "@/components/games/pro/GameShellPro";
import DominoTile from "@/components/games/pro/DominoTile";
import PlayerPod from "@/components/games/pro/PlayerPod";
import GameResultCard from "@/components/games/pro/GameResultCard";
import { useTurnGame } from "@/hooks/use-turn-game";
import {
  DomState,
  dominoesComputerTurn,
  dominoesResult,
  drawOrPass,
  ends,
  initialDominoes,
  pipTotal,
  playTile,
  playableTiles,
} from "@/lib/dominoes";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

const HOW_TO_PLAY = [
  "Match one half of your tile to an open end of the chain.",
  "Tap a glowing tile, then pick the left or right end when both fit.",
  "No playable tile? Draw from the boneyard, or pass when it is empty.",
  "First player out of tiles wins. If the board blocks, the lowest pip total wins.",
];

export default function DominoesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName, opponentAvatar } = useTurnGame(
    id,
    user?.id,
  );
  const written = useRef<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState("You");

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

  const dom: DomState = (game?.game_state?.dom as DomState) || initialDominoes();
  const moveNumber: number = game?.game_state?.moveNumber ?? 0;
  const mySeat: 0 | 1 = ((me?.seat ?? 1) === 1 ? 0 : 1) as 0 | 1;
  const oppSeat: 0 | 1 = mySeat === 0 ? 1 : 0;
  const result = dominoesResult(dom);
  const finished = result !== null;
  const myTurn = game?.status === "active" && game.current_turn_user_id === user?.id && !finished;
  const myHand = dom.hands[mySeat] || [];
  const playable = playableTiles(dom, mySeat);
  const e = ends(dom);

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [dom.layout.length]);

  useEffect(() => {
    setSelected(null);
  }, [dom.layout.length, myTurn]);

  useEffect(() => {
    if (!game || !user || !finished || written.current === game.id) return;
    written.current = game.id;
    if (game.status === "completed") return;
    const draw = result === "draw";
    const iWon = result === mySeat;
    void (async () => {
      await updateGameState(game.id, {
        status: "completed",
        is_draw: draw,
        winner_user_id: draw ? null : iWon ? user.id : (opponent?.user_id ?? null),
        finished_at: new Date().toISOString(),
      });
      await bumpStats(user.id, "dominoes", draw ? "draw" : iWon ? "win" : "loss");
      await refresh();
    })();
  }, [finished, game?.id, game?.status]);

  const advance = async (state: DomState, moves: number) => {
    if (!game || !user) return;
    let next = state;
    let n = moveNumber + moves;
    let nextTurn = opponent?.user_id ?? null;

    if (game.mode === "solo") {
      let guard = 0;
      while (dominoesResult(next) === null && next.turn === oppSeat && guard < 30) {
        next = dominoesComputerTurn(next);
        n += 1;
        guard += 1;
      }
      nextTurn = user.id;
    }

    setGame({ ...game, game_state: { dom: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await updateGameState(game.id, { game_state: { dom: next, moveNumber: n }, current_turn_user_id: nextTurn });
    await refresh();
  };

  const play = async (handIndex: number, side: "left" | "right") => {
    if (!game || !user || !myTurn) return;
    setSelected(null);
    const next = playTile(dom, mySeat, handIndex, side);
    await recordMove(game.id, user.id, moveNumber + 1, { tile: dom.hands[mySeat][handIndex], side });
    await advance(next, 1);
  };

  const tapTile = (i: number) => {
    if (!myTurn || !playable.includes(i)) return;
    const tile = myHand[i];
    if (!e) {
      void play(i, "right");
      return;
    }
    const fitsLeft = tile.includes(e[0]);
    const fitsRight = tile.includes(e[1]);
    if (fitsLeft && fitsRight && e[0] !== e[1]) {
      setSelected((prev) => (prev === i ? null : i));
      return;
    }
    void play(i, fitsRight ? "right" : "left");
  };

  const draw = async () => {
    if (!game || !user || !myTurn) return;
    const next = drawOrPass(dom, mySeat);
    await recordMove(game.id, user.id, moveNumber + 1, { action: dom.pile.length ? "draw" : "pass" });
    await advance(next, 1);
  };

  const rematch = async () => {
    if (!user || !game) return;
    try {
      const state = { dom: initialDominoes(), moveNumber: 0 };
      const g =
        game.mode === "solo"
          ? await createSoloGame("dominoes", user.id, state)
          : opponent?.user_id
            ? await createMultiplayerGame("dominoes", user.id, opponent.user_id, state)
            : null;
      if (g) navigate(gameRoute("dominoes", g.id), { replace: true });
    } catch (err: any) {
      toast({ title: "Could not start a rematch", description: err.message, variant: "destructive" });
    }
  };

  const challenge = async (opponentId: string, name: string) => {
    if (!user) return;
    try {
      const g = await createMultiplayerGame("dominoes", user.id, opponentId, {
        dom: initialDominoes(),
        moveNumber: 0,
      });
      toast({ title: `Challenge sent to ${name}` });
      navigate(gameRoute("dominoes", g.id), { replace: true });
    } catch (err: any) {
      toast({ title: "Could not send the challenge", description: err.message, variant: "destructive" });
    }
  };

  const shareResult = async () => {
    const text = `I just ${result === "draw" ? "tied" : result === mySeat ? "won" : "lost"} a game of Dominoes on YAJ 🁫`;
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
        <p className="font-bold">This game is no longer available.</p>
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

  const turnLabel =
    game.status === "waiting"
      ? "Waiting"
      : game.status === "cancelled"
        ? "Declined"
        : finished
          ? result === "draw"
            ? "Draw"
            : result === mySeat
              ? "You won"
              : "You lost"
          : myTurn
            ? "Your turn"
            : game.mode === "solo"
              ? "Computer's turn"
              : `${opponentName}'s turn`;

  const boardInfo = e ? `Board · Open ends ${e[0]} and ${e[1]}` : "Board · Play any tile";

  const outcome: "win" | "loss" | "draw" = result === "draw" ? "draw" : result === mySeat ? "win" : "loss";
  const resultTitle =
    outcome === "draw" ? "It's a draw" : outcome === "win" ? "You won!" : `${game.mode === "solo" ? "Computer" : opponentName} won`;
  const resultDetail = finished
    ? `Final pips — you ${pipTotal(dom.hands[mySeat] || [])} · ${game.mode === "solo" ? "Computer" : opponentName} ${pipTotal(dom.hands[oppSeat] || [])}`
    : undefined;

  return (
    <GameShellPro
      title="Dominoes"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      turnLabel={turnLabel}
      turnActive={!!myTurn}
      boardInfo={boardInfo}
      howToPlay={HOW_TO_PLAY}
      pickerOpen={picker}
      onPickerChange={setPicker}
      onChallenge={challenge}
    >
      {/* Wooden-rim oval table */}
      <div
        className="rounded-[36px] p-3"
        style={{
          background:
            "linear-gradient(160deg, #8a5a2b 0%, #5d3a19 40%, #7a4d24 70%, #4a2d13 100%)",
          boxShadow:
            "0 0 30px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -3px 6px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[28px] px-2 py-3"
          style={{
            background:
              "radial-gradient(75% 60% at 50% 40%, #2f7d52 0%, #1f5d3c 55%, #14402a 100%)",
            boxShadow: "inset 0 0 34px rgba(0,0,0,0.55), inset 0 2px 4px rgba(0,0,0,0.6)",
          }}
        >
          {/* Opponent pod + face-down rack */}
          <div className="flex items-center justify-between gap-2 px-1">
            <PlayerPod
              name={game.mode === "solo" ? "Computer" : opponentName}
              avatarUrl={game.mode === "solo" ? null : opponentAvatar}
              isComputer={game.mode === "solo"}
              count={dom.hands[oppSeat]?.length ?? 0}
              active={!myTurn && !finished && game.status === "active"}
            />
            <div className="flex gap-0.5 overflow-hidden">
              {Array.from({ length: Math.min(dom.hands[oppSeat]?.length ?? 0, 7) }).map((_, i) => (
                <DominoTile key={i} faceDown size="sm" orientation="vertical" />
              ))}
            </div>
          </div>

          {/* Chain */}
          <div
            ref={boardRef}
            className="mt-3 flex min-h-[150px] items-center gap-1 overflow-x-auto px-2"
            style={{ scrollbarWidth: "none" }}
          >
            {dom.layout.length ? (
              dom.layout.map((t, i) => (
                <DominoTile
                  key={`${t[0]}-${t[1]}-${i}`}
                  tile={t}
                  size="md"
                  orientation={t[0] === t[1] ? "vertical" : "horizontal"}
                  className="animate-scale-in"
                />
              ))
            ) : (
              <p className="w-full text-center text-xs font-bold text-white/60">
                Empty table — play your first tile
              </p>
            )}
          </div>

          {/* Boneyard medallion + you pod */}
          <div className="mt-3 flex items-end justify-between gap-2 px-1">
            <div
              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5"
              style={{
                background: "linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.3))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              <Layers className="h-4 w-4 text-[#f0d78c]" />
              <div className="text-left leading-tight">
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/60">Boneyard</p>
                <p className="text-xs font-black text-white">{dom.pile.length}</p>
              </div>
            </div>

            <PlayerPod name={myName} avatarUrl={myAvatar} count={myHand.length} active={!!myTurn} />
          </div>

          {/* Player hand on the felt */}
          <div
            className="mt-2 flex gap-1.5 overflow-x-auto rounded-2xl px-2 py-2"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0.12))",
              scrollbarWidth: "none",
            }}
          >
            {myHand.map((t, i) => {
              const ok = myTurn && playable.includes(i);
              return (
                <DominoTile
                  key={`${t[0]}-${t[1]}-${i}`}
                  tile={t}
                  size="lg"
                  glow={ok}
                  dim={!ok}
                  selected={selected === i}
                  onClick={ok ? () => tapTile(i) : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>

      {selected !== null && e ? (
        <div className="mt-3 flex items-center gap-2 animate-fade-in">
          <button
            type="button"
            onClick={() => play(selected, "left")}
            className="flex-1 rounded-full border border-primary/50 bg-primary/15 px-4 py-3 text-sm font-black text-primary active:scale-[0.98]"
          >
            Play on left ({e[0]})
          </button>
          <button
            type="button"
            onClick={() => play(selected, "right")}
            className="flex-1 rounded-full border border-primary/50 bg-primary/15 px-4 py-3 text-sm font-black text-primary active:scale-[0.98]"
          >
            Play on right ({e[1]})
          </button>
        </div>
      ) : (
        <p className="mt-2 text-center text-[11px] text-white/60">
          {myTurn ? "Tap a glowing tile to play it on an open end" : "Waiting for the next move"}
        </p>
      )}

      {myTurn && !playable.length && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={draw}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground active:scale-[0.98]"
          >
            {dom.pile.length ? "Draw a tile" : "Pass"}
          </button>
        </div>
      )}


      <GameResultCard
        open={finished}
        outcome={outcome}
        title={resultTitle}
        detail={resultDetail}
        onRematch={rematch}
        onChallenge={() => setPicker(true)}
        onShare={shareResult}
      />
    </GameShellPro>
  );
}
