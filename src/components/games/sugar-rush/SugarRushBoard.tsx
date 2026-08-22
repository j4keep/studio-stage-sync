import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Volume2, VolumeX } from "lucide-react";
import {
  Board,
  CascadeResult,
  Cell,
  Pos,
  areAdjacent,
  findHintMove,
  generateBoard,
  hasLegalMove,
  reshuffleBoard,
  swapCells,
  trySwap,
} from "@/lib/sugar-rush";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";
import "./sugar-rush.css";
import sugarRushBgAsset from "@/assets/games/sugar-rush/sugar-rush-bg.jpg.asset.json";
import candySprite0Asset from "@/assets/games/sugar-rush/candy-0.png.asset.json";
import candySprite1Asset from "@/assets/games/sugar-rush/candy-1.png.asset.json";
import candySprite2Asset from "@/assets/games/sugar-rush/candy-2.png.asset.json";
import candySprite3Asset from "@/assets/games/sugar-rush/candy-3.png.asset.json";
import candySprite4Asset from "@/assets/games/sugar-rush/candy-4.png.asset.json";
import candySprite5Asset from "@/assets/games/sugar-rush/candy-5.png.asset.json";

/** Painterly candy-land backdrop for the game screen. */
export const sugarRushBg = sugarRushBgAsset.url;

const candySprite0 = candySprite0Asset.url;
const candySprite1 = candySprite1Asset.url;
const candySprite2 = candySprite2Asset.url;
const candySprite3 = candySprite3Asset.url;
const candySprite4 = candySprite4Asset.url;
const candySprite5 = candySprite5Asset.url;

/** Illustrated candy sprites, indexed by CandyColor (0 red … 5 purple). */
export const CANDY_SPRITES = [
  candySprite0,
  candySprite1,
  candySprite2,
  candySprite3,
  candySprite4,
  candySprite5,
];

export type SugarRushOutcome = {
  score: number;
  bestCascade: number;
  candiesCleared: number;
  won?: boolean;
};

type Mode =
  | { kind: "moves"; gridSize: number; moveLimit: number; targetScore: number }
  | { kind: "timed"; gridSize: number; seconds: number };

type Props = {
  mode: Mode;
  active: boolean;
  auto?: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  howToPlay: string[];
  headerLeft?: string;
  scoreLine?: string;
  onComplete: (outcome: SugarRushOutcome) => void;
};

const delay = (ms: number) => new Promise((res) => window.setTimeout(res, ms));
const cellKey = (p: Pos) => `${p.r}-${p.c}`;
const IDLE_HINT_MS = 6500;

/** The real illustrated treat for each color — a painterly sprite instead of a CSS shape, so
 *  the board reads as an actual pile of candy/cookies rather than colored dots. */
function CandyFace({ cell }: { cell: Cell }) {
  const sprite = CANDY_SPRITES[cell.color];

  if (cell.special === "bomb") {
    return (
      <div className="relative h-full w-full">
        <img src={sprite} alt="" className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]" draggable={false} />
        <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 14px 4px rgba(255,255,255,.55)" }} />
      </div>
    );
  }
  if (cell.special === "wrapped") {
    return (
      <div className="relative h-full w-full rounded-xl border-2 border-white/90 p-[8%]" style={{ boxShadow: "0 0 10px rgba(255,255,255,.4)" }}>
        <img src={sprite} alt="" className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]" draggable={false} />
      </div>
    );
  }
  if (cell.special === "striped-h" || cell.special === "striped-v") {
    return (
      <div className="relative h-full w-full">
        <img src={sprite} alt="" className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]" draggable={false} />
        <div
          className="pointer-events-none absolute inset-[10%] rounded-full mix-blend-screen"
          style={{
            background: cell.special === "striped-h"
              ? "repeating-linear-gradient(90deg, rgba(255,255,255,.9) 0 12%, transparent 12% 45%)"
              : "repeating-linear-gradient(0deg, rgba(255,255,255,.9) 0 12%, transparent 12% 45%)",
          }}
        />
      </div>
    );
  }
  return <img src={sprite} alt="" className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,.45)]" draggable={false} />;
}

