import { useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, LogOut, Volume2, VolumeX } from "lucide-react";
import GameMenu from "@/components/games/GameMenu";
import { confirmQuitGame } from "@/components/games/QuitGameButton";
import { ROUND_SECONDS, pointsForStreak } from "@/lib/pop-shot-run";
import type { RoundResult } from "@/lib/pop-shot-run";
import { popShotSfx } from "@/lib/pop-shot-sfx";

const VIEW_W = 900;
const VIEW_H = 420;
const FLOOR_Y = 372;
const HOOP_X = 716;
const HOOP_Y = 146;
const RIM_R = 34;
const RIM_TUBE_R = 4;
const BACKBOARD_X = HOOP_X + RIM_R + 18;
const BACKBOARD_TOP = 74;
const BACKBOARD_BOTTOM = 190;
const SHOOTER_X = 170;
const SHOOTER_Y = 300;
const BALL_R = 15;
const GRAVITY = 1650;
const TICK_MS = 16;

/** Power (0..1) maps to this range of the "ideal" launch speed — the whole shot,
 *  same fixed arc every time, just softer or harder. Middle of the slider ≈ perfect. */
const POWER_MIN_MULT = 0.85;
const POWER_MAX_MULT = 1.15;
/** Where the makeable window roughly falls on the 0..1 power slider — shown as a highlighted band. */
const SWEET_LO = 0.38;
const SWEET_HI = 0.65;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function powerToMult(p: number) {
  return POWER_MIN_MULT + clamp(p, 0, 1) * (POWER_MAX_MULT - POWER_MIN_MULT);
}

/** Solves for the launch speed at a fixed angle that sends a projectile from (ox,oy) through (tx,ty) under gravity g. */
function idealVelocity(ox: number, oy: number, tx: number, ty: number, g: number, thetaDeg: number) {
  const theta = (thetaDeg * Math.PI) / 180;
  const dx = tx - ox;
  const dy = ty - oy; // negative: target is above the origin
  const denom = Math.cos(theta) ** 2 * (dy + dx * Math.tan(theta));
  const v2 = (0.5 * g * dx * dx) / Math.max(1, denom);
  const v = Math.sqrt(Math.max(0, v2));
  return { vx: v * Math.cos(theta), vy: -v * Math.sin(theta) };
}

const IDEAL = idealVelocity(SHOOTER_X, SHOOTER_Y, HOOP_X, HOOP_Y, GRAVITY, 62);

type Phase = "ready" | "flight" | "result";
type Popup = { id: number; text: string; x: number; y: number; good: boolean };

/** Vertical drag-to-charge power control with a highlighted "sweet spot" band. */
function PowerSlider({ disabled, onChange, onRelease }: { disabled: boolean; onChange: (p: number) => void; onRelease: (p: number) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const valueRef = useRef(0);
  const [fill, setFill] = useState(0);

  const update = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
    valueRef.current = t;
    setFill(t);
    onChange(t);
  };

  const handleDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
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
    <div className="flex h-full flex-col items-center gap-1">
      <span className="text-[8px] font-black uppercase tracking-wide text-white/50">Power</span>
      <div
        ref={trackRef}
        onPointerDown={handleDown}
        className="relative w-10 flex-1 touch-none overflow-hidden rounded-[20px] border-2 border-white/20"
        style={{
          touchAction: "none",
          opacity: disabled ? 0.45 : 1,
          background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.85), 0 8px 20px rgba(0,0,0,0.35)",
        }}
      >
        {/* Sweet-spot band */}
        <div
          className="absolute inset-x-0 rounded-full"
          style={{
            bottom: `${SWEET_LO * 100}%`,
            height: `${(SWEET_HI - SWEET_LO) * 100}%`,
            background: "rgba(74,222,128,0.35)",
            boxShadow: "inset 0 0 0 1.5px rgba(74,222,128,0.8)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-75"
          style={{
            height: `${fill * 100}%`,
            background: "linear-gradient(0deg, #f0d84c 0%, #ff9d3a 55%, #ff4d4d 100%)",
            opacity: 0.9,
            boxShadow: fill > 0.05 ? "0 0 12px rgba(240,216,76,0.7)" : undefined,
          }}
        />
        <div
          className="absolute inset-x-0 flex h-2 -translate-y-1/2 items-center justify-center"
          style={{ bottom: `${fill * 100}%` }}
        >
          <div className="h-1.5 w-[85%] rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
        </div>
      </div>
      <span className="text-[8px] font-black uppercase tracking-wide text-white/40">{disabled ? "" : "Release!"}</span>
    </div>
  );
}

