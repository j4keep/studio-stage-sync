import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { LANE_COUNT, TRACK_LENGTH, TrackItem, spawnTrack } from "@/lib/driving-run";
import { drivingSfx } from "@/lib/driving-sfx";
import type { RunResult } from "@/lib/driving-run";

const PLAYER_X = 210;
const PX_PER_UNIT = 8.6;
const ROAD_TOP = 96;
const ROAD_BOTTOM = 372;
const LANE_H = (ROAD_BOTTOM - ROAD_TOP) / LANE_COUNT;
const laneY = (lane: number) => ROAD_TOP + LANE_H * (lane + 0.5);

const SPEED = 15.5; // track-units/sec
const STEER_RATE = 210; // px/sec lateral
const CRASH_RADIUS = 15;
const CLOSE_CALL_RADIUS = 30;
const BOOST_RADIUS = 20;
const TICK_MS = 55;
const GRACE_TICKS = Math.round(500 / TICK_MS);

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

function CarSprite({ x, y, scale = 1, color, dim = false }: { x: number; y: number; scale?: number; color: string; dim?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={dim ? 0.4 : 1}>
      <ellipse cx="0" cy="12" rx="24" ry="7" fill="rgba(0,0,0,0.35)" />
      <path
        d="M -22,-11 Q -25,-14 -17,-14 L 13,-14 Q 25,-15 25,-5 L 25,5 Q 25,15 13,14 L -17,14 Q -25,14 -22,11 Z"
        fill={color}
        stroke="#0f1115"
        strokeWidth="1.6"
      />
      <path d="M -3,-9 L 11,-9.5 Q 16,-9 16,-4 L 16,4 Q 16,9 11,9.5 L -3,9 Z" fill="#a9dcff" opacity="0.9" />
      <line x1="7" y1="-9" x2="7" y2="9" stroke="#0f1115" strokeWidth="1" opacity="0.35" />
      <rect x="-17" y="-17" width="10" height="5.5" rx="1.6" fill="#0c0d10" />
      <rect x="-17" y="11.5" width="10" height="5.5" rx="1.6" fill="#0c0d10" />
      <rect x="7" y="-17" width="10" height="5.5" rx="1.6" fill="#0c0d10" />
      <rect x="7" y="11.5" width="10" height="5.5" rx="1.6" fill="#0c0d10" />
      <circle cx="23" cy="-6" r="2.1" fill="#fff7c2" />
      <circle cx="23" cy="6" r="2.1" fill="#fff7c2" />
      <circle cx="-22" cy="-6" r="1.7" fill="#ff5555" />
      <circle cx="-22" cy="6" r="1.7" fill="#ff5555" />
    </g>
  );
}

function BoostIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="13" fill="#f0d84c" opacity="0.18" />
      <path d="M -4,-10 L 6,-2 L 0,-1 L 4,10 L -7,0 L -1,-1 Z" fill="#f0d84c" stroke="#8a6d00" strokeWidth="1" />
    </g>
  );
}

type Item = TrackItem & { id: number; resolved: boolean };
type Popup = { id: number; text: string; x: number; y: number };