const COMBO_LABELS = ["", "", "Sweet!", "Tasty Combo!", "Sugar Rush!", "Candy Storm!", "Incredible!"];

export default function SugarRushBoard({
  mode,
  active,
  auto = false,
  muted,
  onToggleMute,
  onBack,
  howToPlay,
  headerLeft,
  scoreLine,
  onComplete,
}: Props) {
  const [board, setBoard] = useState<Board>(() => generateBoard(mode.gridSize));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(mode.kind === "moves" ? mode.moveLimit : 0);
  const [timeLeft, setTimeLeft] = useState(mode.kind === "timed" ? mode.seconds : 0);
  const [help, setHelp] = useState(false);
  const [shaking, setShaking] = useState<Set<string>>(new Set());
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const [hintCells, setHintCells] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [comboMsg, setComboMsg] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [floaters, setFloaters] = useState<{ id: number; text: string; r: number; c: number }[]>([]);

  const bestCascadeRef = useRef(0);
  const clearedRef = useRef(0);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);
  const dragStart = useRef<{ pos: Pos; x: number; y: number } | null>(null);
  const autoTimer = useRef<number | null>(null);
  const floaterId = useRef(0);
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Background music plays through the round, muted by the same control as sfx.
  useEffect(() => {
    if (!active) return;
    sugarRushSfx.startMusic();
    return () => sugarRushSfx.stopMusic();
  }, [active]);

  const addFloater = useCallback((text: string, pos: Pos) => {
    const id = floaterId.current++;
    setFloaters((f) => [...f, { id, text, r: pos.r, c: pos.c }]);
    window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 950);
  }, []);

  const finish = useCallback((won?: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    sugarRushSfx.stopMusic();
    sugarRushSfx.buzzer();
    onComplete({ score: scoreRef.current, bestCascade: bestCascadeRef.current, candiesCleared: clearedRef.current, won });
  }, [onComplete]);

  useEffect(() => {
    if (mode.kind !== "timed" || !active) return;
    setTimeLeft(mode.seconds);
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(id);
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    setHintCells(new Set());
  }, []);

  const armIdleTimer = useCallback((currentBoard: Board) => {
    clearIdleTimer();
    if (auto || doneRef.current) return;
    idleTimer.current = window.setTimeout(() => {
      const hint = findHintMove(currentBoard);
      if (hint) setHintCells(new Set([cellKey(hint[0]), cellKey(hint[1])]));
    }, IDLE_HINT_MS);
  }, [auto, clearIdleTimer]);

  /** Runs a whole cascade chain step by step — highlight the match, pop it, let candies fall
   *  and refill, then check for the next link — instead of jumping straight to the settled
   *  board. This is the visible sequence the board must always show after a valid swap. */
  const playCascade = useCallback(async (result: CascadeResult) => {
    let comboDepth = 0;
    for (const step of result.steps) {
      comboDepth++;
      const keys = new Set(step.matchedCells.map(cellKey));
      setHighlighted(keys);
      await delay(140);

      setPopping(keys);
      sugarRushSfx.pop(comboDepth);
      if (comboDepth >= 2) sugarRushSfx.combo(comboDepth);
      if (step.matchedCells[0]) addFloater(`+${step.scoreGained}`, step.matchedCells[0]);
      setScore((s) => s + step.scoreGained);
      await delay(190);

      setBoard(step.boardAfterClear);
      setPopping(new Set());
      setHighlighted(new Set());
      await delay(70);

      setBoard(step.boardAfterSettle);
      sugarRushSfx.drop();
      await delay(340);
    }

    if (comboDepth >= 2) {
      const label = COMBO_LABELS[Math.min(comboDepth, COMBO_LABELS.length - 1)];
      if (label) {
        setComboMsg(label);
        window.setTimeout(() => setComboMsg(null), 900);
      }
    }

    bestCascadeRef.current = Math.max(bestCascadeRef.current, result.cascades);
    clearedRef.current += result.cleared;
  }, [addFloater]);

  const maybeReshuffle = useCallback(async (currentBoard: Board) => {
    if (hasLegalMove(currentBoard)) return currentBoard;
    setShuffling(true);
    sugarRushSfx.shuffle();
    await delay(500);
    const reshuffled = reshuffleBoard(currentBoard);
    setBoard(reshuffled);
    await delay(120);
    setShuffling(false);
    return reshuffled;
  }, []);

  const performSwap = useCallback((a: Pos, b: Pos) => {
    if (busy || doneRef.current) return;
    setBusy(true);
    clearIdleTimer();
    setSelected(null);

    const preSwapBoard = board;
    const visualSwap = swapCells(board, a, b);
    setBoard(visualSwap);
    sugarRushSfx.swap();

    window.setTimeout(() => {
      void (async () => {
        const outcome = trySwap(preSwapBoard, a, b);
        if (!outcome.valid) {
          sugarRushSfx.invalid();
          setShaking(new Set([cellKey(a), cellKey(b)]));
          await delay(220);
          setBoard(preSwapBoard);
          setShaking(new Set());
          setBusy(false);
          armIdleTimer(preSwapBoard);
          return;
        }

        await playCascade(outcome.result!);

        let settled = outcome.board;
        settled = await maybeReshuffle(settled);

        if (mode.kind === "moves") {
          setMovesLeft((m) => {
            const next = m - 1;
            if (next <= 0) {
              window.setTimeout(() => finish(scoreRef.current >= mode.targetScore), 300);
            }
            return next;
          });
        }
        setBusy(false);
        armIdleTimer(settled);
      })();
    }, 170);
  }, [board, busy, clearIdleTimer, armIdleTimer, playCascade, maybeReshuffle, finish, mode]);

  const attemptSwap = useCallback((a: Pos, b: Pos) => {
    if (!areAdjacent(a, b)) return;
    performSwap(a, b);
  }, [performSwap]);

  // Computer auto-play for the versus AI turn: pick a random legal-looking adjacent pair
  // every second or so until time runs out.
  useEffect(() => {
    if (!auto || !active) return;
    const tryRandomSwap = () => {
      if (busy || doneRef.current) return;
      const size = board.length;
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const dir = Math.random() < 0.5 ? { r: r, c: c + 1 } : { r: r + 1, c };
      if (dir.r < size && dir.c < size) attemptSwap({ r, c }, dir);
    };
    autoTimer.current = window.setInterval(tryRandomSwap, 650);
    return () => {
      if (autoTimer.current) window.clearInterval(autoTimer.current);
    };
  }, [auto, active, board, busy, attemptSwap]);

  // Start the idle-hint clock once the board is first playable.
  useEffect(() => {
    if (!active || auto) return;
    armIdleTimer(board);
    return clearIdleTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, auto]);

  const canInput = active && !auto && !busy && !doneRef.current;

  const cellDown = (r: number, c: number, e: React.PointerEvent) => {
    if (!canInput) return;
    clearIdleTimer();
    dragStart.current = { pos: { r, c }, x: e.clientX, y: e.clientY };
  };

  const cellUp = (r: number, c: number, e: React.PointerEvent) => {
    if (!canInput || !dragStart.current) return;
    const start = dragStart.current;
    dragStart.current = null;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 18) {
      const target: Pos = Math.abs(dx) > Math.abs(dy)
        ? { r: start.pos.r, c: start.pos.c + (dx > 0 ? 1 : -1) }
        : { r: start.pos.r + (dy > 0 ? 1 : -1), c: start.pos.c };
      if (target.r >= 0 && target.r < board.length && target.c >= 0 && target.c < board[0].length) {
        attemptSwap(start.pos, target);
      } else {
        armIdleTimer(board);
      }
      setSelected(null);
    } else if (selected && areAdjacent(selected, { r, c })) {
      attemptSwap(selected, { r, c });
      setSelected(null);
    } else {
      setSelected({ r, c });
      armIdleTimer(board);
    }
  };

  const size = board.length;
  const progressLabel = mode.kind === "moves"
    ? `${movesLeft} move${movesLeft === 1 ? "" : "s"} left`
    : `${timeLeft}s`;

  return (
    <div
      className="relative flex h-full w-full flex-col bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(30,10,50,.18), rgba(20,8,40,.55)), url(${sugarRushBg})`,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <button type="button" onClick={onBack} aria-label="Back" className="shrink-0 rounded-full bg-black/30 p-2 text-white active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 rounded-2xl bg-black/25 px-3 py-1.5 text-center">
          {headerLeft && <p className="truncate text-[10px] font-black uppercase tracking-wide text-white/70">{headerLeft}</p>}
          <p className="text-lg font-black text-white">{score.toLocaleString()}</p>
          {scoreLine && <p className="text-[10px] font-bold text-white/60">{scoreLine}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-black/30 px-2.5 py-1.5 text-[11px] font-black text-white">{progressLabel}</span>
          <button type="button" onClick={onToggleMute} aria-label="Toggle sound" className="rounded-full bg-black/30 p-2 text-white active:scale-95">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setHelp((v) => !v)} aria-label="How to play" className="rounded-full bg-black/30 p-2 text-white active:scale-95">
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {help && (
        <ul className="mx-3 mt-2 space-y-1 rounded-2xl bg-black/35 p-3 text-[11px] text-white/85">
          {howToPlay.map((l) => <li key={l}>• {l}</li>)}
        </ul>
      )}

      <div className="relative flex flex-1 items-center justify-center p-3">
        {comboMsg && (
          <div className="pointer-events-none absolute top-[18%] z-20 sr-combo-pop">
            <p
              className="text-2xl font-black uppercase tracking-wide text-white"
              style={{ textShadow: "0 0 16px rgba(255,150,60,.9), 0 3px 0 rgba(0,0,0,.4)" }}
            >
              {comboMsg}
            </p>
          </div>
        )}

        <div
          className="relative w-full max-w-[420px] rounded-[26px] p-2"
          style={{
            background: "linear-gradient(160deg, #ffd9a8 0%, #f0a94e 55%, #c97a1f 100%)",
            boxShadow: "0 14px 30px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.6)",
          }}
        >
          <div
            className={`grid aspect-square gap-[3px] overflow-hidden rounded-[20px] p-2 touch-none select-none ${shuffling ? "sr-shuffle-spin" : ""}`}
            style={{
              gridTemplateColumns: `repeat(${size}, 1fr)`,
              background: "linear-gradient(160deg, #241247 0%, #170b30 100%)",
              boxShadow: "inset 0 3px 10px rgba(0,0,0,.6)",
            }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const key = cellKey({ r, c });
                const isSelected = selected?.r === r && selected?.c === c;
                const isShaking = shaking.has(key);
                const isHighlighted = highlighted.has(key);
                const isPopping = popping.has(key);
                const isHinted = hintCells.has(key);
                const checker = (r + c) % 2 === 0;
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => cellDown(r, c, e)}
                    onPointerUp={(e) => cellUp(r, c, e)}
                    className={`relative aspect-square rounded-md ${isSelected ? "ring-2 ring-white/90" : ""} ${isShaking ? "sr-shake" : ""} ${isHighlighted ? "ring-2 ring-yellow-200" : ""} ${isHinted ? "sr-hint-pulse" : ""}`}
                    style={{ background: checker ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)" }}
                  >
                    {cell && (
                      <div key={cell.id} className={`absolute inset-[7%] sr-candy-fall ${isPopping ? "sr-pop" : ""}`}>
                        <CandyFace cell={cell} />
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>

          {floaters.map((f) => (
            <div
              key={f.id}
              className="pointer-events-none absolute z-30 sr-float-up text-sm font-black text-yellow-200"
              style={{
                left: `${((f.c + 0.5) / size) * 100}%`,
                top: `${((f.r + 0.5) / size) * 100}%`,
                textShadow: "0 2px 4px rgba(0,0,0,.6)",
              }}
            >
              {f.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
