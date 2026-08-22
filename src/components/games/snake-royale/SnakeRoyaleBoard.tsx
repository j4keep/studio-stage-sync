import { useEffect, useRef, useState } from "react";
import { HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import QuitGameButton from "@/components/games/QuitGameButton";
import { ROUND_SECONDS, RoundResult, scoreForRun } from "@/lib/snake-royale-run";
import { snakeRoyaleSfx } from "@/lib/snake-royale-sfx";

// Portrait canvas — same fixed-viewBox trick as Knock Hockey's rink and Mini Golf's course: the
// physics tick works entirely in logical grid cells, and the SVG scales to fill the screen.
const CELL = 30;
const GRID_COLS = 16;
const GRID_ROWS = 30;
const VIEW_W = CELL * GRID_COLS;
const VIEW_H = CELL * GRID_ROWS;
const TICK_MS = 130;
const START_LENGTH = 4;
const SWIPE_THRESHOLD = 22;
/** timeLeft values (seconds) at which the play zone insets by one more cell on every side. */
const SHRINK_AT = [34, 23, 12];

type Cell = { x: number; y: number };
type Dir = { dx: -1 | 0 | 1; dy: -1 | 0 | 1 };

const UP: Dir = { dx: 0, dy: -1 };
const DOWN: Dir = { dx: 0, dy: 1 };
const LEFT: Dir = { dx: -1, dy: 0 };
const RIGHT: Dir = { dx: 1, dy: 0 };

function sameDir(a: Dir, b: Dir) {
  return a.dx === b.dx && a.dy === b.dy;
}
function isReverse(a: Dir, b: Dir) {
  return a.dx === -b.dx && a.dy === -b.dy;
}
function leftOf(d: Dir): Dir {
  // Rotate -90°: (dx,dy) -> (dy,-dx)
  return { dx: d.dy as -1 | 0 | 1, dy: (-d.dx) as -1 | 0 | 1 };
}
function rightOf(d: Dir): Dir {
  // Rotate +90°: (dx,dy) -> (-dy,dx)
  return { dx: (-d.dy) as -1 | 0 | 1, dy: d.dx as -1 | 0 | 1 };
}

type Popup = { id: number; text: string };

export default function SnakeRoyaleBoard({
  active,
  auto = false,
  skill = 0.65,
  myScore,
  oppScore,
  roundLabel,
  muted,
  onToggleMute,
  onBack,
  onQuit,
  howToPlay,
  onComplete,
}: {
  active: boolean;
  auto?: boolean;
  skill?: number;
  myScore: number;
  oppScore: number;
  roundLabel: string;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onQuit?: () => void;
  howToPlay: string[];
  onComplete: (result: RoundResult) => void;
}) {
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);
  const [help, setHelp] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [ended, setEnded] = useState(false);
  const [length, setLength] = useState(START_LENGTH);

  const snakeRef = useRef<Cell[]>([]);
  const headingRef = useRef<Dir>(UP);
  const queuedDirRef = useRef<Dir | null>(null);
  const foodRef = useRef<Cell>({ x: 0, y: 0 });
  const zoneInsetRef = useRef(0);
  const shrinkIdxRef = useRef(0);
  const foodEatenRef = useRef(0);
  const endedRef = useRef(false);
  const timeLeftRef = useRef(ROUND_SECONDS);
  const popupIdRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const skillRef = useRef(skill);
  skillRef.current = skill;

  useEffect(() => {
    if (!active) return;
    const cx = Math.floor(GRID_COLS / 2);
    const cy = Math.floor(GRID_ROWS / 2);
    snakeRef.current = Array.from({ length: START_LENGTH }, (_, i) => ({ x: cx, y: cy + i }));
    headingRef.current = UP;
    queuedDirRef.current = null;
    zoneInsetRef.current = 0;
    shrinkIdxRef.current = 0;
    foodEatenRef.current = 0;
    endedRef.current = false;
    timeLeftRef.current = ROUND_SECONDS;
    dragStartRef.current = null;
    setTimeLeft(ROUND_SECONDS);
    setLength(START_LENGTH);
    setPopup(null);
    setEnded(false);

    const zoneBounds = () => ({
      minX: zoneInsetRef.current,
      maxX: GRID_COLS - 1 - zoneInsetRef.current,
      minY: zoneInsetRef.current,
      maxY: GRID_ROWS - 1 - zoneInsetRef.current,
    });

    const inBody = (c: Cell, body: Cell[], excludeTail: boolean) => {
      const list = excludeTail ? body.slice(0, -1) : body;
      return list.some((s) => s.x === c.x && s.y === c.y);
    };

    const spawnFood = () => {
      const { minX, maxX, minY, maxY } = zoneBounds();
      let tries = 0;
      while (tries < 200) {
        tries += 1;
        const c = { x: minX + Math.floor(Math.random() * (maxX - minX + 1)), y: minY + Math.floor(Math.random() * (maxY - minY + 1)) };
        if (!inBody(c, snakeRef.current, false)) {
          foodRef.current = c;
          return;
        }
      }
      foodRef.current = { x: minX, y: minY };
    };
    spawnFood();

    const spawnPopup = (text: string) => {
      popupIdRef.current += 1;
      const p = { id: popupIdRef.current, text };
      setPopup(p);
      window.setTimeout(() => setPopup((cur) => (cur?.id === p.id ? null : cur)), 900);
    };

    const finish = (survived: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      const points = scoreForRun(foodEatenRef.current, survived);
      if (survived) {
        spawnPopup(`TIME! +${points}`);
        snakeRoyaleSfx.buzzer();
      } else {
        spawnPopup("ELIMINATED");
        snakeRoyaleSfx.die();
      }
      window.setTimeout(() => {
        onComplete({ points, length: snakeRef.current.length, foodEaten: foodEatenRef.current, survived });
      }, 1000);
    };

    const applyShrinkIfDue = () => {
      while (shrinkIdxRef.current < SHRINK_AT.length && timeLeftRef.current <= SHRINK_AT[shrinkIdxRef.current]) {
        zoneInsetRef.current += 1;
        shrinkIdxRef.current += 1;
        snakeRoyaleSfx.zoneShrink();
        spawnPopup("ZONE SHRINKING");
      }
    };

    const pickDirection = (): Dir => {
      const head = snakeRef.current[0];
      const { minX, maxX, minY, maxY } = zoneBounds();
      const candidates = [headingRef.current, leftOf(headingRef.current), rightOf(headingRef.current)];
      const safe = candidates.filter((d) => {
        const nx = head.x + d.dx;
        const ny = head.y + d.dy;
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) return false;
        const willEat = nx === foodRef.current.x && ny === foodRef.current.y;
        return !inBody({ x: nx, y: ny }, snakeRef.current, !willEat);
      });
      if (safe.length === 0) return headingRef.current;
      const carefulPick = safe.reduce((best, d) => {
        const nx = head.x + d.dx;
        const ny = head.y + d.dy;
        const dist = Math.abs(nx - foodRef.current.x) + Math.abs(ny - foodRef.current.y);
        const bx = head.x + best.dx;
        const by = head.y + best.dy;
        const bestDist = Math.abs(bx - foodRef.current.x) + Math.abs(by - foodRef.current.y);
        return dist < bestDist ? d : best;
      }, safe[0]);
      const sloppy = Math.random() < (1 - skillRef.current) * 0.4;
      return sloppy ? safe[Math.floor(Math.random() * safe.length)] : carefulPick;
    };

    // Countdown timer.
    const timerId = window.setInterval(() => {
      if (endedRef.current) return;
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finish(true);
    }, 1000);

    // Movement/game loop.
    const loop = window.setInterval(() => {
      if (endedRef.current) return;

      applyShrinkIfDue();
      const { minX, maxX, minY, maxY } = zoneBounds();
      const head0 = snakeRef.current[0];
      if (head0.x < minX || head0.x > maxX || head0.y < minY || head0.y > maxY) {
        finish(false);
        bump();
        return;
      }

      if (autoRef.current) {
        headingRef.current = pickDirection();
      } else if (queuedDirRef.current && !isReverse(queuedDirRef.current, headingRef.current)) {
        headingRef.current = queuedDirRef.current;
      }
      queuedDirRef.current = null;

      const head = snakeRef.current[0];
      const dir = headingRef.current;
      const newHead = { x: head.x + dir.dx, y: head.y + dir.dy };

      if (newHead.x < minX || newHead.x > maxX || newHead.y < minY || newHead.y > maxY) {
        finish(false);
        bump();
        return;
      }
      const ateFood = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
      if (inBody(newHead, snakeRef.current, !ateFood)) {
        finish(false);
        bump();
        return;
      }

      const body = [newHead, ...snakeRef.current];
      if (ateFood) {
        foodEatenRef.current += 1;
        snakeRoyaleSfx.eat(body.length);
        spawnPopup(`+${2}`);
        spawnFood();
      } else {
        body.pop();
      }
      snakeRef.current = body;
      setLength(body.length);

      bump();
    }, TICK_MS);

    return () => {
      window.clearInterval(loop);
      window.clearInterval(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const canvasToView = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * VIEW_W, y: ((clientY - rect.top) / rect.height) * VIEW_H };
  };

  const canSteer = active && !auto && !ended;

  const queueFromDelta = (dx: number, dy: number) => {
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const d: Dir = horizontal ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP;
    if (!isReverse(d, headingRef.current)) queuedDirRef.current = d;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canSteer) return;
    const pt = canvasToView(e.clientX, e.clientY);
    if (!pt) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStartRef.current = pt;
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canSteer || !dragStartRef.current) return;
    const pt = canvasToView(e.clientX, e.clientY);
    if (!pt) return;
    const dx = pt.x - dragStartRef.current.x;
    const dy = pt.y - dragStartRef.current.y;
    if (Math.hypot(dx, dy) >= SWIPE_THRESHOLD) {
      queueFromDelta(dx, dy);
      dragStartRef.current = pt;
    }
  };
  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(150,45%,7%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{roundLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other round to finish…</p>
      </div>
    );
  }

  const snake = snakeRef.current;
  const food = foodRef.current;
  const inset = zoneInsetRef.current;
  const urgent = timeLeft <= 8;
  const zoneMinX = inset * CELL;
  const zoneMinY = inset * CELL;
  const zoneMaxX = (GRID_COLS - inset) * CELL;
  const zoneMaxY = (GRID_ROWS - inset) * CELL;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(150 45% 13%) 0%, hsl(152 45% 8%) 45%, hsl(154 48% 5%) 100%)" }}>
      <style>{`
        @keyframes sr-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-6px) scale(1.15); opacity: 1; } 100% { transform: translateY(-46px) scale(1); opacity: 0; } }
        .sr-pop { animation: sr-pop 900ms ease-out forwards; }
      `}</style>

      <div
        ref={containerRef}
        className="absolute inset-x-0 bottom-0 touch-none select-none"
        style={{ top: "calc(4.75rem + env(safe-area-inset-top))" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full">
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="hsl(150 42% 15%)" />

          {/* Storm — the shrinking play zone's danger area, outside the safe rect. */}
          {zoneMinY > 0 && <rect x="0" y="0" width={VIEW_W} height={zoneMinY} fill="rgba(180,20,20,0.4)" />}
          {zoneMaxY < VIEW_H && <rect x="0" y={zoneMaxY} width={VIEW_W} height={VIEW_H - zoneMaxY} fill="rgba(180,20,20,0.4)" />}
          {zoneMinX > 0 && <rect x="0" y={zoneMinY} width={zoneMinX} height={zoneMaxY - zoneMinY} fill="rgba(180,20,20,0.4)" />}
          {zoneMaxX < VIEW_W && <rect x={zoneMaxX} y={zoneMinY} width={VIEW_W - zoneMaxX} height={zoneMaxY - zoneMinY} fill="rgba(180,20,20,0.4)" />}
          <rect x={zoneMinX} y={zoneMinY} width={zoneMaxX - zoneMinX} height={zoneMaxY - zoneMinY} fill="none" stroke="#f0d84c" strokeWidth="3" strokeDasharray="10 8" opacity="0.7" />

          {/* Food */}
          <circle cx={food.x * CELL + CELL / 2} cy={food.y * CELL + CELL / 2} r={CELL * 0.32} fill="#ff5a5a" stroke="#7a1614" strokeWidth="2" />

          {/* Snake */}
          {snake.map((s, i) => {
            const isHead = i === 0;
            return (
              <rect
                key={i}
                x={s.x * CELL + 2}
                y={s.y * CELL + 2}
                width={CELL - 4}
                height={CELL - 4}
                rx="7"
                fill={isHead ? "#4ade80" : "#22b061"}
                stroke={isHead ? "#0d5f30" : "#0d4f2a"}
                strokeWidth="1.5"
              />
            );
          })}
        </svg>

        {popup && (
          <span
            key={popup.id}
            className="sr-pop pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 rounded-full bg-[#f0d84c] px-3 py-1 text-sm font-black text-black"
          >
            {popup.text}
          </span>
        )}

        {auto && !ended && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/45">Watching their run</p>
        )}
        {canSteer && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/45">Swipe to steer — avoid the storm</p>
        )}

        {help ? (
          <ul className="absolute inset-x-6 top-16 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[11px] text-white/80 animate-fade-in">
            {howToPlay.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Scoreboard HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-2 pt-2">
        <button type="button" onClick={onBack} aria-label="Back" className="pointer-events-auto shrink-0 rounded-full bg-black/55 p-1.5 text-white active:scale-95">
          <X className="h-4 w-4" />
        </button>

        <div
          className="flex items-center rounded-2xl border-2 px-1 py-1"
          style={{ borderColor: "rgba(240,216,76,0.35)", background: "rgba(4,10,6,0.88)", boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
        >
          <div className="flex flex-col items-center px-2.5">
            <span className="text-[8px] font-black uppercase tracking-wide text-blue-300">You</span>
            <span className="text-xl font-black leading-none text-blue-300" style={{ textShadow: "0 0 8px rgba(96,165,250,0.85)" }}>
              {myScore}
            </span>
          </div>
          <div className="flex flex-col items-center border-x border-white/15 px-3">
            <span className={`font-mono text-[26px] font-black leading-none tabular-nums text-red-500 ${urgent ? "animate-pulse" : ""}`} style={{ textShadow: "0 0 10px rgba(239,68,68,0.9)" }}>
              0:{String(timeLeft).padStart(2, "0")}
            </span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">Len {length}</span>
          </div>
          <div className="flex flex-col items-center px-2.5">
            <span className="text-[8px] font-black uppercase tracking-wide text-red-300">Rival</span>
            <span className="text-xl font-black leading-none text-red-300" style={{ textShadow: "0 0 8px rgba(248,113,113,0.85)" }}>
              {oppScore}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setHelp((v) => !v)} aria-label="How to play" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToggleMute} aria-label="Mute" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {onQuit && <QuitGameButton onQuit={onQuit} className="rounded-full bg-black/55 p-1.5 text-white active:scale-95" />}
        </div>
      </div>
      <p className="pointer-events-none absolute left-1/2 top-[3.1rem] z-30 -translate-x-1/2 text-[8px] font-bold text-white/35">{roundLabel}</p>
    </div>
  );
}