export default function PopShotCourt({
  active,
  auto = false,
  skill = 0.72,
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
  const [popups, setPopups] = useState<Popup[]>([]);
  const [onFire, setOnFire] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [buzzer, setBuzzer] = useState(false);
  const [help, setHelp] = useState(false);
  const [chargePower, setChargePower] = useState(0);

  const phaseRef = useRef<Phase>("ready");
  const ballRef = useRef({ x: SHOOTER_X, y: SHOOTER_Y, vx: 0, vy: 0 });
  const bounceCountRef = useRef(0);
  const madeRef = useRef(false);
  const scoredRef = useRef(false);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const pointsRef = useRef(0);
  const makesRef = useRef(0);
  const attemptsRef = useRef(0);
  const popupIdRef = useRef(0);
  const timeLeftRef = useRef(ROUND_SECONDS);
  const fireRef = useRef<((p: number) => void) | null>(null);

  useEffect(() => {
    if (!active) return;
    phaseRef.current = "ready";
    ballRef.current = { x: SHOOTER_X, y: SHOOTER_Y, vx: 0, vy: 0 };
    bounceCountRef.current = 0;
    madeRef.current = false;
    scoredRef.current = false;
    startedRef.current = false;
    endedRef.current = false;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    pointsRef.current = 0;
    makesRef.current = 0;
    attemptsRef.current = 0;
    timeLeftRef.current = ROUND_SECONDS;
    setTimeLeft(ROUND_SECONDS);
    setOnFire(false);
    setPopups([]);
    setBuzzer(false);
    setChargePower(0);
    bump();
    popShotSfx.startCrowd();

    const finishRound = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      popShotSfx.stopCrowd();
      popShotSfx.buzzer();
      setBuzzer(true);
      window.setTimeout(() => {
        onComplete({
          points: pointsRef.current,
          makes: makesRef.current,
          attempts: attemptsRef.current,
          bestStreak: bestStreakRef.current,
        });
      }, 900);
    };

    const spawnPopup = (text: string, x: number, y: number, good: boolean) => {
      popupIdRef.current += 1;
      const p = { id: popupIdRef.current, text, x, y, good };
      setPopups((cur) => [...cur, p]);
      window.setTimeout(() => setPopups((cur) => cur.filter((q) => q.id !== p.id)), 850);
    };

    const resetBall = () => {
      phaseRef.current = "ready";
      ballRef.current = { x: SHOOTER_X, y: SHOOTER_Y, vx: 0, vy: 0 };
      bounceCountRef.current = 0;
      madeRef.current = false;
      scoredRef.current = false;
    };

    const registerMiss = () => {
      streakRef.current = 0;
      setOnFire(false);
    };

    const registerMake = () => {
      makesRef.current += 1;
      const pts = pointsForStreak(streakRef.current);
      pointsRef.current += pts;
      streakRef.current += 1;
      bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
      const hot = streakRef.current >= 3;
      if (hot && !onFire) {
        setOnFire(true);
        popShotSfx.onFire();
      }
      spawnPopup(hot ? `+${pts} ON FIRE!` : `+${pts} SWISH!`, ballRef.current.x, ballRef.current.y - 20, true);
      popShotSfx.updateCrowd(streakRef.current / 4);
    };

    const fireWithPower = (p: number) => {
      if (phaseRef.current !== "ready") return;
      const mult = powerToMult(p);
      attemptsRef.current += 1;
      const b = ballRef.current;
      b.vx = IDEAL.vx * mult;
      b.vy = IDEAL.vy * mult;
      phaseRef.current = "flight";
      madeRef.current = false;
      scoredRef.current = false;
      bounceCountRef.current = 0;
      popShotSfx.release();
      bump();
    };
    fireRef.current = fireWithPower;

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
      const b = ballRef.current;

      if (phaseRef.current === "flight") {
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Hoop plane crossing — made shot if within a forgiving scoring window while descending.
        const scoringHalf = 55;
        if (!scoredRef.current && b.vy > 0 && Math.abs(b.y - HOOP_Y) < Math.abs(b.vy * dt) + 2) {
          if (Math.abs(b.x - HOOP_X) < scoringHalf) {
            scoredRef.current = true;
            madeRef.current = true;
            popShotSfx.swish();
            registerMake();
            window.setTimeout(() => {
              if (!endedRef.current && timeLeftRef.current > 0) resetBall();
              bump();
            }, 420);
          }
        }

        // Rim post collisions (miss clank + bounce).
        if (!scoredRef.current) {
          for (const postX of [HOOP_X - RIM_R, HOOP_X + RIM_R]) {
            const dx = b.x - postX;
            const dy = b.y - HOOP_Y;
            const dist = Math.hypot(dx, dy);
            if (dist < BALL_R + RIM_TUBE_R) {
              const nx = dx / (dist || 1);
              const ny = dy / (dist || 1);
              const dot = b.vx * nx + b.vy * ny;
              b.vx = (b.vx - 2 * dot * nx) * 0.5;
              b.vy = (b.vy - 2 * dot * ny) * 0.5;
              bounceCountRef.current += 1;
              popShotSfx.rimClank();
              if (bounceCountRef.current > 3) {
                registerMiss();
                window.setTimeout(() => {
                  if (!endedRef.current && timeLeftRef.current > 0) resetBall();
                  bump();
                }, 300);
              }
            }
          }
        }

        // Backboard.
        if (b.x + BALL_R > BACKBOARD_X && b.vx > 0 && b.y > BACKBOARD_TOP && b.y < BACKBOARD_BOTTOM) {
          b.x = BACKBOARD_X - BALL_R;
          b.vx = -Math.abs(b.vx) * 0.55;
          popShotSfx.backboard();
        }

        // Floor — shot is over.
        if (!scoredRef.current && b.y + BALL_R > FLOOR_Y) {
          b.y = FLOOR_Y - BALL_R;
          popShotSfx.floorBounce();
          registerMiss();
          window.setTimeout(() => {
            if (!endedRef.current && timeLeftRef.current > 0) resetBall();
            bump();
          }, 260);
          phaseRef.current = "result";
        }

        // Out of bounds sideways — reset.
        if (b.x > VIEW_W + 40 || b.x < -40) {
          registerMiss();
          if (!endedRef.current && timeLeftRef.current > 0) resetBall();
        }
      }

      // Computer auto-play — aims for the sweet spot with noise scaled by (1 - skill).
      if (auto && phaseRef.current === "ready" && !startedRef.current) {
        startedRef.current = true;
        window.setTimeout(() => {
          startedRef.current = false;
          if (endedRef.current || phaseRef.current !== "ready") return;
          const center = (SWEET_LO + SWEET_HI) / 2;
          const noise = (1 - skill) * 0.5;
          const p = clamp(center + (Math.random() * 2 - 1) * noise, 0, 1);
          fireWithPower(p);
        }, 500 + Math.random() * 350);
      }

      bump();
    }, TICK_MS);

    return () => {
      window.clearInterval(loop);
      window.clearInterval(timerId);
      popShotSfx.stopCrowd();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(24,45%,8%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{roundLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other round to finish…</p>
      </div>
    );
  }

  const b = ballRef.current;

  // Live trajectory preview while charging power.
  const trajectory: { x: number; y: number }[] = [];
  if (!auto && phaseRef.current === "ready" && chargePower > 0.02) {
    const mult = powerToMult(chargePower);
    let px = b.x;
    let py = b.y;
    let pvx = IDEAL.vx * mult;
    let pvy = IDEAL.vy * mult;
    for (let i = 0; i < 26; i++) {
      pvy += GRAVITY * 0.03;
      px += pvx * 0.03;
      py += pvy * 0.03;
      if (py > FLOOR_Y || px > VIEW_W) break;
      trajectory.push({ x: px, y: py });
    }
  }

  const urgent = timeLeft <= 5;
  const canShoot = !auto && phaseRef.current === "ready" && !buzzer;

  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{
        background: "radial-gradient(120% 90% at 50% 10%, #1d2735 0%, #111827 42%, #070b12 100%)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <style>{`
        @keyframes ps-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-6px) scale(1.15); opacity: 1; } 100% { transform: translateY(-50px) scale(1); opacity: 0; } }
        @keyframes ps-buzzer { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .ps-pop { animation: ps-pop 850ms ease-out forwards; }
        .ps-buzzer { animation: ps-buzzer 0.4s ease-in-out 2; }
      `}</style>

      <div className="flex h-full w-full items-stretch justify-center gap-1.5 px-0.5">
        <div className="relative flex h-full flex-1 items-center justify-center">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
            <defs>
              <linearGradient id="ps-floor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d7a66a" />
                <stop offset="52%" stopColor="#b9783f" />
                <stop offset="100%" stopColor="#8c532b" />
              </linearGradient>
              <linearGradient id="ps-board" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f8fbff" stopOpacity="0.97" />
                <stop offset="55%" stopColor="#dce7f3" stopOpacity="0.94" />
                <stop offset="100%" stopColor="#aebdce" stopOpacity="0.92" />
              </linearGradient>
              <linearGradient id="ps-rim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff6a3d" />
                <stop offset="60%" stopColor="#e33b24" />
                <stop offset="100%" stopColor="#9b1e14" />
              </linearGradient>
              <linearGradient id="ps-jersey" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="55%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#0f2a6b" />
              </linearGradient>
              <radialGradient id="ps-skin" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#f0c2a0" />
                <stop offset="65%" stopColor="#c98761" />
                <stop offset="100%" stopColor="#8f543b" />
              </radialGradient>
              <radialGradient id="ps-ball" cx="35%" cy="28%" r="70%">
                <stop offset="0%" stopColor="#ffb05a" />
                <stop offset="55%" stopColor="#e77b2d" />
                <stop offset="100%" stopColor="#9c4314" />
              </radialGradient>
              <filter id="ps-shadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity=".35" />
              </filter>
            </defs>

            {/* Arena wall, lights, crowd */}
            <rect x="0" y="0" width={VIEW_W} height="118" fill="#0a0f18" />
            <rect x="0" y="54" width={VIEW_W} height="64" fill="#121c29" />
            {Array.from({ length: 46 }).map((_, i) => {
              const x = 10 + ((i * 47) % 880);
              const y = 68 + ((i * 23) % 38);
              const c = ["#f59e0b", "#60a5fa", "#ef4444", "#34d399", "#a78bfa"][i % 5];
              return (
                <g key={i} opacity={0.72}>
                  <circle cx={x} cy={y} r="4.2" fill="#1c2430" />
                  <circle cx={x} cy={y - 5} r="2.6" fill="#b98b6a" />
                  <rect x={x - 4.5} y={y + 3} width="9" height="5" rx="2" fill={c} />
                </g>
              );
            })}
            {Array.from({ length: 9 }).map((_, i) => (
              <g key={`light-${i}`} opacity="0.9">
                <rect x={42 + i * 102} y="18" width="54" height="8" rx="4" fill="#e8f1ff" opacity="0.18" />
                <rect x={50 + i * 102} y="20" width="38" height="4" rx="2" fill="#ffffff" opacity="0.85" />
              </g>
            ))}

            {/* Hardwood court with depth */}
            <path d={`M 0 118 L ${VIEW_W} 118 L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`} fill="url(#ps-floor)" />
            {Array.from({ length: 16 }).map((_, i) => (
              <line
                key={`plank-${i}`}
                x1={i * 64 - 40}
                y1="118"
                x2={i * 86 - 120}
                y2={VIEW_H}
                stroke={i % 2 === 0 ? "rgba(110,55,20,.24)" : "rgba(255,255,255,.09)"}
                strokeWidth="2"
              />
            ))}
            <line x1="0" y1={FLOOR_Y} x2={VIEW_W} y2={FLOOR_Y} stroke="rgba(255,255,255,.24)" strokeWidth="2" />
            <path d={`M 330,${VIEW_H} A 390,250 0 0 1 880,155`} fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth="4" />
            <path d="M 610 118 L 610 360 L 865 360 L 865 118" fill="rgba(37,99,235,.09)" stroke="rgba(255,255,255,.62)" strokeWidth="3" />
            <circle cx="735" cy="258" r="54" fill="none" stroke="rgba(255,255,255,.52)" strokeWidth="3" />
            <text x="450" y="404" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="900" fontSize="24" letterSpacing="8" fill="rgba(255,255,255,.14)">
              YAJ POP SHOT
            </text>

            {/* Regulation-style backboard, support, rim and net */}
            <g filter="url(#ps-shadow)">
              <rect x={BACKBOARD_X - 28} y={BACKBOARD_TOP} width="132" height="84" rx="7" fill="url(#ps-board)" stroke="#d7e0ea" strokeWidth="5" />
              <rect x={BACKBOARD_X + 8} y={BACKBOARD_TOP + 34} width="58" height="38" fill="none" stroke="#ef4444" strokeWidth="4" />
              <rect x={BACKBOARD_X + 102} y={BACKBOARD_TOP + 34} width="14" height="138" rx="6" fill="#2d3748" />
              <path d={`M ${BACKBOARD_X + 108} ${BACKBOARD_TOP + 165} L 840 355`} stroke="#4b5563" strokeWidth="16" strokeLinecap="round" />
              <path d={`M ${BACKBOARD_X + 108} ${BACKBOARD_TOP + 165} L 840 355`} stroke="#111827" strokeWidth="6" strokeLinecap="round" />
            </g>

            <ellipse cx={HOOP_X} cy={HOOP_Y} rx={RIM_R} ry="8" fill="none" stroke="url(#ps-rim)" strokeWidth="7" filter="url(#ps-shadow)" />
            {Array.from({ length: 11 }).map((_, i) => {
              const t = i / 10;
              const x1 = HOOP_X - RIM_R + t * RIM_R * 2;
              const x2 = HOOP_X - RIM_R * 0.42 + t * RIM_R * 0.84;
              return <line key={i} x1={x1} y1={HOOP_Y + 5} x2={x2} y2={HOOP_Y + 48} stroke="rgba(255,255,255,0.9)" strokeWidth="1.7" />;
            })}
            {[12, 23, 34, 45].map((dy) => (
              <ellipse key={dy} cx={HOOP_X} cy={HOOP_Y + dy} rx={RIM_R * (1 - dy / 90)} ry="5" fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="1.35" />
            ))}

            {/* Trajectory preview while charging power */}
            {trajectory.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2.2} fill="rgba(255,255,255,0.55)" />
            ))}

            {/* Stylized 3-D shooter */}
            <g transform={`translate(${SHOOTER_X - 58} ${SHOOTER_Y - 88})`} filter="url(#ps-shadow)">
              <ellipse cx="58" cy="167" rx="34" ry="8" fill="rgba(0,0,0,.30)" />
              <circle cx="58" cy="28" r="18" fill="url(#ps-skin)" stroke="#7a4936" strokeWidth="1.6" />
              <path d="M42 20 Q58 2 75 18 Q70 10 61 8 Q47 7 42 20Z" fill="#171717" />
              <rect x="35" y="48" width="48" height="70" rx="20" fill="url(#ps-jersey)" />
              <path d="M39 58 L20 85" stroke="url(#ps-skin)" strokeWidth="14" strokeLinecap="round" />
              <path d="M78 58 L94 90" stroke="url(#ps-skin)" strokeWidth="14" strokeLinecap="round" />
              <path d="M46 116 L38 157" stroke="#172554" strokeWidth="16" strokeLinecap="round" />
              <path d="M70 116 L80 157" stroke="#172554" strokeWidth="16" strokeLinecap="round" />
              <path d="M28 158 L46 158" stroke="#f8fafc" strokeWidth="9" strokeLinecap="round" />
              <path d="M72 158 L91 158" stroke="#f8fafc" strokeWidth="9" strokeLinecap="round" />
              <text x="59" y="89" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff">7</text>
            </g>

            {/* Ball */}
            <g transform={`translate(${b.x} ${b.y})`}>
              <ellipse cx="0" cy={FLOOR_Y - b.y + 6} rx={BALL_R * (1 - Math.min(0.7, (FLOOR_Y - b.y) / 500))} ry="3" fill="rgba(0,0,0,0.3)" opacity={Math.max(0.1, 1 - (FLOOR_Y - b.y) / 400)} />
              <circle r={BALL_R} fill="url(#ps-ball)" stroke="#6b2f0f" strokeWidth="1.8" filter="url(#ps-shadow)" />
              <path d={`M ${-BALL_R},0 A ${BALL_R},${BALL_R} 0 0 1 ${BALL_R},0`} fill="none" stroke="#3a1e08" strokeWidth="1.6" />
              <line x1="0" y1={-BALL_R} x2="0" y2={BALL_R} stroke="#3a1e08" strokeWidth="1.6" />
              <path d={`M ${-BALL_R * 0.7},${-BALL_R * 0.6} Q 0,0 ${-BALL_R * 0.7},${BALL_R * 0.6}`} fill="none" stroke="#3a1e08" strokeWidth="1" />
              <path d={`M ${BALL_R * 0.7},${-BALL_R * 0.6} Q 0,0 ${BALL_R * 0.7},${BALL_R * 0.6}`} fill="none" stroke="#3a1e08" strokeWidth="1" />
            </g>
          </svg>

          {popups.map((p) => (
            <span
              key={p.id}
              className="ps-pop pointer-events-none absolute -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-black"
              style={{
                left: `${(p.x / VIEW_W) * 100}%`,
                top: `${(p.y / VIEW_H) * 100}%`,
                background: p.good ? "#f0d84c" : "#ff6b6b",
                color: "#111",
              }}
            >
              {p.text}
            </span>
          ))}

          {onFire && (
            <span className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500 to-red-600 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-lg animate-pulse">
              🔥 On Fire!
            </span>
          )}

          {buzzer && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="ps-buzzer rounded-xl border-2 border-[#f0d84c] bg-black/70 px-5 py-2 text-2xl font-black uppercase tracking-widest text-[#f0d84c]">
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

          {!auto && phaseRef.current === "ready" && !help && (
            <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/40">
              Pull the shot meter up • release inside the green zone
            </p>
          )}
        </div>

        {/* Power control rail */}
        <div className="flex h-full shrink-0 items-center pb-1 pr-0.5">
          <PowerSlider
            disabled={!canShoot}
            onChange={setChargePower}
            onRelease={(p) => {
              setChargePower(0);
              fireRef.current?.(p);
            }}
          />
        </div>
      </div>

      {/* Scoreboard HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-2 pt-2">
                <div
          className="flex items-center rounded-2xl border border-white/15 px-1.5 py-1.5"
          style={{ background: "linear-gradient(180deg, rgba(5,10,18,.94), rgba(9,18,31,.92))", boxShadow: "0 8px 24px rgba(0,0,0,.48)" }}
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
          <GameMenu
            triggerClassName="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1.5 text-white active:scale-95"
            actions={[
              { key: "help", label: "How to Play", icon: HelpCircle, onClick: () => setHelp((v) => !v) },
              { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? VolumeX : Volume2, onClick: onToggleMute, active: muted },
              { key: "back", label: "Back to Games", icon: ArrowLeft, onClick: onBack },
              ...(onQuit ? [{ key: "quit", label: "Quit Game", icon: LogOut, onClick: () => confirmQuitGame(onQuit), destructive: true }] : []),
            ]}
          />
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[3.15rem] z-30 -translate-x-1/2 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60">{roundLabel}</p>
        <p className="mt-0.5 text-[8px] font-bold text-white/35">
          Makes {makesRef.current} · Attempts {attemptsRef.current} · Best streak {bestStreakRef.current}
        </p>
      </div>
    </div>
  );
}
