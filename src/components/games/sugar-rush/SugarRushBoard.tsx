import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Volume2, VolumeX } from "lucide-react";
import {
  Board,
  Cell,
  Pos,
  areAdjacent,
  generateBoard,
  swapCells,
  findMatches,
  findLegalMoves,
  clearOneMatchStep,
  clearSpecialSwapStep,
  applyGravity,
  refill,
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
  const [shake, setShake] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matchedKeys, setMatchedKeys] = useState<Set<string>>(new Set());
  const [swapAnim, setSwapAnim] = useState<{ a: Pos; b: Pos } | null>(null);
  const [comboText, setComboText] = useState<string | null>(null);
  const [floatingScore, setFloatingScore] = useState<number | null>(null);
  const [hint, setHint] = useState<{ a: Pos; b: Pos } | null>(null);
  const [fallRows, setFallRows] = useState<Map<number, number>>(new Map());
  const [spawnIds, setSpawnIds] = useState<Set<number>>(new Set());
  const [boardBurst, setBoardBurst] = useState(false);

  const bestCascadeRef = useRef(0);
  const clearedRef = useRef(0);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);
  const dragStart = useRef<{ pos: Pos; x: number; y: number } | null>(null);
  const autoTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);
  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  // A ref mirrors score so the delayed "finish" callbacks below always report the true
  // final total, never a value captured before the last swap's points landed.
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    if (!active) return;
    void sugarRushSfx.startMusic();
    return () => sugarRushSfx.stopMusic();
  }, [active]);

  const finish = useCallback((won?: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    sugarRushSfx.buzzer();
    onComplete({ score: scoreRef.current, bestCascade: bestCascadeRef.current, candiesCleared: clearedRef.current, won });
  }, [onComplete]);

  // Timed rounds (versus mode) count down; move-limited levels don't use a clock.
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

  const animateFallAndRefill = useCallback(async (source: Board) => {
    const beforeRows = new Map<number, number>();
    source.forEach((row, r) => row.forEach((cell) => { if (cell) beforeRows.set(cell.id, r); }));

    const fallen = applyGravity(source);
    const deltas = new Map<number, number>();
    fallen.forEach((row, r) => row.forEach((cell) => {
      if (!cell) return;
      const old = beforeRows.get(cell.id);
      if (old !== undefined && r > old) deltas.set(cell.id, r - old);
    }));
    setFallRows(deltas);
    setBoard(fallen);
    if (deltas.size) sugarRushSfx.drop(Math.min(4, Math.max(...Array.from(deltas.values()))));
    await sleep(360);
    setFallRows(new Map());

    const existing = new Set<number>();
    fallen.forEach((row) => row.forEach((cell) => { if (cell) existing.add(cell.id); }));
    const filled = refill(fallen);
    const fresh = new Set<number>();
    filled.forEach((row) => row.forEach((cell) => { if (cell && !existing.has(cell.id)) fresh.add(cell.id); }));
    setSpawnIds(fresh);
    setBoard(filled);
    if (fresh.size) sugarRushSfx.drop(1.4);
    await sleep(390);
    setSpawnIds(new Set());
    return filled;
  }, []);

  const resolveAnimatedCascades = useCallback(async (startingBoard: Board) => {
    let working = startingBoard;
    let depth = 0;
    let totalGained = 0;
    let totalCleared = 0;

    while (findMatches(working).length > 0 && !doneRef.current) {
      depth += 1;
      const step = clearOneMatchStep(working, depth);
      const keys = new Set(step.matched.map(({ r, c }) => `${r}-${c}`));
      setMatchedKeys(keys);
      if (depth >= 2) {
        const labels = ["Sweet!", "Sugar Rush!", "Amazing!", "Mega Mix!"];
        setComboText(labels[Math.min(depth - 2, labels.length - 1)]);
        sugarRushSfx.special();
      } else {
        sugarRushSfx.pop(depth);
      }
      setFloatingScore(step.scoreGained);
      await sleep(240);

      working = step.board;
      setBoard(working);
      setMatchedKeys(new Set());
      totalGained += step.scoreGained;
      totalCleared += step.cleared;
      setScore((v) => v + step.scoreGained);
      await sleep(100);

      setBoardBurst(true);
      window.setTimeout(() => setBoardBurst(false), 220);
      working = await animateFallAndRefill(working);
      setFloatingScore(null);
      if (depth >= 2) sugarRushSfx.cascade(depth);
      await sleep(depth >= 2 ? 130 : 80);
    }

    bestCascadeRef.current = Math.max(bestCascadeRef.current, depth);
    clearedRef.current += totalCleared;
    setComboText(null);

    if (!findLegalMoves(working).length) {
      setComboText("Shuffle!");
      await sleep(450);
      working = generateBoard(mode.gridSize);
      setBoard(working);
      sugarRushSfx.shuffle();
      await sleep(420);
      setComboText(null);
    }
    return { board: working, gained: totalGained, cascades: depth };
  }, [animateFallAndRefill, mode.gridSize]);

  const performSwap = useCallback(async (a: Pos, b: Pos) => {
    if (busy || doneRef.current) return;
    setBusy(true);
    setHint(null);
    const swapped = swapCells(board, a, b);
    const hasSpecial = Boolean(board[a.r][a.c]?.special || board[b.r][b.c]?.special);
    const valid = Boolean(hasSpecial || findMatches(swapped).length);

    setSwapAnim({ a, b });
    setBoard(swapped);
    sugarRushSfx.swap();
    await sleep(190);
    setSwapAnim(null);

    if (!valid) {
      sugarRushSfx.invalid();
      setShake(`${b.r}-${b.c}`);
      setSwapAnim({ a: b, b: a });
      setBoard(board);
      await sleep(210);
      setSwapAnim(null);
      setShake(null);
      setBusy(false);
      return;
    }

    let cascadeStart = swapped;
    if (hasSpecial) {
      const specialStep = clearSpecialSwapStep(swapped, a, b);
      if (specialStep) {
        setMatchedKeys(new Set(specialStep.matched.map(({ r, c }) => `${r}-${c}`)));
        setBoardBurst(true);
        sugarRushSfx.special();
        setFloatingScore(specialStep.scoreGained);
        await sleep(300);
        cascadeStart = specialStep.board;
        setBoard(cascadeStart);
        setMatchedKeys(new Set());
        setBoardBurst(false);
        setScore((v) => v + specialStep.scoreGained);
        clearedRef.current += specialStep.cleared;
        cascadeStart = await animateFallAndRefill(cascadeStart);
        setFloatingScore(null);
      }
    }

    const resolved = await resolveAnimatedCascades(cascadeStart);
    if (mode.kind === "moves") {
      setMovesLeft((m) => {
        const next = m - 1;
        if (next <= 0) window.setTimeout(() => finish(scoreRef.current >= mode.targetScore), 450);
        return next;
      });
    }
    setBusy(false);
  }, [animateFallAndRefill, board, busy, finish, mode, resolveAnimatedCascades]);

  const attemptSwap = useCallback((a: Pos, b: Pos) => {
    if (!areAdjacent(a, b)) return;
    performSwap(a, b);
  }, [performSwap]);

  // Computer turn visibly chooses a REAL legal move, then runs the exact same swap/pop/fall/refill chain.
  useEffect(() => {
    if (!auto || !active) return;
    const tryComputerMove = () => {
      if (busy || doneRef.current) return;
      const moves = findLegalMoves(board);
      if (!moves.length) {
        setBoard(generateBoard(mode.gridSize));
        return;
      }
      const move = moves[Math.floor(Math.random() * moves.length)];
      setHint(move);
      window.setTimeout(() => { setHint(null); attemptSwap(move.a, move.b); }, 420);
    };
    autoTimer.current = window.setInterval(tryComputerMove, 1150);
    return () => { if (autoTimer.current) window.clearInterval(autoTimer.current); };
  }, [auto, active, board, busy, attemptSwap, mode.gridSize]);

  // After idle time, pulse one legal move as a hint instead of leaving the board lifeless.
  useEffect(() => {
    if (!active || auto || busy || doneRef.current) return;
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      const moves = findLegalMoves(board);
      if (moves.length) setHint(moves[Math.floor(Math.random() * moves.length)]);
    }, 4200);
    return () => { if (hintTimer.current) window.clearTimeout(hintTimer.current); };
  }, [active, auto, busy, board]);

  const canInput = active && !auto && !busy && !doneRef.current;

  const cellDown = (r: number, c: number, e: React.PointerEvent) => {
    if (!canInput) return;
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
      }
      setSelected(null);
    } else if (selected && areAdjacent(selected, { r, c })) {
      attemptSwap(selected, { r, c });
      setSelected(null);
    } else {
      setSelected({ r, c });
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

      {(comboText || floatingScore) && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-30 -translate-x-1/2 text-center">
          {comboText && <div className="sugar-combo text-3xl font-black text-white drop-shadow-[0_3px_8px_rgba(130,35,190,.8)]">{comboText}</div>}
          {floatingScore && <div className="sugar-score-float text-xl font-black text-yellow-200">+{floatingScore}</div>}
        </div>
      )}

      <div className="flex flex-1 items-center justify-center p-3">
        <div
          className={`w-full max-w-[420px] rounded-[26px] p-2 ${boardBurst ? "sugar-board-burst" : ""}`}
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
                const isSelected = selected?.r === r && selected?.c === c;
                const isShaking = shake === `${r}-${c}`;
                const checker = (r + c) % 2 === 0;
                return (
                  <div
                    key={`${r}-${c}`}
                    onPointerDown={(e) => cellDown(r, c, e)}
                    onPointerUp={(e) => cellUp(r, c, e)}
                    className={`relative aspect-square rounded-md ${isSelected ? "ring-2 ring-white/90" : ""} ${isShaking ? "ttt-shake" : ""}`}
                    style={{ background: checker ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)" }}
                  >
                    {cell && (() => {
                      const key = `${r}-${c}`;
                      const popping = matchedKeys.has(key);
                      const hinted = hint && ((hint.a.r === r && hint.a.c === c) || (hint.b.r === r && hint.b.c === c));
                      let swapClass = "";
                      if (swapAnim) {
                        if (swapAnim.a.r === r && swapAnim.a.c === c) {
                          const dx = (swapAnim.a.c - swapAnim.b.c) * 100;
                          const dy = (swapAnim.a.r - swapAnim.b.r) * 100;
                          swapClass = ` candy-swap`;
                          return <div key={cell.id} className={`absolute inset-[7%]${swapClass} ${hinted ? "candy-hint" : ""}`} style={{ ['--swap-x' as any]: `${dx}%`, ['--swap-y' as any]: `${dy}%` }}><CandyFace cell={cell} /></div>;
                        }
                        if (swapAnim.b.r === r && swapAnim.b.c === c) {
                          const dx = (swapAnim.b.c - swapAnim.a.c) * 100;
                          const dy = (swapAnim.b.r - swapAnim.a.r) * 100;
                          return <div key={cell.id} className={`absolute inset-[7%] candy-swap ${hinted ? "candy-hint" : ""}`} style={{ ['--swap-x' as any]: `${dx}%`, ['--swap-y' as any]: `${dy}%` }}><CandyFace cell={cell} /></div>;
                        }
                      }
                      return (
                        <div
                          key={cell.id}
                          className={`absolute inset-[7%] ${fallRows.has(cell.id) ? "candy-gravity-drop" : spawnIds.has(cell.id) ? "candy-spawn-drop" : ""} ${popping ? "candy-pop" : ""} ${hinted ? "candy-hint" : ""}`}
                          style={{
                            ['--fall-rows' as any]: fallRows.get(cell.id) ?? 0,
                            ['--spawn-delay' as any]: `${(r * 18 + c * 11)}ms`,
                          }}
                        >
                          <CandyFace cell={cell} />
                          {popping && <span className="candy-sparkle" />}
                        </div>
                      );
                    })()}
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
