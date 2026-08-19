import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { Player, PLAYER_KEYFRAMES } from "./PlayerArt";
import {
  DEFENSE_FORMATION,
  FieldPos,
  OFFENSE_FORMATION,
  RouteName,
  pursuingDefense,
  resolveThrow,
  routeOffset,
} from "@/lib/football-formations";
import { footballSfx } from "@/lib/football-sfx";
import type { DriveResult } from "@/lib/football-run";

const FIELD_LENGTH = 100;
const LANE_MIN = 6;
const LANE_MAX = 94;
const PX_PER_YARD = 13;
const CENTER_X = 450;
const FIELD_TOP = 58;
const FIELD_BOTTOM = 404;
const laneToY = (lane: number) => FIELD_TOP + (lane / 100) * (FIELD_BOTTOM - FIELD_TOP);

const RUN_SPEED = 17; // yards/sec auto-advance once carrying
const STEER_RATE = 150; // lane-units/sec
const TACKLE_RADIUS = 6.5;
const DODGE_RADIUS = 15;
const ENGAGE_WINDOW = 26;
const CHASE_SPEED = 10; // yards/sec a reacting defender closes
const TICK_MS = 55;

const PRESNAP_MS = 550;
const PASS_WINDOW_MS = 2500;
const THROW_MS = 500;
/** Blocking briefly holds defenders up right after the snap/catch, giving the carrier a real gap to burst through. */
const GRACE_TICKS = Math.round(650 / TICK_MS);

