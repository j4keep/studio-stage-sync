import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Volume2, VolumeX } from "lucide-react";
import {
  Board,
  CandyColor,
  Cell,
  Pos,
  areAdjacent,
  generateBoard,
  trySwap,
} from "@/lib/sugar-rush";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";

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

const CANDY_COLORS = ["#ff4d68", "#ff9c2e", "#ffd91f", "#3fd15a", "#2ea6ff", "#a259ff"];
const CANDY_DARK = ["#8f0f27", "#8a4700", "#8a6f00", "#0d6b26", "#0a5490", "#4c1490"];

/** Each color gets its own silhouette, not just a different fill — the same way real candy
 *  sets mix hard candies, gems, jellybeans and wrapped bonbons so the board reads as a pile
 *  of different treats instead of six identical dots. */
const CANDY_SHAPES = [
  "circle", // 0 red — classic round gumdrop
  "diamond", // 1 orange — faceted gem
  "star", // 2 yellow — sparkle burst
  "bean", // 3 green — jellybean
  "bonbon", // 4 blue — wrapped square candy
  "drop", // 5 purple — teardrop gem
] as const;

function glossyStyle(base: string, dark: string): React.CSSProperties {
  return {
    background: `radial-gradient(circle at 32% 26%, #ffffff 0%, ${base} 38%, ${dark} 100%)`,
    boxShadow: `inset 0 -4px 5px rgba(0,0,0,.35), inset 0 2px 3px rgba(255,255,255,.7), 0 2px 4px rgba(0,0,0,.35)`,
  };
}

function CandyShape({ color }: { color: CandyColor }) {
  const base = CANDY_COLORS[color];
  const dark = CANDY_DARK[color];
  const shape = CANDY_SHAPES[color];
  const style = glossyStyle(base, dark);

  if (shape === "diamond") {
    return <div className="h-full w-full" style={{ ...style, clipPath: "polygon(50% 2%, 96% 50%, 50% 98%, 4% 50%)" }} />;
  }
  if (shape === "star") {
    return (
      <div
        className="h-full w-full"
        style={{
          ...style,
          clipPath:
            "polygon(50% 0%, 63% 32%, 100% 38%, 74% 62%, 82% 100%, 50% 80%, 18% 100%, 26% 62%, 0% 38%, 37% 32%)",
        }}
      />
    );
  }
  if (shape === "bean") {
    return <div className="h-[78%] w-full translate-y-[11%] -rotate-12 rounded-[50%]" style={style} />;
  }
  if (shape === "bonbon") {
    return (
      <div className="relative h-full w-full">
        <div className="absolute inset-[8%] rounded-md" style={style} />
        <div className="absolute left-0 top-1/2 h-[46%] w-[16%] -translate-y-1/2 rounded-sm bg-white/85" style={{ clipPath: "polygon(100% 0%, 0% 20%, 0% 80%, 100% 100%)" }} />
        <div className="absolute right-0 top-1/2 h-[46%] w-[16%] -translate-y-1/2 rounded-sm bg-white/85" style={{ clipPath: "polygon(0% 0%, 100% 20%, 100% 80%, 0% 100%)" }} />
      </div>
    );
  }
  if (shape === "drop") {
    return <div className="h-full w-full rotate-45 rounded-[38%_38%_38%_0%]" style={style} />;
  }
  return <div className="h-full w-full rounded-full" style={style} />;
}

function CandyFace({ cell }: { cell: Cell }) {
  const bg = CANDY_COLORS[cell.color];
  if (cell.special === "bomb") {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{ background: `radial-gradient(circle at 35% 30%, #fff 0%, ${bg} 45%, #1a1a1a 100%)`, boxShadow: "0 0 10px rgba(0,0,0,.5), 0 0 0 2px rgba(255,255,255,.4) inset" }}
      />
    );
  }
  if (cell.special === "wrapped") {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-xl border-[3px] border-white/85"
        style={{ background: `linear-gradient(135deg, #fff 0%, ${bg} 45%, ${CANDY_DARK[cell.color]} 100%)` }}
      />
    );
  }
  if (cell.special === "striped-h" || cell.special === "striped-v") {
    return (
      <div className="h-full w-full overflow-hidden rounded-full" style={glossyStyle(bg, CANDY_DARK[cell.color])}>
        <div
          className="h-full w-full"
          style={{
            background: cell.special === "striped-h"
              ? "repeating-linear-gradient(90deg, rgba(255,255,255,.85) 0 15%, transparent 15% 50%)"
              : "repeating-linear-gradient(0deg, rgba(255,255,255,.85) 0 15%, transparent 15% 50%)",
          }}
        />
      </div>
    );
  }
  return <CandyShape color={cell.color} />;
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

  const bestCascadeRef = useRef(0);
  const clearedRef = useRef(0);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);
  const dragStart = useRef<{ pos: Pos; x: number; y: number } | null>(null);
  const autoTimer = useRef<number | null>(null);

  // A ref mirrors score so the delayed "finish" callbacks below always report the true
  // final total, never a value captured before the last swap's points landed.
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

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

  const performSwap = useCallback((a: Pos, b: Pos) => {
    if (busy || doneRef.current) return;
    setBusy(true);
    const outcome = trySwap(board, a, b);
    if (!outcome.valid) {
      sugarRushSfx.invalid();
      setShake(`${a.r}-${a.c}`);
      window.setTimeout(() => {
        setShake(null);
        setBusy(false);
      }, 260);
      return;
    }

    sugarRushSfx.swap();
    window.setTimeout(() => {
      setBoard(outcome.board);
      const gained = outcome.result?.scoreGained ?? 0;
      const cascades = outcome.result?.cascades ?? 1;
      const cleared = outcome.result?.cleared ?? 0;
      bestCascadeRef.current = Math.max(bestCascadeRef.current, cascades);
      clearedRef.current += cleared;
      setScore((s) => s + gained);
      if (cascades >= 2) sugarRushSfx.special();
      else sugarRushSfx.pop(cascades);

      if (mode.kind === "moves") {
        setMovesLeft((m) => {
          const next = m - 1;
          if (next <= 0) {
            window.setTimeout(() => finish(scoreRef.current + gained >= mode.targetScore), 350);
          }
          return next;
        });
      }
      setBusy(false);
    }, 160);
  }, [board, busy, finish, mode, score]);

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
    <div className="relative flex h-full w-full flex-col bg-gradient-to-b from-[#3a1f5c] to-[#1f1140]" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
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

      <div className="flex flex-1 items-center justify-center p-3">
        <div
          className="w-full max-w-[420px] rounded-[26px] p-2"
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
                    {cell && (
                      <div key={cell.id} className="absolute inset-[7%] candy-fall">
                        <CandyFace cell={cell} />
                      </div>
                    )}
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
