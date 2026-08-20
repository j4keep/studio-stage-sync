import { useEffect, useRef, useState } from "react";
import { HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import { ROUND_SECONDS, pointsForStreak } from "@/lib/knock-hockey-run";
import type { RoundResult } from "@/lib/knock-hockey-run";
import { knockHockeySfx } from "@/lib/knock-hockey-sfx";

const VIEW_W = 900;
const VIEW_H = 420;
const RINK_X0 = 220;
const RINK_X1 = 680;
const RINK_CX = (RINK_X0 + RINK_X1) / 2;
const WALL_TOP = 20;
const WALL_BOTTOM = 408;
const GOAL_HALF_W = 95;
const GOALIE_Y = 70;
const GOALIE_R = 16;
const GOALIE_HALF_RANGE = 34;
const PADDLE_R = 26;
const PUCK_R = 13;
const PLAYER_MIN_Y = 220;
const PLAYER_MAX_Y = 396;
const FRICTION = 0.965;
const WALL_DAMPING = 0.82;
const SETTLE_SPEED = 55;
const TICK_MS = 16;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

const PUCK_START = { x: RINK_CX, y: 320 };

type Phase = "live" | "reset";
type Popup = { id: number; text: string; x: number; y: number };

export default function KnockHockeyRink({
  active,
  auto = false,
  skill = 0.65,
  myScore,
  oppScore,
  roundLabel,
  muted,
  onToggleMute,
  onBack,
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
  howToPlay: string[];
  onComplete: (result: RoundResult) => void;
}) {
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [onFire, setOnFire] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [buzzer, setBuzzer] = useState(false);
  const [help, setHelp] = useState(false);
  const [flash, setFlash] = useState(false);

  const phaseRef = useRef<Phase>("live");
  const puckRef = useRef({ x: PUCK_START.x, y: PUCK_START.y, vx: 0, vy: 0 });
  const paddleRef = useRef({ x: RINK_CX, y: 370, vx: 0, vy: 0 });
  const goalieRef = useRef({ x: RINK_CX, targetX: RINK_CX });
  const draggingRef = useRef(false);
  const idleTicksRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const pointsRef = useRef(0);
  const goalsRef = useRef(0);
  const attemptsRef = useRef(0);
  const popupIdRef = useRef(0);
  const timeLeftRef = useRef(ROUND_SECONDS);
  const endedRef = useRef(false);
  const hitCooldownRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const goalieReactionRef = useRef(0);
  const aimBiasRef = useRef<1 | -1>(1);

  useEffect(() => {
    if (!active) return;
    phaseRef.current = "live";
    puckRef.current = { x: PUCK_START.x, y: PUCK_START.y, vx: 0, vy: 0 };
    paddleRef.current = { x: RINK_CX, y: 370, vx: 0, vy: 0 };
    goalieRef.current = { x: RINK_CX, targetX: RINK_CX };
    draggingRef.current = false;
    idleTicksRef.current = 0;
    hitCooldownRef.current = 0;
    aimBiasRef.current = Math.random() < 0.5 ? 1 : -1;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    pointsRef.current = 0;
    goalsRef.current = 0;
    attemptsRef.current = 0;
    timeLeftRef.current = ROUND_SECONDS;
    endedRef.current = false;
    setTimeLeft(ROUND_SECONDS);
    setOnFire(false);
    setPopups([]);
    setBuzzer(false);
    bump();

    const finishRound = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      knockHockeySfx.buzzer();
      setBuzzer(true);
      window.setTimeout(() => {
        onComplete({
          points: pointsRef.current,
          goals: goalsRef.current,
          attempts: attemptsRef.current,
          bestStreak: bestStreakRef.current,
        });
      }, 900);
    };

    const spawnPopup = (text: string, x: number, y: number) => {
      popupIdRef.current += 1;
      const p = { id: popupIdRef.current, text, x, y };
      setPopups((cur) => [...cur, p]);
      window.setTimeout(() => setPopups((cur) => cur.filter((q) => q.id !== p.id)), 850);
    };

    const resetPuck = () => {
      puckRef.current = { x: PUCK_START.x, y: PUCK_START.y, vx: 0, vy: 0 };
      idleTicksRef.current = 0;
      aimBiasRef.current = Math.random() < 0.5 ? 1 : -1;
    };

    const registerMiss = () => {
      streakRef.current = 0;
      setOnFire(false);
    };

    const registerGoal = () => {
      goalsRef.current += 1;
      const pts = pointsForStreak(streakRef.current);
      pointsRef.current += pts;
      streakRef.current += 1;
      bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
      const hot = streakRef.current >= 3;
      if (hot && !onFire) {
        setOnFire(true);
        knockHockeySfx.onFire();
      }
      knockHockeySfx.goal();
      spawnPopup(hot ? `+${pts} ON FIRE!` : `+${pts} GOAL!`, RINK_CX, 140);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 260);
    };

    // Countdown timer.
    const timerId = window.setInterval(() => {
      if (endedRef.current) return;
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finishRound();
    }, 1000);

    // Physics/game loop.
    const loop = window.setInterval(() => {
      if (endedRef.current) return;
      const dt = TICK_MS / 1000;
      const puck = puckRef.current;
      const paddle = paddleRef.current;
      if (hitCooldownRef.current > 0) hitCooldownRef.current -= 1;

      // Computer auto-play: paddle visually chases the puck. The actual shot (below) is aimed
      // deterministically at a goal corner rather than relying on emergent collision angles —
      // the same "closed-form aim, not physics-derived" approach used for Pop Shot's computer.
      if (auto) {
        const followSpeed = 460 * skill;
        const targetX = clamp(puck.x, RINK_X0 + PADDLE_R, RINK_X1 - PADDLE_R);
        const targetY = clamp(puck.y + 34, PLAYER_MIN_Y, PLAYER_MAX_Y);
        const dx = targetX - paddle.x;
        const dy = targetY - paddle.y;
        const dist = Math.hypot(dx, dy) || 1;
        const step = Math.min(dist, followSpeed * dt);
        paddle.vx = (dx / dist) * step / dt;
        paddle.vy = (dy / dist) * step / dt;
        paddle.x += (dx / dist) * step;
        paddle.y += (dy / dist) * step;

        const puckSpeed = Math.hypot(puck.vx, puck.vy);
        const canStrike = Math.hypot(puck.x - paddle.x, puck.y - paddle.y) < PADDLE_R + PUCK_R + 10;
        if (canStrike && puckSpeed < 40 && hitCooldownRef.current <= 0) {
          const precision = 0.35 + skill * 0.55; // how close to the true corner the aim lands
          const targetGoalX = RINK_CX + aimBiasRef.current * (GOAL_HALF_W - 8) * precision;
          const ddx = targetGoalX - puck.x;
          const ddy = WALL_TOP + 4 - puck.y;
          const ddist = Math.hypot(ddx, ddy) || 1;
          const shotSpeed = 640 + skill * 260;
          puck.vx = (ddx / ddist) * shotSpeed;
          puck.vy = (ddy / ddist) * shotSpeed;
          attemptsRef.current += 1;
          hitCooldownRef.current = 40;
          knockHockeySfx.paddleHit(0.7);
        }
      }

      // Goalie AI: tracks the puck's x with a reaction lag, confined to its crease.
      // Higher skill = shorter reaction lag and a faster crease slide.
      const goalieReactionLag = 0.22 - skill * 0.14;
      const goalieMaxSpeed = 200 + skill * 200;
      goalieReactionRef.current += dt;
      if (goalieReactionRef.current > goalieReactionLag) {
        goalieReactionRef.current = 0;
        goalieRef.current.targetX = clamp(puck.x, RINK_CX - GOALIE_HALF_RANGE, RINK_CX + GOALIE_HALF_RANGE);
      }
      {
        const g = goalieRef.current;
        const maxStep = goalieMaxSpeed * dt;
        const dx = clamp(g.targetX - g.x, -maxStep, maxStep);
        g.x += dx;
      }

      // Paddle-puck collision (human control only — auto's shot is fired deterministically
      // above). Uses velocity *relative* to the paddle so this works whether the paddle is
      // swinging into a resting puck, or a fast puck is falling back into a stationary paddle.
      if (!auto) {
        const dx = puck.x - paddle.x;
        const dy = puck.y - paddle.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < PADDLE_R + PUCK_R) {
          const nx = dx / dist;
          const ny = dy / dist;
          const relVx = puck.vx - paddle.vx;
          const relVy = puck.vy - paddle.vy;
          const closingSpeed = -(relVx * nx + relVy * ny); // positive when they're approaching each other
          if (closingSpeed > 0) {
            const bounceSpeed = Math.max(closingSpeed, 60) * 1.05;
            puck.vx = nx * bounceSpeed + paddle.vx * 0.35;
            puck.vy = ny * bounceSpeed + paddle.vy * 0.35;
            knockHockeySfx.paddleHit(Math.min(1, Math.hypot(puck.vx, puck.vy) / 900));
            if (hitCooldownRef.current <= 0) {
              attemptsRef.current += 1;
              hitCooldownRef.current = 15;
            }
          }
          const overlap = PADDLE_R + PUCK_R - dist;
          puck.x += nx * overlap;
          puck.y += ny * overlap;
        }
      }

      // Goalie-puck collision (block).
      {
        const g = goalieRef.current;
        const dx = puck.x - g.x;
        const dy = puck.y - GOALIE_Y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < GOALIE_R + PUCK_R) {
          const nx = dx / dist;
          const ny = dy / dist;
          const speed = Math.max(220, Math.hypot(puck.vx, puck.vy) * 0.7);
          puck.vx = nx * speed;
          puck.vy = Math.abs(ny * speed) + 80;
          const overlap = GOALIE_R + PUCK_R - dist;
          puck.x += nx * overlap;
          puck.y += ny * overlap;
          knockHockeySfx.block();
        }
      }

      // Integrate puck motion + friction.
      puck.x += puck.vx * dt;
      puck.y += puck.vy * dt;
      puck.vx *= FRICTION;
      puck.vy *= FRICTION;

      // Side walls.
      if (puck.x - PUCK_R < RINK_X0) {
        puck.x = RINK_X0 + PUCK_R;
        puck.vx = Math.abs(puck.vx) * WALL_DAMPING;
        if (Math.hypot(puck.vx, puck.vy) > 40) knockHockeySfx.wallBounce();
      } else if (puck.x + PUCK_R > RINK_X1) {
        puck.x = RINK_X1 - PUCK_R;
        puck.vx = -Math.abs(puck.vx) * WALL_DAMPING;
        if (Math.hypot(puck.vx, puck.vy) > 40) knockHockeySfx.wallBounce();
      }

      // Top: goal check or wall bounce.
      if (puck.y - PUCK_R < WALL_TOP) {
        const inGoalMouth = Math.abs(puck.x - RINK_CX) < GOAL_HALF_W - PUCK_R * 0.5;
        if (inGoalMouth && puck.vy < 0) {
          registerGoal();
          resetPuck();
        } else {
          puck.y = WALL_TOP + PUCK_R;
          puck.vy = Math.abs(puck.vy) * WALL_DAMPING;
          if (Math.hypot(puck.vx, puck.vy) > 40) knockHockeySfx.wallBounce();
        }
      }

      // Bottom: puck drifted past the player's baseline — miss, reset.
      if (puck.y - PUCK_R > WALL_BOTTOM) {
        registerMiss();
        resetPuck();
      }

      // Settle detection — a dead/slow puck sitting still gets nudged back to center.
      if (Math.hypot(puck.vx, puck.vy) < SETTLE_SPEED) {
        idleTicksRef.current += 1;
        if (idleTicksRef.current > 30) resetPuck();
      } else {
        idleTicksRef.current = 0;
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

  const movePaddleTo = (x: number, y: number) => {
    const p = paddleRef.current;
    const nx = clamp(x, RINK_X0 + PADDLE_R, RINK_X1 - PADDLE_R);
    const ny = clamp(y, PLAYER_MIN_Y, PLAYER_MAX_Y);
    p.vx = (nx - p.x) / (TICK_MS / 1000);
    p.vy = (ny - p.y) / (TICK_MS / 1000);
    p.x = nx;
    p.y = ny;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (auto) return;
    const pt = canvasToView(e.clientX, e.clientY);
    if (!pt) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    movePaddleTo(pt.x, pt.y);
    bump();
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const pt = canvasToView(e.clientX, e.clientY);
    if (!pt) return;
    movePaddleTo(pt.x, pt.y);
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
    const p = paddleRef.current;
    p.vx = 0;
    p.vy = 0;
  };

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(210,45%,8%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{roundLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other round to finish…</p>
      </div>
    );
  }

  const puck = puckRef.current;
  const paddle = paddleRef.current;
  const goalie = goalieRef.current;
  const urgent = timeLeft <= 5;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(210 50% 16%) 0%, hsl(212 50% 9%) 45%, hsl(214 50% 6%) 100%)",
      }}
    >
      <style>{`
        @keyframes kh-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-6px) scale(1.2); opacity: 1; } 100% { transform: translateY(-50px) scale(1); opacity: 0; } }
        @keyframes kh-buzzer { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .kh-pop { animation: kh-pop 850ms ease-out forwards; }
        .kh-buzzer { animation: kh-buzzer 0.4s ease-in-out 2; }
      `}</style>

      {/* Rink area — starts below the scoreboard so the goal is never hidden behind it. */}
      <div
        ref={containerRef}
        className="absolute inset-x-0 bottom-0 touch-none select-none"
        style={{ top: "calc(4.75rem + env(safe-area-inset-top))" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
        <defs>
          <linearGradient id="kh-ice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(200 60% 88%)" />
            <stop offset="100%" stopColor="hsl(200 50% 76%)" />
          </linearGradient>
        </defs>

        {/* Crowd */}
        <rect x="0" y="0" width={VIEW_W} height="20" fill="hsl(214 45% 8%)" />

        {/* Rink surface */}
        <rect x={RINK_X0} y={WALL_TOP} width={RINK_X1 - RINK_X0} height={WALL_BOTTOM - WALL_TOP} fill="url(#kh-ice)" stroke="#0a0e14" strokeWidth="6" />
        <line x1={RINK_X0} y1={VIEW_H / 2 - 10} x2={RINK_X1} y2={VIEW_H / 2 - 10} stroke="hsl(0 70% 55%)" strokeWidth="2.5" opacity="0.55" />
        <circle cx={RINK_CX} cy={VIEW_H / 2 - 10} r="46" fill="none" stroke="hsl(210 70% 45%)" strokeWidth="2" opacity="0.4" />

        {/* Goal mouth + net */}
        <rect x={RINK_CX - GOAL_HALF_W} y={WALL_TOP - 22} width={GOAL_HALF_W * 2} height="22" fill="#0a0e14" opacity="0.85" />
        <g stroke="rgba(255,255,255,0.5)" strokeWidth="1.2">
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={i} x1={RINK_CX - GOAL_HALF_W + (i * GOAL_HALF_W * 2) / 6} y1={WALL_TOP - 22} x2={RINK_CX - GOAL_HALF_W + (i * GOAL_HALF_W * 2) / 6} y2={WALL_TOP} />
          ))}
        </g>
        <rect x={RINK_CX - GOAL_HALF_W} y={WALL_TOP - 4} width={GOAL_HALF_W * 2} height="4" fill="#e0453f" />

        {/* Goalie */}
        <g transform={`translate(${goalie.x} ${GOALIE_Y})`}>
          <ellipse cx="0" cy="6" rx={GOALIE_R * 0.9} ry="6" fill="rgba(0,0,0,0.2)" />
          <circle r={GOALIE_R} fill="#e0453f" stroke="#7a1614" strokeWidth="2" />
          <circle r={GOALIE_R * 0.5} fill="#f8f6f0" />
        </g>

        {/* Player paddle */}
        <g transform={`translate(${paddle.x} ${paddle.y})`}>
          <ellipse cx="0" cy="6" rx={PADDLE_R * 0.9} ry="6" fill="rgba(0,0,0,0.25)" />
          <circle r={PADDLE_R} fill="#3a6bd6" stroke="#12275c" strokeWidth="2.5" />
          <circle r={PADDLE_R * 0.5} fill="#f8f6f0" />
        </g>

        {/* Puck */}
        <g transform={`translate(${puck.x} ${puck.y})`}>
          <circle r={PUCK_R} fill="#111318" stroke="#000" strokeWidth="1.4" />
          <circle r={PUCK_R * 0.4} fill="#333" />
        </g>
      </svg>

      {flash && <div className="pointer-events-none absolute inset-0 bg-white/25" />}

      {popups.map((p) => (
        <span
          key={p.id}
          className="kh-pop pointer-events-none absolute -translate-x-1/2 rounded-full bg-[#f0d84c] px-2.5 py-1 text-[12px] font-black text-black"
          style={{ left: `${(p.x / VIEW_W) * 100}%`, top: `${(p.y / VIEW_H) * 100}%` }}
        >
          {p.text}
        </span>
      ))}

      {onFire && (
        <span className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500 to-red-600 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-lg animate-pulse">
          🔥 On Fire!
        </span>
      )}

      {buzzer && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="kh-buzzer rounded-xl border-2 border-[#f0d84c] bg-black/70 px-5 py-2 text-2xl font-black uppercase tracking-widest text-[#f0d84c]">
            Time!
          </span>
        </div>
      )}

      {help ? (
        <ul className="absolute inset-x-6 top-16 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[10px] text-white/80 animate-fade-in">
          {howToPlay.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      ) : null}

      {!auto && !help && (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/40">
          Drag your paddle to knock the puck into the goal
        </p>
      )}
      </div>

      {/* Scoreboard HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-2 pt-2">
        <button type="button" onClick={onBack} aria-label="Back" className="pointer-events-auto shrink-0 rounded-full bg-black/55 p-1.5 text-white active:scale-95">
          <X className="h-4 w-4" />
        </button>

        <div
          className="flex items-center rounded-2xl border-2 px-1 py-1"
          style={{ borderColor: "rgba(240,216,76,0.35)", background: "rgba(10,6,4,0.88)", boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
        >
          <div className="flex flex-col items-center px-2.5">
            <span className="text-[8px] font-black uppercase tracking-wide text-blue-300">You</span>
            <span className="text-xl font-black leading-none text-blue-300" style={{ textShadow: "0 0 8px rgba(96,165,250,0.85)" }}>
              {myScore}
            </span>
          </div>
          <div className="flex flex-col items-center border-x border-white/15 px-3">
            <span
              className={`font-mono text-[26px] font-black leading-none tabular-nums text-red-500 ${urgent ? "animate-pulse" : ""}`}
              style={{ textShadow: "0 0 10px rgba(239,68,68,0.9)" }}
            >
              0:{String(timeLeft).padStart(2, "0")}
            </span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">Round Clock</span>
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
        </div>
      </div>
      <p className="pointer-events-none absolute left-1/2 top-[3.1rem] z-30 -translate-x-1/2 text-[8px] font-bold text-white/35">{roundLabel}</p>
    </div>
  );
}
