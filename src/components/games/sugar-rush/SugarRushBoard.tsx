{ useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Volume2, VolumeX } from "lucide-react";
import {
  BASE_POINTS,
  Board,
  Cell,
  Pos,
  activateSpimportecial,
  applyGravity,
  areAdjacent,
  findLegalSwap,
  findMatches,
  generateBoard,
  hasLegalMove,
  refill,
  resolveCascadeStep,
  swapCells,
} from "@/lib/sugar-rush";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";
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

type SwapAnimation = {
  a: Pos;
  b: Pos;
  phase: "forward" | "back";
};

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const posKey = ({ r, c }: Pos) => `${r}-${c}`;

/** The real illustrated treat for each color — a painterly sprite instead of a CSS shape. */
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
  const [board, setBoardState] = useState<Board>(() => generateBoard(mode.gridSize));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(mode.kind === "moves" ? mode.moveLimit : 0);
  const [timeLeft, setTimeLeft] = useState(mode.kind === "timed" ? mode.seconds : 0);
  const [help, setHelp] = useState(false);
  const [shake, setShake] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapAnimation, setSwapAnimation] = useState<SwapAnimation | null>(null);
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const [hinting, setHinting] = useState<Set<string>>(new Set());
  const [comboText, setComboText] = useState<string | null>(null);
  const [scoreBurst, setScoreBurst] = useState<string | null>(null);
  const [reshuffling, setReshuffling] = useState(false);

  const boardRef = useRef(board);
  const bestCascadeRef = useRef(0);
  const clearedRef = useRef(0);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);
  const dragStart = useRef<{ pos: Pos; x: number; y: number; pointerId: number } | null>(null);
  const autoTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);

  const setBoard = useCallback((next: Board) => {
    boardRef.current = next;
    setBoardState(next);
  }, []);

  const addScore = useCallback((points: number) => {
    if (points <= 0) return;
    scoreRef.current += points;
    setScore(scoreRef.current);
    setScoreBurst(`+${points.toLocaleString()}`);
    window.setTimeout(() => setScoreBurst(null), 650);
  }, []);

  const finish = useCallback((won?: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    sugarRushSfx.buzzer();
    onComplete({ score: scoreRef.current, bestCascade: bestCascadeRef.current, candiesCleared: clearedRef.current, won });
  }, [onComplete]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Timed rounds count down while the board is live.
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

  const animateGravityAndRefill = useCallback(async (clearedBoard: Board) => {
    setBoard(clearedBoard);
    await sleep(70);

    const fallen = applyGravity(clearedBoard);
    setBoard(fallen);
    await sleep(240);

    const filled = refill(fallen);
    setBoard(filled);
    await sleep(330);
    return filled;
  }, [setBoard]);

  const runVisibleCascades = useCallback(async (startBoard: Board, startDepth = 1) => {
    let current = startBoard;
    let depth = startDepth;
    let totalCleared = 0;
    let deepest = 0;

    while (!doneRef.current) {
      const step = resolveCascadeStep(current, depth);
      if (!step) break;

      deepest = Math.max(deepest, depth);
      totalCleared += step.cleared;
      setPopping(new Set(step.matched.map(posKey)));
      setComboText(depth === 1 ? null : depth === 2 ? "Sweet!" : depth === 3 ? "Sugar Rush!" : "Amazing!" );
      if (depth >= 2) sugarRushSfx.special();
      else sugarRushSfx.pop(depth);
      addScore(step.scoreGained);

      await sleep(230);
      setPopping(new Set());
      current = await animateGravityAndRefill(step.board);
      depth++;
    }

    if (deepest >= 2) {
      await sleep(120);
      setComboText(null);
    }

    return { board: current, cascades: deepest, cleared: totalCleared };
  }, [addScore, animateGravityAndRefill]);

  const performSwap = useCallback(async (a: Pos, b: Pos) => {
    if (busy || doneRef.current) return;
    const currentBoard = boardRef.current;
    setBusy(true);
    setSelected(null);
    setHinting(new Set());

    // First animate the two candies physically crossing into one another's cells.
    setSwapAnimation({ a, b, phase: "forward" });
    sugarRushSfx.swap();
    await sleep(155);

    const swapped = swapCells(currentBoard, a, b);
    const atA = swapped[a.r][a.c];
    const atB = swapped[b.r][b.c];
    const hasSpecial = Boolean(atA?.special || atB?.special);
    const createsMatch = findMatches(swapped).length > 0;

    if (!hasSpecial && !createsMatch) {
      sugarRushSfx.invalid();
      setSwapAnimation({ a, b, phase: "back" });
      setShake(posKey(a));
      await sleep(170);
      setSwapAnimation(null);
      setShake(null);
      setBusy(false);
      return;
    }

    setBoard(swapped);
    setSwapAnimation(null);
    await sleep(45);

    let working = swapped;
    let specialCleared = 0;
    let cascadeStartDepth = 1;

    if (hasSpecial) {
      // Specials clear visibly first, then gravity/refill can trigger normal automatic cascades.
      const before = working;
      if (atA?.special) {
        const result = activateSpecial(working, a, atA);
        working = result.board;
        specialCleared += result.cleared;
      }
      if (atB?.special) {
        const result = activateSpecial(working, b, atB);
        working = result.board;
        specialCleared += result.cleared;
      }

      const clearedPositions: Pos[] = [];
      for (let r = 0; r < before.length; r++) {
        for (let c = 0; c < before[r].length; c++) {
          if (before[r][c] && !working[r][c]) clearedPositions.push({ r, c });
        }
      }
      setPopping(new Set(clearedPositions.map(posKey)));
      sugarRushSfx.special();
      addScore(specialCleared * BASE_POINTS);
      await sleep(260);
      setPopping(new Set());
      working = await animateGravityAndRefill(working);
      cascadeStartDepth = 2;
    }

    const cascaded = await runVisibleCascades(working, cascadeStartDepth);
    working = cascaded.board;
    const totalCleared = specialCleared + cascaded.cleared;
    const cascadeCount = hasSpecial ? Math.max(1, cascaded.cascades) : cascaded.cascades;

    bestCascadeRef.current = Math.max(bestCascadeRef.current, cascadeCount);
    clearedRef.current += totalCleared;

    // If a cascade leaves the board with no possible move, automatically mix it up rather
    // than leaving the user staring at a dead board.
    if (!doneRef.current && !hasLegalMove(working)) {
      setReshuffling(true);
      setComboText("Mixing it up!");
      await sleep(500);
      working = generateBoard(mode.gridSize);
      setBoard(working);
      await sleep(360);
      setReshuffling(false);
      setComboText(null);
    }

    if (mode.kind === "moves") {
      setMovesLeft((m) => {
        const next = m - 1;
        if (next <= 0) {
          window.setTimeout(() => finish(scoreRef.current >= mode.targetScore), 350);
        }
        return next;
      });
    }

    setBusy(false);
  }, [animateGravityAndRefill, busy, finish, mode, runVisibleCascades, setBoard]);

  const attemptSwap = useCallback((a: Pos, b: Pos) => {
    if (!areAdjacent(a, b)) return;
    void performSwap(a, b);
  }, [performSwap]);

  // Computer auto-play for versus AI: choose legal-looking adjacent pairs continuously.
  useEffect(() => {
    if (!auto || !active) return;
    const tryRandomSwap = () => {
      if (busy || doneRef.current) return;
      const current = boardRef.current;
      const legal = findLegalSwap(current);
      if (legal && Math.random() < 0.75) {
        attemptSwap(legal.a, legal.b);
        return;
      }
      const size = current.length;
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const dir = Math.random() < 0.5 ? { r, c: c + 1 } : { r: r + 1, c };
      if (dir.r < size && dir.c < size) attemptSwap({ r, c }, dir);
    };
    autoTimer.current = window.setInterval(tryRandomSwap, 900);
    return () => {
      if (autoTimer.current) window.clearInterval(autoTimer.current);
    };
  }, [auto, active, busy, attemptSwap]);

  const canInput = active && !auto && !busy && !doneRef.current;

  // Candy-game style idle hint: after a few seconds of no input, gently pulse one legal move.
  useEffect(() => {
    if (!canInput) {
      setHinting(new Set());
      return;
    }
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      const legal = findLegalSwap(boardRef.current);
      if (legal) setHinting(new Set([posKey(legal.a), posKey(legal.b)]));
    }, 4200);
    return () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    };
  }, [board, canInput]);

  const targetFromDrag = useCallback((start: { pos: Pos; x: number; y: number }, x: number, y: number) => {
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.hypot(dx, dy) < 12) return null;
    return Math.abs(dx) > Math.abs(dy)
      ? { r: start.pos.r, c: start.pos.c + (dx > 0 ? 1 : -1) }
      : { r: start.pos.r + (dy > 0 ? 1 : -1), c: start.pos.c };
  }, []);

  const cellDown = (r: number, c: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (!canInput) return;
    setHinting(new Set());
    void sugarRushSfx.prime();
    dragStart.current = { pos: { r, c }, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* mobile browser fallback */ }
  };

  const cellMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canInput || !dragStart.current) return;
    const start = dragStart.current;
    const target = targetFromDrag(start, e.clientX, e.clientY);
    if (!target) return;
    dragStart.current = null;
    const current = boardRef.current;
    if (target.r >= 0 && target.r < current.length && target.c >= 0 && target.c < current[0].length) {
      attemptSwap(start.pos, target);
    }
  };

  const cellUp = (r: number, c: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (!canInput || !dragStart.current) return;
    const start = dragStart.current;
    dragStart.current = null;
    const target = targetFromDrag(start, e.clientX, e.clientY);
    if (target) {
      const current = boardRef.current;
      if (target.r >= 0 && target.r < current.length && target.c >= 0 && target.c < current[0].length) attemptSwap(start.pos, target);
      return;
    }
    if (selected && areAdjacent(selected, { r, c })) {
      attemptSwap(selected, { r, c });
      setSelected(null);
    } else {
      setSelected({ r, c });
    }
  };

  const swapStyle = (r: number, c: number): React.CSSProperties | undefined => {
    if (!swapAnimation) return undefined;
    const here = { r, c };
    const isA = here.r === swapAnimation.a.r && here.c === swapAnimation.a.c;
    const isB = here.r === swapAnimation.b.r && here.c === swapAnimation.b.c;
    if (!isA && !isB) return undefined;
    if (swapAnimation.phase === "back") return { transform: "translate3d(0,0,0)", zIndex: 20 };
    const from = isA ? swapAnimation.a : swapAnimation.b;
    const to = isA ? swapAnimation.b : swapAnimation.a;
    return {
      transform: `translate3d(${(to.c - from.c) * 108}%, ${(to.r - from.r) * 108}%, 0)`,
      zIndex: 20,
    };
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
        <div className="relative min-w-0 flex-1 rounded-2xl bg-black/25 px-3 py-1.5 text-center">
          {headerLeft && <p className="truncate text-[10px] font-black uppercase tracking-wide text-white/70">{headerLeft}</p>}
          <p className="text-lg font-black text-white">{score.toLocaleString()}</p>
          {scoreBurst && <span className="sugar-score-burst pointer-events-none absolute -right-1 top-1 text-sm font-black text-yellow-200">{scoreBurst}</span>}
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
        {comboText && (
          <div className="sugar-combo pointer-events-none absolute left-1/2 top-[7%] z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-fuchsia-600/90 px-5 py-2 text-xl font-black text-white shadow-[0_6px_20px_rgba(0,0,0,.35)]">
            {comboText}
          </div>
        )}
        <div
          className={`w-full max-w-[420px] rounded-[26px] p-2 ${reshuffling ? "sugar-board-shuffle" : ""}`}
          style={{
            background: "linear-gradient(160deg, #ffd9a8 0%, #f0a94e 55%, #c97a1f 100%)",
            boxShadow: "0 14px 30px rgba(0,0,0,.45), inset 0 2px 3px rgba(255,255,255,.6)",
          }}
        >
          <div
            className="grid aspect-square gap-[3px] overflow-hidden rounded-[20px] p-2 touch-none select-none"
            style={{
              gridTemplateColumns: `repeat(${size}, 1fr)`,
              background: "linear-gradient(160deg, #241247 0%, #170b30 100%)",
              boxShadow: "inset 0 3px 10px rgba(0,0,0,.6)",
            }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r}-${c}`;
                const isSelected = selected?.r === r && selected?.c === c;
                const isShaking = shake === key;
                const isPopping = popping.has(key);
                const isHinting = hinting.has(key);
                const checker = (r + c) % 2 === 0;
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => cellDown(r, c, e)}
                    onPointerMove={cellMove}
                    onPointerUp={(e) => cellUp(r, c, e)}
                    onPointerCancel={() => { dragStart.current = null; }}
                    className={`relative aspect-square rounded-md ${isSelected ? "ring-2 ring-white/90" : ""} ${isShaking ? "ttt-shake" : ""}`}
                    style={{ background: checker ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)" }}
                  >
                    {cell && (
                      <div
                        key={cell.id}
                        className={`absolute inset-[7%] candy-piece candy-fall ${isPopping ? "candy-pop" : ""} ${isHinting ? "candy-hint" : ""}`}
                        style={swapStyle(r, c)}
                      >
                        <CandyFace cell={cell} />
                      </div>
                    )}
                    {isPopping && <div className="sugar-spark pointer-events-none absolute inset-[18%] rounded-full" />}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
