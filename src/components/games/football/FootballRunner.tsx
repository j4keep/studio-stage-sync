import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { Player, PLAYER_KEYFRAMES } from "./PlayerArt";
import { spawnDefenders } from "@/lib/football-run";
import { footballSfx } from "@/lib/football-sfx";
import type { DriveResult } from "@/lib/football-run";

const LANE_MIN = 10;
const LANE_MAX = 90;
const RUN_SPEED = 18; // yards/sec auto-advance
const STEER_RATE = 130; // lane-units/sec the carrier can turn
const DEFENDER_COUNT = 6;
const ENGAGE_WINDOW = 24; // yards ahead a defender starts reacting
const CHASE_RATE = 70; // lane-units/sec a reacting defender closes
const TACKLE_RADIUS = 6;
const DODGE_RADIUS = 15;
const TICK_MS = 60;
const VIEW_DISTANCE = 46; // yards of visible lookahead
const FIELD_LENGTH = 100;

const FAR_Y = 96;
const NEAR_Y = 372;
const FAR_HALF_W = 130;
const NEAR_HALF_W = 330;
const CENTER_X = 450;
const FAR_SCALE = 0.42;
const NEAR_SCALE = 1.15;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

function project(distanceAhead: number) {
  const u = clamp(1 - distanceAhead / VIEW_DISTANCE, -0.1, 1);
  return { y: lerp(FAR_Y, NEAR_Y, u), scale: lerp(FAR_SCALE, NEAR_SCALE, u), u };
}
function laneScreenX(laneX: number, u: number) {
  const halfW = lerp(FAR_HALF_W, NEAR_HALF_W, clamp(u, 0, 1));
  return CENTER_X + ((laneX - 50) / 50) * halfW;
}

type Defender = { id: number; yardLine: number; x: number; homeX: number; resolved: "no" | "dodged" | "tackled" };
type Popup = { id: number; text: string; x: number; y: number };

