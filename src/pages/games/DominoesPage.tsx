import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import GameShell from "@/components/games/GameShell";
import { useTurnGame } from "@/hooks/use-turn-game";
import {
  DomState,
  Tile,
  dominoesComputerTurn,
  dominoesResult,
  drawOrPass,
  ends,
  initialDominoes,
  playTile,
  playableTiles,
} from "@/lib/dominoes";
import { bumpStats, createMultiplayerGame, createSoloGame, recordMove, updateGameState } from "@/lib/games";
import { gameRoute } from "@/lib/game-routes";

function TileView({ tile, onClick, disabled }: { tile: Tile; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-16 w-9 flex-col items-center justify-center rounded-lg border-2 border-neutral-300 bg-white text-sm font-black text-neutral-900 shadow-sm ${
        disabled ? "opacity-40" : "active:scale-95"
      }`}
    >
      <span>{tile[0]}</span>
      <span className="my-0.5 h-[2px] w-5 bg-neutral-300" />
      <span>{tile[1]}</span>
    </button>
  );
}

export default function DominoesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { game, setGame, loading, refresh, me, opponent, opponentName } = useTurnGame(id, user?.id);
  const written = useRef<string | null>(null);

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
    const next = playTile(dom, mySeat, handIndex, side);
    await recordMove(game.id, user.id, moveNumber + 1, { tile: dom.hands[mySeat][handIndex], side });
    await advance(next, 1);
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
        <button type="button" onClick={() => navigate("/games")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to Games
        </button>
      </div>
    );
  }

  const status = game.status === "waiting"
    ? `Waiting for ${opponentName} to accept`
    : game.status === "cancelled"
      ? "Challenge declined"
      : result === "draw"
        ? "Blocked — it's a draw"
        : result !== null
          ? result === mySeat ? "Victory — you win!" : `${opponentName} wins`
          : myTurn ? "Your turn" : `${opponentName}'s turn`;

  return (
    <GameShell
      title="Dominoes"
      subtitle={game.mode === "solo" ? "Solo vs Computer" : `You vs ${opponentName}`}
      status={status}
      finished={finished}
      shareText={`I just ${result === "draw" ? "tied" : result === mySeat ? "won" : "lost"} a game of Dominoes on YAJ 🁫`}
      onRematch={rematch}
      onChallenge={challenge}
    >
      <div className="rounded-2xl border border-border bg-[hsl(215_45%_18%)] p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary-foreground/70">
          Board {e ? `· open ends ${e[0]} and ${e[1]}` : "· play any tile"}
        </p>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {dom.layout.length ? (
            dom.layout.map((t, i) => (
              <div
                key={`${t[0]}-${t[1]}-${i}`}
                className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-black text-neutral-900"
              >
                <span>{t[0]}</span>
                <span className="h-4 w-[2px] bg-neutral-300" />
                <span>{t[1]}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-primary-foreground/70">Empty board</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{opponentName}: {dom.hands[oppSeat]?.length ?? 0} tiles</span>
        <span>Boneyard: {dom.pile.length}</span>
      </div>

      <p className="mt-4 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">Your hand</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {myHand.map((t, i) => {
          const ok = myTurn && playable.includes(i);
          return (
            <div key={`${t[0]}-${t[1]}-${i}`} className="flex flex-col items-center gap-1">
              <TileView tile={t} disabled={!ok} onClick={() => ok && play(i, "right")} />
              {ok && e && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => play(i, "left")}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] font-black"
                  >
                    L
                  </button>
                  <button
                    type="button"
                    onClick={() => play(i, "right")}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] font-black"
                  >
                    R
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {myTurn && !playable.length && (
        <button
          type="button"
          onClick={draw}
          className="mt-4 w-full rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground"
        >
          {dom.pile.length ? "Draw a tile" : "Pass"}
        </button>
      )}
    </GameShell>
  );
}
