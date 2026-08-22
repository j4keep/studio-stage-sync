import { useEffect, useRef, useState } from "react";
import { HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import QuitGameButton from "@/components/games/QuitGameButton";
import {
  COURSE_H,
  COURSE_W,
  Hole,
  MAX_STROKES,
  ROUND_SECONDS,
  RoundResult,
  scoreForHole,
  shuffleHoles,
} from "@/lib/mini-golf-run";
import { miniGolfSfx } from "@/lib/mini-golf-sfx";

// Portrait canvas — same trick as Knock Hockey's rink: a fixed logical viewBox the SVG scales
// to fill the screen, so the physics tick never has to know about real device pixels.
const VIEW_W = COURSE_W;
const VIEW_H = COURSE_H;
const FAIRWAY_X0 = 20;
const FAIRWAY_X1 = COURSE_W - 20;
const FAIRWAY_Y0 = 46;
const FAIRWAY_Y1 = COURSE_H - 46;
const BALL_R = 9;
const FRICTION_GREEN = 0.978;
const FRICTION_SAND = 0.93;
const WALL_DAMPING = 0.62;
const SINK_SPEED = 110;
const SETTLE_SPEED = 16;
const MIN_PUTT_SPEED = 120;
const MAX_PUTT_SPEED = 950;
const TICK_MS = 16;
const DT = TICK_MS / 1000;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

type Ball = { x: number; y: number; vx: number; vy: number };

/** Circle-vs-rectangle collision, used for every hole's static wall obstacles. Reflects the
 *  ball's velocity across whichever axis the contact normal points along, losing a bit of
 *  speed (`damping`) on the bounce so walls feel solid rather than perfectly elastic. */
function collideBallRect(ball: Ball, rect: { x: number; y: number; w: number; h: number }, radius: number, damping: number): boolean {
  const cx = clamp(ball.x, rect.x, rect.x + rect.w);
  const cy = clamp(ball.y, rect.y, rect.y + rect.h);
  let dx = ball.x - cx;
  let dy = ball.y - cy;
  let dist = Math.hypot(dx, dy);
  if (dist === 0) {
    const left = ball.x - rect.x;
    const right = rect.x + rect.w - ball.x;
    const top = ball.y - rect.y;
    const bottom = rect.y + rect.h - ball.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) { dx = -1; dy = 0; }
    else if (min === right) { dx = 1; dy = 0; }
    else if (min === top) { dx = 0; dy = -1; }
    else { dx = 0; dy = 1; }
    dist = 1;
  }
  if (dist >= radius) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = radius - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + damping) * vn * nx;
    ball.vy -= (1 + damping) * vn * ny;
  }
  return true;
}