export default function DrivingRace({
  active,
  auto = false,
  skill = 0.7,
  carColor,
  driveLabel,
  myScore,
  oppScore,
  muted,
  onToggleMute,
  onBack,
  onComplete,
}: {
  active: boolean;
  auto?: boolean;
  skill?: number;
  carColor: string;
  driveLabel: string;
  myScore: number;
  oppScore: number;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onComplete: (result: RunResult) => void;
}) {
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [banner, setBanner] = useState<{ text: string; sub: string; good: boolean } | null>(null);
  const [shake, setShake] = useState(false);

  const distanceRef = useRef(0);
  const laneYRef = useRef(laneY(1.5));
  const dragTargetRef = useRef(laneY(1.5));
  const lastTouchRef = useRef<number | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const boostsRef = useRef(0);
  const runTicksRef = useRef(0);
  const phaseRef = useRef<"countdown" | "running" | "done">("countdown");
  const completedRef = useRef(false);
  const popupIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) {
      phaseRef.current = "countdown";
      return;
    }
    distanceRef.current = 0;
    laneYRef.current = laneY(1.5);
    dragTargetRef.current = laneY(1.5);
    boostsRef.current = 0;
    runTicksRef.current = 0;
    completedRef.current = false;
    setBanner(null);
    setPopups([]);
    itemsRef.current = spawnTrack().map((t, i) => ({ ...t, id: i, resolved: false }));
    phaseRef.current = "countdown";
    bump();
    drivingSfx.startEngine();

    const startTimer = window.setTimeout(() => {
      phaseRef.current = "running";
      bump();
    }, 550);

    const finish = (crashed: boolean) => {
      if (completedRef.current) return;
      completedRef.current = true;
      phaseRef.current = "done";
      drivingSfx.stopEngine();
      const distance = clamp(distanceRef.current, 0, TRACK_LENGTH);
      const boosts = boostsRef.current;
      const finished = !crashed;
      if (finished) {
        drivingSfx.finish();
        setBanner({ text: "FINISHED!", sub: `${Math.round(distance)} units, +${boosts * 30} boost bonus`, good: true });
      } else {
        drivingSfx.crash();
        setShake(true);
        window.setTimeout(() => setShake(false), 220);
        setBanner({ text: "CRASHED", sub: `${Math.round(distance)} units, ${boosts} boost${boosts === 1 ? "" : "s"}`, good: false });
      }
      window.setTimeout(() => {
        const score = Math.round(Math.max(0, distance) + boosts * 30 + (finished ? 400 : 0));
        onComplete({ distance, boosts, finished, score });
      }, 1200);
    };

    const id = window.setInterval(() => {
      const dt = TICK_MS / 1000;
      if (phaseRef.current !== "running") return;
      runTicksRef.current += 1;
      const pastGrace = runTicksRef.current > GRACE_TICKS;

      distanceRef.current = clamp(distanceRef.current + SPEED * dt, 0, TRACK_LENGTH);
      drivingSfx.updateEngine(0.55 + Math.min(1, distanceRef.current / TRACK_LENGTH) * 0.3);

      if (auto) {
        const threat = itemsRef.current
          .filter((it) => it.kind === "car" && !it.resolved)
          .map((it) => ({ it, dist: it.distance - distanceRef.current }))
          .filter((t) => t.dist > -1 && t.dist < 16)
          .sort((a, b) => a.dist - b.dist)[0];
        if (threat && Math.random() < skill) {
          const targetLane = threat.it.lane <= 1 ? LANE_COUNT - 1 : 0;
          dragTargetRef.current = laneY(targetLane);
        }
        const boostAhead = itemsRef.current.find((it) => it.kind === "boost" && !it.resolved && it.distance - distanceRef.current > 0 && it.distance - distanceRef.current < 20);
        if (!threat && boostAhead) dragTargetRef.current = laneY(boostAhead.lane);
      }

      const maxStep = STEER_RATE * dt;
      const dy = clamp(dragTargetRef.current, ROAD_TOP + LANE_H * 0.3, ROAD_BOTTOM - LANE_H * 0.3) - laneYRef.current;
      laneYRef.current += clamp(dy, -maxStep, maxStep);

      if (pastGrace) {
        const newPopups: Popup[] = [];
        for (const item of itemsRef.current) {
          if (item.resolved) continue;
          const distanceAhead = item.distance - distanceRef.current;
          if (distanceAhead > 0) continue;
          item.resolved = true;
          const itemScreenX = PLAYER_X + distanceAhead * PX_PER_UNIT;
          const itemY = laneY(item.lane);
          const dist = Math.hypot(PLAYER_X - itemScreenX, laneYRef.current - itemY);
          if (item.kind === "car") {
            if (dist < CRASH_RADIUS) {
              finish(true);
              break;
            } else if (dist < CLOSE_CALL_RADIUS) {
              drivingSfx.closeCall();
            }
          } else if (item.kind === "boost") {
            if (dist < BOOST_RADIUS) {
              boostsRef.current += 1;
              drivingSfx.boost();
              popupIdRef.current += 1;
              newPopups.push({ id: popupIdRef.current, text: "BOOST +30", x: PLAYER_X, y: laneYRef.current - 30 });
            }
          }
        }
        if (newPopups.length) {
          setPopups((p) => [...p, ...newPopups]);
          newPopups.forEach((p) => window.setTimeout(() => setPopups((cur) => cur.filter((x) => x.id !== p.id)), 900));
        }
      }

      if (phaseRef.current === "running" && distanceRef.current >= TRACK_LENGTH) finish(false);

      bump();
    }, TICK_MS);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(id);
      drivingSfx.stopEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (auto || phaseRef.current !== "running") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    lastTouchRef.current = e.clientY;
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (auto || phaseRef.current !== "running" || lastTouchRef.current == null || !containerRef.current) return;
    const deltaPx = e.clientY - lastTouchRef.current;
    lastTouchRef.current = e.clientY;
    const heightPx = containerRef.current.clientHeight || 1;
    const deltaSvg = (deltaPx / heightPx) * 420;
    dragTargetRef.current = clamp(dragTargetRef.current + deltaSvg, ROAD_TOP, ROAD_BOTTOM);
  };
  const handlePointerUp = () => {
    lastTouchRef.current = null;
  };

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(210,45%,8%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{driveLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other run to finish…</p>
      </div>
    );
  }

  const phase = phaseRef.current;
  const distance = distanceRef.current;
  const sx = (worldDistance: number) => PLAYER_X + (worldDistance - distance) * PX_PER_UNIT;

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full touch-none select-none overflow-hidden ${shake ? "drv-shaking" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ background: "linear-gradient(180deg, hsl(205 60% 22%) 0%, hsl(210 50% 12%) 40%, hsl(212 45% 8%) 100%)", paddingTop: "env(safe-area-inset-top)" }}
    >
      <style>{`
        @keyframes drv-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes drv-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-6px) scale(1.1); opacity: 1; } 100% { transform: translateY(-46px) scale(1); opacity: 0; } }
        @keyframes drv-banner { 0% { transform: scale(0.5); opacity: 0; } 40% { transform: scale(1.08); opacity: 1; } 75% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        @keyframes drv-count { 0% { opacity: 0; transform: scale(0.7); } 30% { opacity: 1; transform: scale(1.1); } 60% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
        .drv-shaking { animation: drv-shake 180ms ease-in-out 2; }
        .drv-pop { animation: drv-pop 900ms ease-out forwards; }
        .drv-banner { animation: drv-banner 1.2s ease-out forwards; }
        .drv-count { animation: drv-count 550ms ease-out forwards; }
      `}</style>

      <svg viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
        <defs>
          <linearGradient id="drv-road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(220 12% 24%)" />
            <stop offset="100%" stopColor="hsl(220 14% 14%)" />
          </linearGradient>
        </defs>

        {/* Sky/scenery */}
        <rect x="0" y="0" width="900" height={ROAD_TOP} fill="hsl(205 55% 24%)" />
        {Array.from({ length: 8 }).map((_, i) => {
          const worldX = i * 30 - 10;
          const x = sx(worldX) % 940;
          return <rect key={i} x={((x % 940) + 940) % 940 - 40} y={ROAD_TOP - 46} width="26" height="46" rx="3" fill="hsl(205 40% 16%)" opacity="0.6" />;
        })}

        {/* Road */}
        <rect x="0" y={ROAD_TOP} width="900" height={ROAD_BOTTOM - ROAD_TOP} fill="url(#drv-road)" />
        {/* Shoulders */}
        <rect x="0" y={ROAD_TOP - 6} width="900" height="6" fill="#f0d84c" opacity="0.7" />
        <rect x="0" y={ROAD_BOTTOM} width="900" height="6" fill="#f0d84c" opacity="0.7" />

        {/* Lane dividers, scrolling with distance */}
        {Array.from({ length: LANE_COUNT - 1 }).map((_, i) => {
          const y = ROAD_TOP + LANE_H * (i + 1);
          return (
            <line
              key={i}
              x1="0"
              y1={y}
              x2="900"
              y2={y}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2.5"
              strokeDasharray="24 20"
              strokeDashoffset={-(distance * PX_PER_UNIT) % 44}
            />
          );
        })}

        {/* Track items */}
        {itemsRef.current.map((item) => {
          const x = sx(item.distance);
          if (x < -40 || x > 940) return null;
          const y = laneY(item.lane);
          if (item.kind === "boost") return item.resolved ? null : <BoostIcon key={item.id} x={x} y={y} />;
          return <CarSprite key={item.id} x={x} y={y} scale={0.95} color="#e0453f" dim={item.resolved} />;
        })}

        {/* Player car */}
        <CarSprite x={PLAYER_X} y={laneYRef.current} scale={1.05} color={carColor} />
      </svg>

      {popups.map((p) => (
        <span
          key={p.id}
          className="drv-pop pointer-events-none absolute -translate-x-1/2 rounded-full bg-[#f0d84c] px-2 py-0.5 text-[11px] font-black text-black"
          style={{ left: `${(p.x / 900) * 100}%`, top: `${(p.y / 420) * 100}%` }}
        >
          {p.text}
        </span>
      ))}

      {phase === "countdown" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="drv-count rounded-xl border-2 border-[#f0d84c] bg-black/60 px-5 py-2 text-2xl font-black uppercase tracking-widest text-[#f0d84c]">
            Go!
          </span>
        </div>
      )}

      {banner && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="drv-banner flex flex-col items-center gap-1 rounded-2xl border-2 px-6 py-3 text-center"
            style={{ color: banner.good ? "#f0d84c" : "#ff6b6b", borderColor: banner.good ? "#f0d84c" : "#ff6b6b", background: "rgba(0,0,0,0.7)" }}
          >
            <span className="text-3xl font-black uppercase tracking-wide">{banner.text}</span>
            <span className="text-xs font-bold text-white/80">{banner.sub}</span>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            <X className="h-4 w-4" />
          </button>
          <div className="rounded-xl bg-black/45 px-2 py-1">
            <p className="text-[9px] font-black uppercase text-white/50">You</p>
            <p className="text-base font-black leading-none text-white">{myScore}</p>
          </div>
        </div>
        <div className="mt-0.5 flex flex-col items-center gap-0.5">
          <span className="rounded-full bg-black/60 px-3 py-0.5 text-[11px] font-black text-white">{Math.round(Math.max(0, distance))} / {TRACK_LENGTH}</span>
          <span className="text-[9px] font-bold text-white/40">{driveLabel}</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-xl bg-black/45 px-2 py-1 text-right">
            <p className="text-[9px] font-black uppercase text-white/50">Rival</p>
            <p className="text-base font-black leading-none text-white">{oppScore}</p>
          </div>
          <button type="button" onClick={onToggleMute} aria-label="Mute" className="rounded-full bg-black/55 p-1.5 text-white active:scale-95">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!auto && phase === "running" && (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/40">Drag up/down to change lanes</p>
      )}
    </div>
  );
}
