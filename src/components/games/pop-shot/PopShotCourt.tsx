import { useEffect, useRef, useState } from "react";
import { HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import { ROUND_SECONDS, pointsForStreak } from "@/lib/pop-shot-run";
import type { RoundResult } from "@/lib/pop-shot-run";
import { popShotSfx } from "@/lib/pop-shot-sfx";

const VIEW_W = 900;
const VIEW_H = 420;
const FLOOR_Y = 372;
const HOOP_X = 700;
const HOOP_Y = 128;
const RIM_R = 34;
const RIM_TUBE_R = 4;
const BACKBOARD_X = HOOP_X + RIM_R + 16;
const BACKBOARD_TOP = 62;
const BACKBOARD_BOTTOM = 172;
const SHOOTER_X = 168;
const SHOOTER_Y = 296;
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
        className="relative w-7 flex-1 touch-none overflow-hidden rounded-full border border-black/40"
        style={{
          touchAction: "none",
          opacity: disabled ? 0.45 : 1,
          background: "linear-gradient(180deg, #3a2414 0%, #241608 100%)",
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)",
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
        background: "linear-gradient(180deg, hsl(24 55% 20%) 0%, hsl(20 50% 11%) 45%, hsl(18 45% 7%) 100%)",
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
                <stop offset="0%" stopColor="hsl(28 45% 32%)" />
                <stop offset="100%" stopColor="hsl(26 40% 20%)" />
              </linearGradient>
            </defs>

            {/* Crowd bleachers */}
            <rect x="0" y="0" width={VIEW_W} height="54" fill="hsl(20 40% 12%)" />
            {Array.from({ length: 30 }).map((_, i) => (
              <circle key={i} cx={(i * 31 + 12) % VIEW_W} cy={14 + ((i * 17) % 26)} r="6" fill={i % 3 === 0 ? "#c96b3a" : i % 3 === 1 ? "#3a6bd6" : "#d6b23a"} opacity="0.55" />
            ))}

            {/* Floor */}
            <rect x="0" y={FLOOR_Y} width={VIEW_W} height={VIEW_H - FLOOR_Y} fill="url(#ps-floor)" />
            <path d={`M 380,${VIEW_H} A 320,220 0 0 1 900,${FLOOR_Y - 40}`} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
            {Array.from({ length: 16 }).map((_, i) => (
              <line key={i} x1={i * 60} y1={FLOOR_Y} x2={i * 60} y2={VIEW_H} stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
            ))}

            {/* Backboard */}
            <rect x={BACKBOARD_X} y={BACKBOARD_TOP} width="10" height={BACKBOARD_BOTTOM - BACKBOARD_TOP} fill="#e9e4d8" stroke="#111" strokeWidth="2" />
            <rect x={BACKBOARD_X + 1} y={BACKBOARD_TOP + 26} width="7" height="22" fill="none" stroke="#e0453f" strokeWidth="2" />
            <rect x={BACKBOARD_X - 4} y={BACKBOARD_TOP - 8} width="18" height="8" fill="#3a3a3a" />

            {/* Rim + net */}
            <ellipse cx={HOOP_X} cy={HOOP_Y} rx={RIM_R} ry="7" fill="none" stroke="#e0453f" strokeWidth="5" />
            {Array.from({ length: 8 }).map((_, i) => {
              const t = i / 7;
              const x1 = HOOP_X - RIM_R + t * RIM_R * 2;
              const x2 = HOOP_X - RIM_R * 0.35 + t * RIM_R * 0.7;
              return <line key={i} x1={x1} y1={HOOP_Y + 2} x2={x2} y2={HOOP_Y + 34} stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />;
            })}
            <path d={`M ${HOOP_X - RIM_R * 0.35},${HOOP_Y + 34} Q ${HOOP_X},${HOOP_Y + 44} ${HOOP_X + RIM_R * 0.35},${HOOP_Y + 34}`} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />

            {/* Trajectory preview while charging power */}
            {trajectory.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2.2} fill="rgba(255,255,255,0.55)" />
            ))}

            {/* Shooter silhouette */}
            <g transform={`translate(${SHOOTER_X - 46} ${SHOOTER_Y - 10})`} opacity="0.9">
              <ellipse cx="46" cy="96" rx="26" ry="7" fill="rgba(0,0,0,0.35)" />
              <rect x="34" y="20" width="24" height="50" rx="10" fill="#e0453f" />
              <circle cx="46" cy="10" r="12" fill="#8a5a2e" />
              <rect x="20" y="26" width="14" height="34" rx="6" fill="#e0453f" />
            </g>

            {/* Ball */}
            <g transform={`translate(${b.x} ${b.y})`}>
              <ellipse cx="0" cy={FLOOR_Y - b.y + 6} rx={BALL_R * (1 - Math.min(0.7, (FLOOR_Y - b.y) / 500))} ry="3" fill="rgba(0,0,0,0.3)" opacity={Math.max(0.1, 1 - (FLOOR_Y - b.y) / 400)} />
              <circle r={BALL_R} fill="#e0803a" stroke="#7a3d10" strokeWidth="1.4" />
              <path d={`M ${-BALL_R},0 A ${BALL_R},${BALL_R} 0 0 1 ${BALL_R},0`} fill="none" stroke="#3a1e08" strokeWidth="1.2" />
              <line x1="0" y1={-BALL_R} x2="0" y2={BALL_R} stroke="#3a1e08" strokeWidth="1.2" />
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
              Drag the power bar up, release in the green zone to shoot
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
            <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">Shot Clock</span>
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