export default function FootballRunner({
  active,
  auto = false,
  skill = 0.72,
  carrierAccent,
  defenderAccent,
  driveLabel,
  myScore,
  oppScore,
  muted,
  onToggleMute,
  onBack,
  onComplete,
}: {
  /** Whether this drive is currently live (false shows a "waiting" placeholder instead). */
  active: boolean;
  /** True = computer-controlled drive; steers itself instead of listening for drag input. */
  auto?: boolean;
  /** 0..1, how reliably the auto-driver dodges. */
  skill?: number;
  carrierAccent: string;
  defenderAccent: string;
  driveLabel: string;
  myScore: number;
  oppScore: number;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onComplete: (result: DriveResult) => void;
}) {
  const [tick, setTick] = useState(0);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [banner, setBanner] = useState<{ text: string; good: boolean } | null>(null);
  const [shake, setShake] = useState(false);

  const yardsRef = useRef(0);
  const playerXRef = useRef(50);
  const dragTargetRef = useRef(50);
  const lastTouchXRef = useRef<number | null>(null);
  const defendersRef = useRef<Defender[]>([]);
  const dodgesRef = useRef(0);
  const phaseRef = useRef<"idle" | "running" | "done">("idle");
  const completedRef = useRef(false);
  const popupIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) {
      phaseRef.current = "idle";
      return;
    }
    // Fresh drive: reset everything.
    yardsRef.current = 0;
    playerXRef.current = 50;
    dragTargetRef.current = 50;
    dodgesRef.current = 0;
    completedRef.current = false;
    setBanner(null);
    setPopups([]);
    defendersRef.current = spawnDefenders(DEFENDER_COUNT).map((d, i) => ({
      id: i,
      yardLine: d.yardLine,
      x: d.laneX,
      homeX: d.laneX,
      resolved: "no",
    }));
    phaseRef.current = "running";
    footballSfx.whistle();

    const finish = (touchdown: boolean, tackled: boolean) => {
      if (completedRef.current) return;
      completedRef.current = true;
      phaseRef.current = "done";
      const yards = clamp(yardsRef.current, 0, FIELD_LENGTH);
      const dodges = dodgesRef.current;
      if (touchdown) {
        footballSfx.crowd(1);
        setBanner({ text: "TOUCHDOWN!", good: true });
      } else if (tackled) {
        footballSfx.impact(0.9);
        footballSfx.crowd(0.4);
        setShake(true);
        window.setTimeout(() => setShake(false), 220);
        setBanner({ text: "TACKLED", good: false });
      }
      window.setTimeout(() => {
        const score = Math.round(yards + dodges * 50 + (touchdown ? 500 : 0));
        onComplete({ yards, dodges, touchdown, score });
      }, 1100);
    };

    const id = window.setInterval(() => {
      if (phaseRef.current !== "running") return;
      const dt = TICK_MS / 1000;

      yardsRef.current = clamp(yardsRef.current + RUN_SPEED * dt, 0, FIELD_LENGTH);

      // Steering target: drag input, or a simple avoid-the-nearest-threat AI.
      if (auto) {
        const threat = defendersRef.current
          .filter((d) => d.resolved === "no")
          .map((d) => ({ d, dist: d.yardLine - yardsRef.current }))
          .filter((t) => t.dist > -2 && t.dist < ENGAGE_WINDOW)
          .sort((a, b) => a.dist - b.dist)[0];
        if (threat && Math.random() < skill) {
          const away = playerXRef.current >= threat.d.x ? 1 : -1;
          dragTargetRef.current = clamp(playerXRef.current + away * 26, LANE_MIN, LANE_MAX);
        } else if (!threat) {
          dragTargetRef.current = lerp(dragTargetRef.current, 50, 0.02);
        }
      }

      const maxStep = STEER_RATE * dt;
      const dx = clamp(dragTargetRef.current, LANE_MIN, LANE_MAX) - playerXRef.current;
      playerXRef.current += clamp(dx, -maxStep, maxStep);
      playerXRef.current = clamp(playerXRef.current, LANE_MIN, LANE_MAX);

      const newPopups: Popup[] = [];
      for (const def of defendersRef.current) {
        if (def.resolved !== "no") continue;
        const distanceAhead = def.yardLine - yardsRef.current;
        if (distanceAhead <= ENGAGE_WINDOW && distanceAhead > -2) {
          def.x = lerp(def.x, playerXRef.current, Math.min(1, (CHASE_RATE * dt) / 40));
        }
        if (distanceAhead <= 0) {
          const lateral = Math.abs(playerXRef.current - def.x);
          if (lateral < TACKLE_RADIUS) {
            def.resolved = "tackled";
            finish(false, true);
            break;
          } else {
            def.resolved = "dodged";
            if (lateral < DODGE_RADIUS) {
              dodgesRef.current += 1;
              footballSfx.impact(0.25);
              popupIdRef.current += 1;
              const proj = project(0);
              newPopups.push({ id: popupIdRef.current, text: "DODGE +50", x: laneScreenX(def.x, proj.u), y: proj.y - 40 });
            }
          }
        }
      }
      if (newPopups.length) {
        setPopups((p) => [...p, ...newPopups]);
        newPopups.forEach((p) => window.setTimeout(() => setPopups((cur) => cur.filter((x) => x.id !== p.id)), 900));
      }

      if (phaseRef.current === "running" && yardsRef.current >= FIELD_LENGTH) {
        finish(true, false);
      }

      setTick((t) => t + 1);
    }, TICK_MS);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (auto || phaseRef.current !== "running") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    lastTouchXRef.current = e.clientX;
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (auto || phaseRef.current !== "running" || lastTouchXRef.current == null || !containerRef.current) return;
    const deltaPx = e.clientX - lastTouchXRef.current;
    lastTouchXRef.current = e.clientX;
    const widthPx = containerRef.current.clientWidth || 1;
    const deltaLane = (deltaPx / widthPx) * 150; // sensitivity
    dragTargetRef.current = clamp(dragTargetRef.current + deltaLane, LANE_MIN, LANE_MAX);
  };
  const handlePointerUp = () => {
    lastTouchXRef.current = null;
  };

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(140,40%,6%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{driveLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other drive to finish…</p>
      </div>
    );
  }

  const yards = yardsRef.current;
  const carrierScreenX = laneScreenX(playerXRef.current, 1);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        background: "radial-gradient(90% 80% at 50% 0%, hsl(140 35% 14%) 0%, hsl(140 40% 8%) 45%, hsl(140 45% 4%) 100%)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <style>{`
        @keyframes fbr-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes fbr-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-6px) scale(1.1); opacity: 1; } 100% { transform: translateY(-46px) scale(1); opacity: 0; } }
        @keyframes fbr-banner { 0% { transform: scale(0.5); opacity: 0; } 40% { transform: scale(1.1); opacity: 1; } 70% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        .fbr-shaking { animation: fbr-shake 180ms ease-in-out 2; }
        .fbr-pop { animation: fbr-pop 900ms ease-out forwards; }
        .fbr-banner { animation: fbr-banner 1.1s ease-out forwards; }
        ${PLAYER_KEYFRAMES}
      `}</style>

      <svg viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" className={`block h-full w-full ${shake ? "fbr-shaking" : ""}`}>
        <defs>
          <linearGradient id="fbr-turf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(132 45% 24%)" />
            <stop offset="100%" stopColor="hsl(132 48% 14%)" />
          </linearGradient>
        </defs>
        <rect width="900" height="420" fill="hsl(140 40% 5%)" />

        {/* Receding field trapezoid */}
        <path
          d={`M ${CENTER_X - FAR_HALF_W} ${FAR_Y} L ${CENTER_X + FAR_HALF_W} ${FAR_Y} L ${CENTER_X + NEAR_HALF_W} ${NEAR_Y} L ${CENTER_X - NEAR_HALF_W} ${NEAR_Y} Z`}
          fill="url(#fbr-turf)"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="2"
        />

        {/* Yard-line stripes, scrolling toward the viewer as yards increase */}
        {Array.from({ length: Math.ceil((yards + VIEW_DISTANCE) / 10) + 1 }).map((_, i) => {
          const worldYard = i * 10;
          const distanceAhead = worldYard - yards;
          if (distanceAhead < -3 || distanceAhead > VIEW_DISTANCE) return null;
          const p = project(distanceAhead);
          const isEndZone = worldYard >= 100;
          return (
            <line
              key={i}
              x1={CENTER_X - lerp(FAR_HALF_W, NEAR_HALF_W, p.u)}
              y1={p.y}
              x2={CENTER_X + lerp(FAR_HALF_W, NEAR_HALF_W, p.u)}
              y2={p.y}
              stroke={isEndZone ? "#f0d84c" : "rgba(255,255,255,0.35)"}
              strokeWidth={isEndZone ? 4 : Math.max(1, p.scale * 2)}
            />
          );
        })}

        {/* Defenders */}
        {defendersRef.current.map((d) => {
          if (d.resolved === "tackled") return null;
          const distanceAhead = d.yardLine - yards;
          if (distanceAhead < -4 || distanceAhead > VIEW_DISTANCE) return null;
          const p = project(distanceAhead);
          return (
            <Player
              key={d.id}
              x={laneScreenX(d.x, p.u)}
              y={p.y}
              scale={p.scale}
              color={defenderAccent}
              facing={-1}
              pose="run"
              number={20 + d.id}
              seed={d.id + 2}
            />
          );
        })}

        {/* Carrier */}
        <Player
          x={carrierScreenX}
          y={NEAR_Y}
          scale={NEAR_SCALE}
          color={carrierAccent}
          facing={1}
          pose={phaseRef.current === "done" && banner?.good ? "celebrate" : phaseRef.current === "done" ? "tackle" : "run"}
          number={1}
          hasBall
          seed={1}
        />
      </svg>

      {popups.map((p) => (
        <span
          key={p.id}
          className="fbr-pop pointer-events-none absolute -translate-x-1/2 rounded-full bg-[#f0d84c] px-2 py-0.5 text-[11px] font-black text-black"
          style={{ left: `${(p.x / 900) * 100}%`, top: `${(p.y / 420) * 100}%` }}
        >
          {p.text}
        </span>
      ))}

      {banner && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className="fbr-banner rounded-2xl border-2 px-6 py-3 text-3xl font-black uppercase tracking-wide"
            style={{
              color: banner.good ? "#f0d84c" : "#ff6b6b",
              borderColor: banner.good ? "#f0d84c" : "#ff6b6b",
              background: "rgba(0,0,0,0.65)",
            }}
          >
            {banner.text}
          </span>
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
          <span className="rounded-full bg-black/60 px-3 py-0.5 text-[11px] font-black text-white">{Math.round(yards)} YDS</span>
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

      {!auto && phaseRef.current === "running" && (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/40">
          Drag anywhere to steer
        </p>
      )}
    </div>
  );
}