type Phase = "presnap" | "passing" | "thrown" | "running" | "done";
type ReceiverAssignment = { id: string; number: number; route: RouteName; base: FieldPos };
type Defender2D = { id: string; number: number; base: FieldPos; pos: FieldPos; role: "LB" | "DB"; resolved: boolean };
type Popup = { id: number; text: string; x: number; y: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

export default function FootballPlay({
  active,
  playType,
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
  active: boolean;
  playType: "run" | "pass";
  auto?: boolean;
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
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);

  const [popups, setPopups] = useState<Popup[]>([]);
  const [banner, setBanner] = useState<{ text: string; sub: string; good: boolean } | null>(null);
  const [shake, setShake] = useState(false);

  const phaseRef = useRef<Phase>("presnap");
  const yardsRef = useRef(0);
  const carrierRef = useRef<FieldPos>({ x: 0, y: 50 });
  const dragTargetRef = useRef(50);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const aimRef = useRef<FieldPos | null>(null);
  const throwRef = useRef<{ from: FieldPos; to: FieldPos; startedAt: number } | null>(null);
  const passClockRef = useRef(0);
  const receiversRef = useRef<ReceiverAssignment[]>([]);
  const defendersRef = useRef<Defender2D[]>([]);
  const dodgesRef = useRef(0);
  /** Ticks since the ball carrier started running — defenders hold up briefly first, like blocking at the snap. */
  const runTicksRef = useRef(0);
  const playTypeRef = useRef(playType);
  const completedRef = useRef(false);
  const popupIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!active) {
      phaseRef.current = "presnap";
      return;
    }
    playTypeRef.current = playType;
    yardsRef.current = 0;
    dodgesRef.current = 0;
    completedRef.current = false;
    passClockRef.current = 0;
    aimRef.current = null;
    throwRef.current = null;
    setBanner(null);
    setPopups([]);

    const routeAssignments: RouteName[] = ["go", "slant", "curl"];
    const wrSlots = OFFENSE_FORMATION.filter((s) => s.role === "WR" || s.role === "TE");
    receiversRef.current = wrSlots.map((s, i) => ({
      id: `${s.role}${s.number}`,
      number: s.number,
      route: routeAssignments[i % routeAssignments.length],
      base: { x: s.offset.x, y: s.offset.y },
    }));

    const rb = OFFENSE_FORMATION.find((s) => s.role === "RB")!;
    carrierRef.current = { x: rb.offset.x, y: rb.offset.y };
    dragTargetRef.current = rb.offset.y;

    defendersRef.current = pursuingDefense().map((s) => ({
      id: `${s.role}${s.number}`,
      number: s.number,
      role: s.role as "LB" | "DB",
      base: { x: s.offset.x, y: s.offset.y },
      pos: { x: s.offset.x, y: s.offset.y },
      resolved: false,
    }));

    phaseRef.current = "presnap";
    bump();
    footballSfx.whistle();

    const presnapTimer = window.setTimeout(() => {
      if (playTypeRef.current === "pass") {
        phaseRef.current = "passing";
      } else {
        const carrier = carrierRef.current;
        carrierRef.current = { x: carrier.x, y: carrier.y };
        runTicksRef.current = 0;
        phaseRef.current = "running";
      }
      bump();
    }, PRESNAP_MS);

    const finish = (outcome: DriveResult["outcome"]) => {
      if (completedRef.current) return;
      completedRef.current = true;
      phaseRef.current = "done";
      const yards = clamp(yardsRef.current, outcome === "sack" ? -5 : 0, FIELD_LENGTH);
      const dodges = dodgesRef.current;
      const touchdown = outcome === "touchdown";

      if (touchdown) {
        footballSfx.crowd(1);
        setBanner({ text: "TOUCHDOWN!", sub: `+${Math.round(yards)} yards, +${dodges * 50} dodge bonus`, good: true });
      } else if (outcome === "tackled") {
        footballSfx.impact(0.9);
        footballSfx.crowd(0.35);
        setShake(true);
        window.setTimeout(() => setShake(false), 220);
        setBanner({ text: "TACKLED", sub: `${Math.round(yards)} yards, ${dodges} dodge${dodges === 1 ? "" : "s"}`, good: false });
      } else if (outcome === "interception") {
        footballSfx.crowd(0.7);
        setBanner({ text: "INTERCEPTED!", sub: "Turnover", good: false });
      } else if (outcome === "sack") {
        footballSfx.impact(0.5);
        setBanner({ text: "SACKED", sub: "Held the ball too long", good: false });
      } else {
        footballSfx.whiff();
        setBanner({ text: "INCOMPLETE", sub: "Pass falls incomplete", good: false });
      }

      window.setTimeout(() => {
        const score = Math.round(Math.max(0, yards) + dodges * 50 + (touchdown ? 500 : 0));
        onComplete({ yards, dodges, touchdown, score, outcome, playType: playTypeRef.current });
      }, 1300);
    };

    const id = window.setInterval(() => {
      const dt = TICK_MS / 1000;
      const phase = phaseRef.current;

      if (phase === "passing") {
        passClockRef.current += TICK_MS;
        const u = clamp(passClockRef.current / PASS_WINDOW_MS, 0, 1);
        receiversRef.current.forEach((r) => {
          const off = routeOffset(r.route, u);
          // stash live position on the object for reuse without extra state
          (r as any).pos = { x: r.base.x + off.x, y: clamp(r.base.y + off.y, LANE_MIN, LANE_MAX) };
        });
        // Man coverage: each of the first three DBs shadows one route runner with a cushion.
        const dbs = defendersRef.current.filter((d) => d.role === "DB");
        dbs.forEach((db, i) => {
          const target = receiversRef.current[i % receiversRef.current.length];
          const tpos = (target as any).pos || target.base;
          const cushionTarget = { x: tpos.x - 4, y: tpos.y };
          db.pos = { x: lerp(db.pos.x, cushionTarget.x, 0.06), y: lerp(db.pos.y, cushionTarget.y, 0.06) };
        });
        defendersRef.current
          .filter((d) => d.role === "LB")
          .forEach((lb) => {
            lb.pos = { x: lerp(lb.pos.x, lb.base.x + 2, 0.03), y: lerp(lb.pos.y, lb.base.y, 0.03) };
          });

        if (auto && !throwRef.current) {
          // Simple auto-QB: throw to whichever eligible receiver has the most separation once the window is mostly spent.
          if (u > 0.45 + Math.random() * 0.3) {
            let best = receiversRef.current[0];
            let bestSep = -1;
            receiversRef.current.forEach((r) => {
              const rp = (r as any).pos || r.base;
              const nearestDb = defendersRef.current
                .filter((d) => d.role === "DB")
                .reduce((m, d) => Math.min(m, Math.hypot(d.pos.x - rp.x, d.pos.y - rp.y)), Infinity);
              if (nearestDb > bestSep) {
                bestSep = nearestDb;
                best = r;
              }
            });
            const rp = (best as any).pos || best.base;
            aimRef.current = rp;
            throwRef.current = { from: { x: -4, y: 50 }, to: rp, startedAt: passClockRef.current };
            phaseRef.current = "thrown";
          }
        }

        if (passClockRef.current >= PASS_WINDOW_MS) {
          finish("sack");
        }
      } else if (phase === "thrown" && throwRef.current) {
        const elapsed = passClockRef.current - throwRef.current.startedAt + TICK_MS;
        passClockRef.current += TICK_MS;
        if (elapsed >= THROW_MS) {
          const target = throwRef.current.to;
          const receiversNow = receiversRef.current.map((r) => ({ id: r.id, pos: (r as any).pos || r.base }));
          const defendersNow = defendersRef.current.map((d) => ({ id: d.id, pos: d.pos }));
          const result = resolveThrow(target, receiversNow, defendersNow);
          if (result.outcome === "catch") {
            footballSfx.impact(0.35);
            const caught = receiversNow.find((r) => r.id === result.receiverId);
            carrierRef.current = caught ? { ...caught.pos } : target;
            yardsRef.current = carrierRef.current.x;
            dragTargetRef.current = carrierRef.current.y;
            runTicksRef.current = 0;
            phaseRef.current = "running";
          } else if (result.outcome === "interception") {
            finish("interception");
          } else {
            finish("incomplete");
          }
        }
      } else if (phase === "running") {
        runTicksRef.current += 1;
        const pastGrace = runTicksRef.current > GRACE_TICKS;
        yardsRef.current = clamp(yardsRef.current + RUN_SPEED * dt, 0, FIELD_LENGTH);

        if (auto) {
          const threat = defendersRef.current
            .filter((d) => !d.resolved)
            .map((d) => ({ d, dist: d.pos.x - yardsRef.current }))
            .filter((t) => t.dist > -3 && t.dist < ENGAGE_WINDOW)
            .sort((a, b) => a.dist - b.dist)[0];
          if (threat && Math.random() < skill) {
            const away = carrierRef.current.y >= threat.d.pos.y ? 1 : -1;
            dragTargetRef.current = clamp(carrierRef.current.y + away * 24, LANE_MIN, LANE_MAX);
          } else if (!threat) {
            dragTargetRef.current = lerp(dragTargetRef.current, 50, 0.02);
          }
        }

        const maxStep = STEER_RATE * dt;
        const dy = clamp(dragTargetRef.current, LANE_MIN, LANE_MAX) - carrierRef.current.y;
        const newY = clamp(carrierRef.current.y + clamp(dy, -maxStep, maxStep), LANE_MIN, LANE_MAX);
        carrierRef.current = { x: yardsRef.current, y: newY };

        const newPopups: Popup[] = [];
        for (const def of defendersRef.current) {
          if (def.resolved) continue;
          const distanceAhead = def.pos.x - yardsRef.current;
          if (!pastGrace) continue;
          if (distanceAhead <= ENGAGE_WINDOW) {
            const toward = { x: carrierRef.current.x + 3, y: carrierRef.current.y };
            def.pos = {
              x: lerp(def.pos.x, toward.x, Math.min(1, (CHASE_SPEED * dt) / 8)),
              y: lerp(def.pos.y, toward.y, Math.min(1, (CHASE_SPEED * dt) / 5)),
            };
          }
          const dist = Math.hypot(carrierRef.current.x - def.pos.x, carrierRef.current.y - def.pos.y);
          if (dist < TACKLE_RADIUS) {
            def.resolved = true;
            finish("tackled");
            break;
          }
          if (distanceAhead < -2 && !def.resolved) {
            def.resolved = true;
            if (dist < DODGE_RADIUS) {
              dodgesRef.current += 1;
              footballSfx.impact(0.22);
              popupIdRef.current += 1;
              newPopups.push({
                id: popupIdRef.current,
                text: "DODGE +50",
                x: CENTER_X + (carrierRef.current.x - yardsRef.current) * PX_PER_YARD,
                y: laneToY(carrierRef.current.y) - 40,
              });
            }
          }
        }
        if (newPopups.length) {
          setPopups((p) => [...p, ...newPopups]);
          newPopups.forEach((p) => window.setTimeout(() => setPopups((cur) => cur.filter((x) => x.id !== p.id)), 900));
        }

        if (phaseRef.current === "running" && yardsRef.current >= FIELD_LENGTH) {
          finish("touchdown");
        }
      }

      bump();
    }, TICK_MS);

    return () => {
      window.clearTimeout(presnapTimer);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, playType]);

  // ---- Pointer controls -----------------------------------------------------
  const screenToWorld = (clientX: number, clientY: number): FieldPos | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * 900;
    const sy = ((clientY - rect.top) / rect.height) * 420;
    const cameraX = phaseRef.current === "passing" || phaseRef.current === "thrown" ? -4 : yardsRef.current;
    const worldX = cameraX + (sx - CENTER_X) / PX_PER_YARD;
    const worldY = clamp(((sy - FIELD_TOP) / (FIELD_BOTTOM - FIELD_TOP)) * 100, 0, 100);
    return { x: worldX, y: worldY };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (auto) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (phaseRef.current === "passing") {
      const w = screenToWorld(e.clientX, e.clientY);
      if (w) aimRef.current = w;
    } else if (phaseRef.current === "running") {
      lastTouchRef.current = { x: e.clientX, y: e.clientY };
    }
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (auto) return;
    if (phaseRef.current === "passing" && aimRef.current) {
      const w = screenToWorld(e.clientX, e.clientY);
      if (w) aimRef.current = w;
      bump();
    } else if (phaseRef.current === "running" && lastTouchRef.current) {
      const deltaPx = e.clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: e.clientX, y: e.clientY };
      const container = containerRef.current;
      const heightPx = container?.clientHeight || 1;
      const deltaLane = (deltaPx / heightPx) * 160;
      dragTargetRef.current = clamp(dragTargetRef.current + deltaLane, LANE_MIN, LANE_MAX);
    }
  };
  const handlePointerUp = () => {
    if (auto) return;
    if (phaseRef.current === "passing" && aimRef.current) {
      throwRef.current = { from: { x: -4, y: 50 }, to: aimRef.current, startedAt: passClockRef.current };
      phaseRef.current = "thrown";
    }
    lastTouchRef.current = null;
  };

  if (!active) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(140,40%,6%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{driveLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other drive to finish…</p>
      </div>
    );
  }

  const phase = phaseRef.current;
  const cameraX = phase === "passing" || phase === "thrown" ? -4 : yardsRef.current;
  const sx = (worldX: number) => CENTER_X + (worldX - cameraX) * PX_PER_YARD;
  const sy = (laneY: number) => laneToY(laneY);

  const qbPos = { x: -4, y: 50 };
  const isPassing = phase === "passing" || phase === "thrown";

  let ballScreen: { x: number; y: number; visible: boolean } | null = null;
  if (isPassing) {
    if (phase === "thrown" && throwRef.current) {
      const elapsed = clamp((passClockRef.current - throwRef.current.startedAt) / THROW_MS, 0, 1);
      const flightX = lerp(throwRef.current.from.x, throwRef.current.to.x, elapsed);
      const flightY = lerp(throwRef.current.from.y, throwRef.current.to.y, elapsed);
      const arc = Math.sin(Math.PI * elapsed) * 26;
      ballScreen = { x: sx(flightX), y: sy(flightY) - arc, visible: true };
    } else {
      ballScreen = { x: sx(qbPos.x + 2), y: sy(qbPos.y), visible: true };
    }
  } else if (phase === "running" || phase === "done") {
    ballScreen = { x: sx(carrierRef.current.x + 4), y: sy(carrierRef.current.y) + 3, visible: true };
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full touch-none select-none overflow-hidden ${shake ? "fbp-shaking" : ""}`}
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
        @keyframes fbp-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes fbp-pop { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { transform: translateY(-6px) scale(1.1); opacity: 1; } 100% { transform: translateY(-46px) scale(1); opacity: 0; } }
        @keyframes fbp-banner { 0% { transform: scale(0.5); opacity: 0; } 40% { transform: scale(1.08); opacity: 1; } 75% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
        @keyframes fbp-hike { 0% { opacity: 0; transform: scale(0.7); } 30% { opacity: 1; transform: scale(1.1); } 60% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
        .fbp-shaking { animation: fbp-shake 180ms ease-in-out 2; }
        .fbp-pop { animation: fbp-pop 900ms ease-out forwards; }
        .fbp-banner { animation: fbp-banner 1.3s ease-out forwards; }
        .fbp-hike { animation: fbp-hike 700ms ease-out forwards; }
        ${PLAYER_KEYFRAMES}
      `}</style>

      <svg ref={svgRef} viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
        <defs>
          <linearGradient id="fbp-turf-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(132 42% 21%)" />
            <stop offset="100%" stopColor="hsl(132 46% 15%)" />
          </linearGradient>
          <linearGradient id="fbp-turf-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(132 46% 24%)" />
            <stop offset="100%" stopColor="hsl(132 48% 17%)" />
          </linearGradient>
        </defs>
        <rect width="900" height="420" fill="hsl(140 40% 5%)" />

        {/* Turf stripes every 10 yards, scrolling with the camera */}
        {Array.from({ length: 14 }).map((_, i) => {
          const worldStart = i * 10 - 20;
          const x1 = sx(worldStart);
          const x2 = sx(worldStart + 10);
          return <rect key={i} x={Math.min(x1, x2)} y={FIELD_TOP} width={Math.abs(x2 - x1)} height={FIELD_BOTTOM - FIELD_TOP} fill={i % 2 === 0 ? "url(#fbp-turf-a)" : "url(#fbp-turf-b)"} />;
        })}
        {/* Yard lines + numbers */}
        {Array.from({ length: 11 }).map((_, i) => {
          const worldYard = i * 10;
          const x = sx(worldYard);
          if (x < -20 || x > 920) return null;
          const label = worldYard <= 50 ? worldYard : 100 - worldYard;
          return (
            <g key={i}>
              <line x1={x} y1={FIELD_TOP} x2={x} y2={FIELD_BOTTOM} stroke="rgba(255,255,255,0.4)" strokeWidth={worldYard === 0 || worldYard === 100 ? 3 : 1.4} />
              {worldYard !== 0 && worldYard !== 100 && label > 0 && (
                <text x={x} y={FIELD_TOP + 26} textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="15" fill="rgba(255,255,255,0.32)">
                  {label}
                </text>
              )}
              {/* Hash marks */}
              <line x1={x - 5} y1={FIELD_TOP + 90} x2={x + 5} y2={FIELD_TOP + 90} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
              <line x1={x - 5} y1={FIELD_BOTTOM - 90} x2={x + 5} y2={FIELD_BOTTOM - 90} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
            </g>
          );
        })}
        {/* End zone */}
        <rect x={Math.min(sx(100), sx(112))} y={FIELD_TOP} width={Math.abs(sx(112) - sx(100))} height={FIELD_BOTTOM - FIELD_TOP} fill={carrierAccent} opacity="0.22" />
        <rect x={Math.min(sx(0), sx(-12))} y={FIELD_TOP} width={Math.abs(sx(0) - sx(-12))} height={FIELD_BOTTOM - FIELD_TOP} fill={defenderAccent} opacity="0.22" />

        {/* ---- Players ---- */}
        {/* Offensive line: static at the LOS */}
        {OFFENSE_FORMATION.filter((s) => s.role === "OL").map((s) => (
          <Player key={`ol-${s.number}`} x={sx(s.offset.x)} y={sy(s.offset.y)} scale={0.56} color={carrierAccent} facing={1} pose="idle" number={s.number} seed={s.number} />
        ))}
        {/* Defensive line: static, engaged at the LOS */}
        {DEFENSE_FORMATION.filter((s) => s.role === "DL").map((s) => (
          <Player key={`dl-${s.number}`} x={sx(s.offset.x)} y={sy(s.offset.y)} scale={0.56} color={defenderAccent} facing={-1} pose="idle" number={s.number} seed={s.number + 5} />
        ))}
        {/* QB (always shown near the LOS during pass/presnap; hidden once the carrier is elsewhere on a run play) */}
        {(isPassing || phase === "presnap") && (
          <Player x={sx(qbPos.x)} y={sy(qbPos.y)} scale={0.95} color={carrierAccent} facing={1} pose={phase === "thrown" ? "throw" : "idle"} number={7} hasBall={isPassing && (!throwRef.current || phase !== "thrown")} seed={1} />
        )}
        {/* Receivers running routes (pass plays only) */}
        {playTypeRef.current === "pass" &&
          receiversRef.current.map((r) => {
            const pos = (r as any).pos || r.base;
            const isCarrier = phase === "running" && Math.abs(carrierRef.current.x - pos.x) < 0.01 && Math.abs(carrierRef.current.y - pos.y) < 0.01;
            if (phase === "running" || phase === "done") return null; // carrier rendered separately once caught
            return <Player key={r.id} x={sx(pos.x)} y={sy(pos.y)} scale={0.95} color={carrierAccent} facing={1} pose="run" number={r.number} seed={r.number} />;
          })}
        {/* Running back (visible pre-carry on run plays) */}
        {playTypeRef.current === "run" && phase === "presnap" && (
          <Player x={sx(carrierRef.current.x)} y={sy(carrierRef.current.y)} scale={0.95} color={carrierAccent} facing={1} pose="idle" number={28} seed={28} />
        )}
        {/* Pursuing defenders */}
        {defendersRef.current.map((d) => {
          if (d.resolved && phase === "running") return null;
          return <Player key={d.id} x={sx(d.pos.x)} y={sy(d.pos.y)} scale={0.72} color={defenderAccent} facing={-1} pose="run" number={d.number} seed={d.number + 3} />;
        })}
        {/* Ball carrier during the run phase */}
        {(phase === "running" || phase === "done") && (
          <Player
            x={sx(carrierRef.current.x)}
            y={sy(carrierRef.current.y)}
            scale={1.05}
            color={carrierAccent}
            facing={1}
            pose={phase === "done" && banner?.good ? "celebrate" : phase === "done" ? "tackle" : "run"}
            number={playTypeRef.current === "run" ? 28 : 11}
            hasBall
            seed={playTypeRef.current === "run" ? 28 : 11}
          />
        )}

        {/* Aim reticle while dragging to throw */}
        {phase === "passing" && aimRef.current && (
          <circle cx={sx(aimRef.current.x)} cy={sy(aimRef.current.y)} r="12" fill="none" stroke="#f0d84c" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.9" />
        )}

        {/* Ball */}
        {ballScreen?.visible && (
          <ellipse cx={ballScreen.x} cy={ballScreen.y} rx="6.5" ry="4" fill="#6b4226" stroke="#1a0f08" strokeWidth="1.2" />
        )}
      </svg>

      {phase === "presnap" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="fbp-hike rounded-xl border-2 border-[#f0d84c] bg-black/60 px-5 py-2 text-2xl font-black uppercase tracking-widest text-[#f0d84c]">
            {playType === "pass" ? "Hike!" : "Snap!"}
          </span>
        </div>
      )}

      {popups.map((p) => (
        <span
          key={p.id}
          className="fbp-pop pointer-events-none absolute -translate-x-1/2 rounded-full bg-[#f0d84c] px-2 py-0.5 text-[11px] font-black text-black"
          style={{ left: `${(p.x / 900) * 100}%`, top: `${(p.y / 420) * 100}%` }}
        >
          {p.text}
        </span>
      ))}

      {banner && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="fbp-banner flex flex-col items-center gap-1 rounded-2xl border-2 px-6 py-3 text-center"
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
          <span className="rounded-full bg-black/60 px-3 py-0.5 text-[11px] font-black text-white">
            {phase === "passing" || phase === "thrown" ? "PASSING" : `${Math.round(Math.max(0, yardsRef.current))} YDS`}
          </span>
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

      {!auto && phase === "passing" && (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/40">
          Tap or drag to a receiver, release to throw
        </p>
      )}
      {!auto && phase === "running" && (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/40">Drag up/down to weave</p>
      )}
    </div>
  );
}