function pointInRect(x: number, y: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** Vertical drag-to-charge power control — the same decoupled aim/power split Pool uses: drag
 *  on the green to aim, drag this to charge power, lift to putt. */
function PowerSlider({
  disabled,
  onChange,
  onRelease,
}: {
  disabled: boolean;
  onChange: (power: number) => void;
  onRelease: (power: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const valueRef = useRef(0);
  const [fill, setFill] = useState(0);

  const update = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    valueRef.current = t;
    setFill(t);
    onChange(t);
  };

  const handleDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    // Stop this from bubbling to the course container's own aim-drag handler underneath —
    // without this, charging the power slider was also silently re-aiming the shot each tick.
    e.stopPropagation();
    draggingRef.current = true;
    update(e.clientY);
    const move = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      ev.preventDefault();
      update(ev.clientY);
    };
    const up = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      onRelease(valueRef.current);
      valueRef.current = 0;
      setFill(0);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className="pointer-events-auto flex h-40 flex-col items-center gap-1" data-power-slider>
      <span className="text-[7px] font-black uppercase tracking-wide text-white/45">Power</span>
      <div
        ref={trackRef}
        onPointerDown={handleDown}
        className="relative w-6 flex-1 touch-none overflow-hidden rounded-full border border-black/40"
        style={{
          touchAction: "none",
          opacity: disabled ? 0.4 : 1,
          background: "linear-gradient(180deg, #2f7d3e 0%, #1f5c2c 60%, #123c1b 100%)",
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-75"
          style={{
            height: `${fill * 100}%`,
            background: "linear-gradient(0deg, hsl(204 100% 55%) 0%, #4dd0ff 55%, #ffb020 82%, #ff4d4d 100%)",
            opacity: 0.9,
            boxShadow: fill > 0.05 ? "0 0 14px hsl(204 100% 55% / 0.8)" : undefined,
          }}
        />
        <div className="absolute inset-x-0 flex h-5 -translate-y-1/2 items-center justify-center" style={{ bottom: `${fill * 100}%` }}>
          <div className="h-1.5 w-[85%] rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
        </div>
      </div>
      <span className="text-[7px] font-black uppercase tracking-wide text-white/40">{Math.round(fill * 100)}</span>
    </div>
  );
}

type Popup = { id: number; text: string };

export default function MiniGolfBoard({
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
  const [hole, setHole] = useState<Hole | null>(null);
  const [strokes, setStrokes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [ended, setEnded] = useState(false);
  const [readyPuttUi, setReadyPuttUi] = useState(true);

  const holeRef = useRef<Hole | null>(null);
  const ballRef = useRef<Ball>({ x: 0, y: 0, vx: 0, vy: 0 });
  const lastStrokeStartRef = useRef({ x: 0, y: 0 });
  const aimAngleRef = useRef(-Math.PI / 2);
  const aimingRef = useRef(false);
  const readyRef = useRef(true);
  const strokesRef = useRef(0);
  const idleTicksRef = useRef(0);
  const endedRef = useRef(false);
  const timeLeftRef = useRef(ROUND_SECONDS);
  const popupIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoThinkRef = useRef(0);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const skillRef = useRef(skill);
  skillRef.current = skill;
  const puttHandlerRef = useRef<((angle: number, power: number) => void) | null>(null);

  useEffect(() => {
    if (!active) return;
    const chosen = shuffleHoles()[0];
    holeRef.current = chosen;
    setHole(chosen);
    ballRef.current = { x: chosen.start.x, y: chosen.start.y, vx: 0, vy: 0 };
    lastStrokeStartRef.current = { x: chosen.start.x, y: chosen.start.y };
    aimAngleRef.current = Math.atan2(chosen.cup.y - chosen.start.y, chosen.cup.x - chosen.start.x);
    aimingRef.current = false;
    readyRef.current = true;
    strokesRef.current = 0;
    idleTicksRef.current = 0;
    endedRef.current = false;
    timeLeftRef.current = ROUND_SECONDS;
    autoThinkRef.current = 0;
    setStrokes(0);
    setTimeLeft(ROUND_SECONDS);
    setPopup(null);
    setEnded(false);
    setReadyPuttUi(true);
    bump();

    const spawnPopup = (text: string) => {
      popupIdRef.current += 1;
      const p = { id: popupIdRef.current, text };
      setPopup(p);
      window.setTimeout(() => setPopup((cur) => (cur?.id === p.id ? null : cur)), 1100);
    };

    const finish = (sunk: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      const h = holeRef.current!;
      const points = scoreForHole(h, strokesRef.current, sunk);
      if (sunk) {
        spawnPopup(strokesRef.current <= 1 ? "HOLE IN ONE!" : `SUNK! +${points}`);
        miniGolfSfx.sink(strokesRef.current);
      } else {
        spawnPopup("OUT OF STROKES");
        miniGolfSfx.miss();
      }
      window.setTimeout(() => {
        onComplete({ points, strokes: strokesRef.current, sunk, holeName: h.name });
      }, 1000);
    };

    const putt = (angle: number, power: number) => {
      if (!readyRef.current || endedRef.current || power <= 0.04) return;
      const speed = MIN_PUTT_SPEED + power * (MAX_PUTT_SPEED - MIN_PUTT_SPEED);
      ballRef.current.vx = Math.cos(angle) * speed;
      ballRef.current.vy = Math.sin(angle) * speed;
      readyRef.current = false;
      setReadyPuttUi(false);
      strokesRef.current += 1;
      setStrokes(strokesRef.current);
      miniGolfSfx.putt(power);
    };
    puttHandlerRef.current = putt;

    // Countdown timer — a soft safety net so a stalled hole can't hold up a round forever.
    const timerId = window.setInterval(() => {
      if (endedRef.current) return;
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finish(false);
    }, 1000);

    // Physics/game loop.
    const loop = window.setInterval(() => {
      if (endedRef.current) return;
      const h = holeRef.current!;
      const ball = ballRef.current;

      if (!readyRef.current) {
        const inSand = h.hazards.some((z) => z.type === "sand" && pointInRect(ball.x, ball.y, z));
        const friction = inSand ? FRICTION_SAND : FRICTION_GREEN;

        ball.x += ball.vx * DT;
        ball.y += ball.vy * DT;
        ball.vx *= friction;
        ball.vy *= friction;

        let bounced = false;
        if (ball.x - BALL_R < FAIRWAY_X0) {
          ball.x = FAIRWAY_X0 + BALL_R;
          ball.vx = Math.abs(ball.vx) * WALL_DAMPING;
          bounced = true;
        } else if (ball.x + BALL_R > FAIRWAY_X1) {
          ball.x = FAIRWAY_X1 - BALL_R;
          ball.vx = -Math.abs(ball.vx) * WALL_DAMPING;
          bounced = true;
        }
        if (ball.y - BALL_R < FAIRWAY_Y0) {
          ball.y = FAIRWAY_Y0 + BALL_R;
          ball.vy = Math.abs(ball.vy) * WALL_DAMPING;
          bounced = true;
        } else if (ball.y + BALL_R > FAIRWAY_Y1) {
          ball.y = FAIRWAY_Y1 - BALL_R;
          ball.vy = -Math.abs(ball.vy) * WALL_DAMPING;
          bounced = true;
        }

        for (const wall of h.walls) {
          if (collideBallRect(ball, wall, BALL_R, WALL_DAMPING)) bounced = true;
        }
        if (bounced && Math.hypot(ball.vx, ball.vy) > 60) miniGolfSfx.wallHit();

        const water = h.hazards.find((z) => z.type === "water" && pointInRect(ball.x, ball.y, z));
        if (water) {
          miniGolfSfx.splash();
          strokesRef.current += 1;
          setStrokes(strokesRef.current);
          spawnPopup("SPLASH! +1 STROKE");
          ball.x = lastStrokeStartRef.current.x;
          ball.y = lastStrokeStartRef.current.y;
          ball.vx = 0;
          ball.vy = 0;
          readyRef.current = true;
          setReadyPuttUi(true);
          idleTicksRef.current = 0;
          if (strokesRef.current >= MAX_STROKES) finish(false);
          bump();
          return;
        }

        const speed = Math.hypot(ball.vx, ball.vy);
        const distToCup = Math.hypot(ball.x - h.cup.x, ball.y - h.cup.y);
        if (distToCup < h.cupRadius && speed < SINK_SPEED) {
          ball.x = h.cup.x;
          ball.y = h.cup.y;
          ball.vx = 0;
          ball.vy = 0;
          finish(true);
          bump();
          return;
        }

        if (speed < SETTLE_SPEED) {
          idleTicksRef.current += 1;
          if (idleTicksRef.current > 10) {
            ball.vx = 0;
            ball.vy = 0;
            readyRef.current = true;
            setReadyPuttUi(true);
            lastStrokeStartRef.current = { x: ball.x, y: ball.y };
            aimAngleRef.current = Math.atan2(h.cup.y - ball.y, h.cup.x - ball.x);
            if (strokesRef.current >= MAX_STROKES) finish(false);
          }
        } else {
          idleTicksRef.current = 0;
        }
      } else if (autoRef.current && !endedRef.current) {
        // Computer's turn: closed-form aim straight at the cup with skill-scaled noise on both
        // angle and power, same "aim deterministically, don't rely on emergent physics" approach
        // used by Pop Shot/Knock Hockey's computer, after a short skill-scaled think delay.
        autoThinkRef.current += 1;
        const thinkTicks = Math.round((32 - skillRef.current * 14));
        if (autoThinkRef.current > thinkTicks) {
          autoThinkRef.current = 0;
          const dist = Math.hypot(h.cup.x - ball.x, h.cup.y - ball.y);
          const noiseMag = (1 - skillRef.current) * 0.32;
          const angle = Math.atan2(h.cup.y - ball.y, h.cup.x - ball.x) + (Math.random() - 0.5) * noiseMag;
          const distanceNoise = 1 + (Math.random() - 0.5) * (1 - skillRef.current) * 0.55;
          const desiredStopDistance = dist * distanceNoise;
          const v0 = (desiredStopDistance * (1 - FRICTION_GREEN)) / DT;
          const power = clamp((v0 - MIN_PUTT_SPEED) / (MAX_PUTT_SPEED - MIN_PUTT_SPEED), 0.12, 1);
          puttHandlerRef.current?.(angle, power);
        }
      }

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

  const canAim = active && !auto && !ended && readyPuttUi;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canAim) return;
    const pt = canvasToView(e.clientX, e.clientY);
    if (!pt) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    aimingRef.current = true;
    aimAngleRef.current = Math.atan2(pt.y - ballRef.current.y, pt.x - ballRef.current.x);
    bump();
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!aimingRef.current || !canAim) return;
    const pt = canvasToView(e.clientX, e.clientY);
    if (!pt) return;
    aimAngleRef.current = Math.atan2(pt.y - ballRef.current.y, pt.x - ballRef.current.x);
    bump();
  };
  const handlePointerUp = () => {
    aimingRef.current = false;
  };

  const handlePowerChange = () => {
    /* purely visual — the actual putt fires on release */
  };
  const handlePowerRelease = (power: number) => {
    if (!canAim) return;
    puttHandlerRef.current?.(aimAngleRef.current, power);
  };

  if (!active || !hole) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(140,40%,8%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{roundLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other round to finish…</p>
      </div>
    );
  }

  const ball = ballRef.current;
  const urgent = timeLeft <= 8;
  const aimLen = 70;
  const aimX = ball.x + Math.cos(aimAngleRef.current) * aimLen;
  const aimY = ball.y + Math.sin(aimAngleRef.current) * aimLen;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, hsl(140 40% 14%) 0%, hsl(142 42% 8%) 45%, hsl(144 45% 5%) 100%)" }}
    >
      <style>{`
        @keyframes mg-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-6px) scale(1.15); opacity: 1; } 100% { transform: translateY(-46px) scale(1); opacity: 0; } }
        .mg-pop { animation: mg-pop 1000ms ease-out forwards; }
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
          <defs>
            <linearGradient id="mg-green" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(122 45% 38%)" />
              <stop offset="100%" stopColor="hsl(124 48% 28%)" />
            </linearGradient>
          </defs>

          <rect x={FAIRWAY_X0} y={FAIRWAY_Y0} width={FAIRWAY_X1 - FAIRWAY_X0} height={FAIRWAY_Y1 - FAIRWAY_Y0} fill="url(#mg-green)" stroke="#0a1a0d" strokeWidth="6" rx="10" />

          {hole.hazards.map((hz, i) => (
            <rect
              key={i}
              x={hz.x}
              y={hz.y}
              width={hz.w}
              height={hz.h}
              rx="8"
              fill={hz.type === "water" ? "hsl(205 75% 42%)" : "hsl(42 55% 62%)"}
              stroke={hz.type === "water" ? "hsl(205 75% 30%)" : "hsl(42 45% 45%)"}
              strokeWidth="2"
              opacity={hz.type === "water" ? 0.9 : 0.95}
            />
          ))}

          {hole.walls.map((w, i) => (
            <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} rx="4" fill="#f2ede2" stroke="#a89a7c" strokeWidth="2" />
          ))}

          {/* Cup */}
          <ellipse cx={hole.cup.x} cy={hole.cup.y} rx={hole.cupRadius} ry={hole.cupRadius * 0.55} fill="#0a0e0a" stroke="#000" strokeWidth="1.5" />
          <circle cx={hole.cup.x} cy={hole.cup.y - 2} r="2.5" fill="#f0d84c" />
          <line x1={hole.cup.x} y1={hole.cup.y - 4} x2={hole.cup.x} y2={hole.cup.y - 46} stroke="#e5e5e5" strokeWidth="2.5" />
          <path d={`M ${hole.cup.x} ${hole.cup.y - 46} L ${hole.cup.x + 22} ${hole.cup.y - 38} L ${hole.cup.x} ${hole.cup.y - 30} Z`} fill="#f0d84c" />

          {/* Aim guide — persistent once it's the human's turn to putt, not just mid-drag. */}
          {canAim && (
            <line x1={ball.x} y1={ball.y} x2={aimX} y2={aimY} stroke="#fff" strokeWidth="2.5" strokeDasharray="5 6" opacity="0.75" />
          )}

          {/* Ball */}
          <g transform={`translate(${ball.x} ${ball.y})`}>
            <ellipse cx="0" cy={BALL_R * 0.7} rx={BALL_R * 0.85} ry="3" fill="rgba(0,0,0,0.25)" />
            <circle r={BALL_R} fill="#f8f6f0" stroke="#b8b2a2" strokeWidth="1.2" />
          </g>
        </svg>

        {popup && (
          <span
            key={popup.id}
            className="mg-pop pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 rounded-full bg-[#f0d84c] px-3 py-1 text-sm font-black text-black"
          >
            {popup.text}
          </span>
        )}

        {auto && !ended && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/45">
            Watching their putt
          </p>
        )}
        {canAim && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/45">
            Drag to aim, then charge the power slider and let go
          </p>
        )}

        {help ? (
          <ul className="absolute inset-x-6 top-16 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[11px] text-white/80 animate-fade-in">
            {howToPlay.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : null}

        {!auto && (
          <div className="pointer-events-none absolute inset-y-0 right-2 z-20 flex items-center">
            <PowerSlider disabled={!canAim} onChange={handlePowerChange} onRelease={handlePowerRelease} />
          </div>
        )}
      </div>

      {/* Scoreboard HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-2 pt-2">
        <button type="button" onClick={onBack} aria-label="Back" className="pointer-events-auto shrink-0 rounded-full bg-black/55 p-1.5 text-white active:scale-95">
          <X className="h-4 w-4" />
        </button>

        <div
          className="flex items-center rounded-2xl border-2 px-1 py-1"
          style={{ borderColor: "rgba(240,216,76,0.35)", background: "rgba(6,10,6,0.88)", boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
        >
          <div className="flex flex-col items-center px-2.5">
            <span className="text-[8px] font-black uppercase tracking-wide text-blue-300">You</span>
            <span className="text-xl font-black leading-none text-blue-300" style={{ textShadow: "0 0 8px rgba(96,165,250,0.85)" }}>
              {myScore}
            </span>
          </div>
          <div className="flex flex-col items-center border-x border-white/15 px-3">
            <span className={`font-mono text-[26px] font-black leading-none tabular-nums text-[#f0d84c] ${urgent ? "animate-pulse" : ""}`} style={{ textShadow: "0 0 10px rgba(240,216,76,0.85)" }}>
              {strokes}
            </span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">Strokes · Par {hole.par}</span>
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
      <p className="pointer-events-none absolute left-1/2 top-[3.1rem] z-30 -translate-x-1/2 text-[8px] font-bold text-white/35">
        {hole.name} — {roundLabel}
      </p>
    </div>
  );
}
