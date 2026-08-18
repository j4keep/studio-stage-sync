import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, HelpCircle, Volume2, VolumeX } from "lucide-react";
import {
  BALL_COLORS,
  BALL_R,
  Ball,
  Group,
  MAX_SHOT_SPEED,
  POCKETS,
  ShotSimResult,
  TABLE_H,
  TABLE_W,
  canPlaceCueBall,
  groupBallIds,
  isStripe,
} from "@/lib/pool";
import { poolSfx } from "@/lib/pool-sfx";

const RAIL = 46;
const WORLD_W = TABLE_W + RAIL * 2;
const WORLD_H = TABLE_H + RAIL * 2;
const PLAYBACK_STEPS_PER_TICK = 5;

type Vec = { x: number; y: number };

type Props = {
  balls: Ball[];
  playback: ShotSimResult | null;
  onPlaybackDone: () => void;
  interactive: boolean;
  ballInHand: boolean;
  onShoot: (angle: number, power: number) => void;
  onPlaceCue: (x: number, y: number) => void;
  myTurn: boolean;
  finished: boolean;
  myName: string;
  myAvatar: string | null;
  myGroup: Group | null;
  oppName: string;
  oppAvatar: string | null;
  oppGroup: Group | null;
  isComputer: boolean;
  turnLabel: string;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  howToPlay: string[];
};

/** Cast the aim ray from the cue ball forward, returning where it first meets a ball or a rail. */
function castAimRay(cue: Vec, angle: number, balls: Ball[]) {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  let bestT = Infinity;
  let hitBall: Ball | null = null;
  for (const b of balls) {
    if (b.id === 0 || b.potted) continue;
    const ox = b.x - cue.x;
    const oy = b.y - cue.y;
    const proj = ox * dir.x + oy * dir.y;
    if (proj <= 0) continue;
    const closestX = cue.x + dir.x * proj;
    const closestY = cue.y + dir.y * proj;
    const distSq = (b.x - closestX) ** 2 + (b.y - closestY) ** 2;
    const r2 = (BALL_R * 2) ** 2;
    if (distSq < r2) {
      const backoff = Math.sqrt(r2 - distSq);
      const t = proj - backoff;
      if (t > 0 && t < bestT) {
        bestT = t;
        hitBall = b;
      }
    }
  }
  let railT = Infinity;
  if (dir.x > 0) railT = Math.min(railT, (TABLE_W - BALL_R - cue.x) / dir.x);
  if (dir.x < 0) railT = Math.min(railT, (BALL_R - cue.x) / dir.x);
  if (dir.y > 0) railT = Math.min(railT, (TABLE_H - BALL_R - cue.y) / dir.y);
  if (dir.y < 0) railT = Math.min(railT, (BALL_R - cue.y) / dir.y);
  const t = Math.max(0, Math.min(bestT, railT, 900));
  return {
    point: { x: cue.x + dir.x * t, y: cue.y + dir.y * t },
    hitBall: bestT < railT ? hitBall : null,
  };
}

function BallDot({ id, potted }: { id: number; potted: boolean }) {
  const stripe = isStripe(id);
  return (
    <span
      className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[6.5px] font-black transition-opacity"
      style={{
        background: stripe
          ? `linear-gradient(90deg, ${BALL_COLORS[id]} 30%, #f5f2ea 30% 70%, ${BALL_COLORS[id]} 70%)`
          : BALL_COLORS[id],
        color: stripe || id <= 7 ? "#111" : "#f5f2ea",
        opacity: potted ? 0.28 : 1,
        boxShadow: potted ? "none" : "0 1px 2px rgba(0,0,0,0.5)",
      }}
    >
      {id}
      {potted && <span className="absolute inset-0 rounded-full bg-black/55" />}
    </span>
  );
}

function BallTrackerRow({ group, balls, align }: { group: Group | null; balls: Ball[]; align: "left" | "right" }) {
  if (!group) {
    return <span className="text-[9px] font-bold uppercase tracking-wide text-white/45">Open table</span>;
  }
  const ids = groupBallIds(group);
  return (
    <div className={`flex items-center gap-[3px] ${align === "right" ? "flex-row-reverse" : ""}`}>
      {ids.map((id) => (
        <BallDot key={id} id={id} potted={Boolean(balls.find((b) => b.id === id)?.potted)} />
      ))}
    </div>
  );
}

function PoolPod({
  name,
  avatarUrl,
  isComputer,
  group,
  balls,
  active,
  align = "left",
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  isComputer?: boolean;
  group: Group | null;
  balls: Ball[];
  active: boolean;
  align?: "left" | "right";
  size?: "sm" | "md";
}) {
  const avatarDim = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  return (
    <div className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <div className="relative shrink-0">
        <div
          className={`flex items-center justify-center overflow-hidden rounded-full p-[2px] ${avatarDim}`}
          style={{
            background: active ? "hsl(var(--primary))" : "rgba(255,255,255,0.14)",
            boxShadow: active ? "0 0 14px hsl(var(--primary) / 0.6)" : undefined,
          }}
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#0c1a12]">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : isComputer ? (
              <Bot className="h-3.5 w-3.5 text-primary" />
            ) : (
              <span className="text-[10px] font-black text-primary">{name.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>
        {active && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#0c1a12] bg-primary" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-black leading-tight text-white">{name}</p>
        <BallTrackerRow group={group} balls={balls} align={align} />
      </div>
    </div>
  );
}

/** Vertical drag-to-charge power control, decoupled from the aim gesture on the table. */
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
      <span className="text-[7px] font-black uppercase tracking-wide text-white/45">Power</span>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/40"
        style={{ background: "hsl(204 100% 60%)", boxShadow: "0 0 6px hsl(204 100% 60% / 0.7)" }}
        aria-hidden="true"
      />
      <div
        ref={trackRef}
        onPointerDown={handleDown}
        className="relative w-8 flex-1 touch-none overflow-hidden rounded-full border border-black/40"
        style={{
          touchAction: "none",
          opacity: disabled ? 0.45 : 1,
          background: "linear-gradient(180deg, #e8c78a 0%, #c99a5e 35%, #8a5a2b 70%, #5a3a1e 100%)",
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        {/* Wood grain ticks so the track unmistakably reads as a cue. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-1.5 py-3 opacity-40">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-px w-full bg-black/40" />
          ))}
        </div>
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-75"
          style={{
            height: `${fill * 100}%`,
            background: "linear-gradient(0deg, hsl(204 100% 55%) 0%, #4dd0ff 55%, #ffb020 82%, #ff4d4d 100%)",
            opacity: 0.88,
            boxShadow: fill > 0.05 ? "0 0 14px hsl(204 100% 55% / 0.8)" : undefined,
          }}
        />
        <div
          className="absolute inset-x-0 flex h-5 -translate-y-1/2 items-center justify-center"
          style={{ bottom: `${fill * 100}%` }}
        >
          <div className="h-1.5 w-[85%] rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
        </div>
      </div>
      <span className="text-[7px] font-black uppercase tracking-wide text-white/40">{Math.round(fill * 100)}</span>
    </div>
  );
}

export default function PoolTable({
  balls,
  playback,
  onPlaybackDone,
  interactive,
  ballInHand,
  onShoot,
  onPlaceCue,
  myTurn,
  finished,
  myName,
  myAvatar,
  myGroup,
  oppName,
  oppAvatar,
  oppGroup,
  isComputer,
  turnLabel,
  muted,
  onToggleMute,
  onBack,
  howToPlay,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [help, setHelp] = useState(false);
  const [scale, setScale] = useState(1);

  // Mutable game-loop state, kept out of React state so the draw loop never re-renders.
  const stateRef = useRef({
    balls,
    playback: null as ShotSimResult | null,
    frameIdx: 0,
    firedIdx: 0,
    aimingDrag: false,
    aimAngle: 0,
    power: 0,
    placing: false,
    placement: null as Vec | null,
    interactive,
    ballInHand,
    finished,
    dots: null as Vec[] | null,
  });

  // Sync latest props into the ref every render.
  stateRef.current.balls = balls;
  stateRef.current.interactive = interactive;
  stateRef.current.ballInHand = ballInHand;
  stateRef.current.finished = finished;

  const onPlaybackDoneRef = useRef(onPlaybackDone);
  onPlaybackDoneRef.current = onPlaybackDone;
  const onShootRef = useRef(onShoot);
  onShootRef.current = onShoot;
  const onPlaceCueRef = useRef(onPlaceCue);
  onPlaceCueRef.current = onPlaceCue;

  // New playback assigned -> (re)start animation from frame 0.
  useEffect(() => {
    stateRef.current.playback = playback;
    stateRef.current.frameIdx = 0;
    stateRef.current.firedIdx = 0;
    if (playback) {
      stateRef.current.aimingDrag = false;
      stateRef.current.power = 0;
      stateRef.current.placing = false;
      const cue0 = playback.frames[0]?.find((b) => b.id === 0);
      if (cue0) {
        const speed = Math.hypot(cue0.vx, cue0.vy);
        poolSfx.strike(speed / MAX_SHOT_SPEED);
      }
    }
  }, [playback]);

  // Responsive sizing.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      const s = Math.min(w / WORLD_W, h / WORLD_H);
      setScale(s);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Canvas backing store + draw loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scale) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(WORLD_W * scale * dpr);
    canvas.height = Math.round(WORLD_H * scale * dpr);
    canvas.style.width = `${WORLD_W * scale}px`;
    canvas.style.height = `${WORLD_H * scale}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!stateRef.current.dots) {
      const dots: Vec[] = [];
      let seed = 42;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      for (let i = 0; i < 220; i++) dots.push({ x: rand() * TABLE_W, y: rand() * TABLE_H });
      stateRef.current.dots = dots;
    }

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const st = stateRef.current;

      // Advance playback.
      let displayBalls = st.balls;
      if (st.playback) {
        const pb = st.playback;
        const lastIdx = pb.frames.length - 1;
        const prevIdx = st.frameIdx;
        st.frameIdx = Math.min(prevIdx + PLAYBACK_STEPS_PER_TICK, lastIdx);
        displayBalls = pb.frames[st.frameIdx];

        // Fire any sound events whose frame falls within the range we just advanced through.
        for (const f of pb.hitFrames) if (f > st.firedIdx && f <= st.frameIdx) poolSfx.click(1);
        for (const f of pb.railFrames) if (f > st.firedIdx && f <= st.frameIdx) poolSfx.rail(1);
        for (const f of pb.pocketFrames) if (f > st.firedIdx && f <= st.frameIdx) poolSfx.pocket();
        st.firedIdx = st.frameIdx;

        if (st.frameIdx >= lastIdx) {
          st.playback = null;
          onPlaybackDoneRef.current();
        }
      } else if (st.placing && st.placement) {
        displayBalls = st.balls.map((b) => (b.id === 0 ? { ...b, x: st.placement!.x, y: st.placement!.y, potted: false } : b));
      }

      const px = scale * dpr;
      ctx.setTransform(px, 0, 0, px, 0, 0);
      ctx.clearRect(0, 0, WORLD_W, WORLD_H);

      // Outer shadow (lifts the table off the background).
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = "#000";
      roundRect(ctx, 0, 0, WORLD_W, WORLD_H, 26);
      ctx.fill();
      ctx.restore();

      // Wood rail — layered gradient for a bevelled, 3D edge.
      const railGrad = ctx.createLinearGradient(0, 0, WORLD_W, WORLD_H);
      railGrad.addColorStop(0, "#6b4526");
      railGrad.addColorStop(0.15, "#4a2c16");
      railGrad.addColorStop(0.5, "#2a180c");
      railGrad.addColorStop(0.85, "#3a2214");
      railGrad.addColorStop(1, "#5a3a1e");
      ctx.fillStyle = railGrad;
      roundRect(ctx, 0, 0, WORLD_W, WORLD_H, 26);
      ctx.fill();
      // Inner bevel highlight/shadow ring.
      ctx.save();
      roundRect(ctx, 3, 3, WORLD_W - 6, WORLD_H - 6, 23);
      ctx.clip();
      const bevel = ctx.createLinearGradient(0, 0, WORLD_W * 0.5, WORLD_H * 0.5);
      bevel.addColorStop(0, "rgba(255,255,255,0.22)");
      bevel.addColorStop(0.4, "rgba(255,255,255,0)");
      ctx.strokeStyle = bevel;
      ctx.lineWidth = 6;
      roundRect(ctx, 4, 4, WORLD_W - 8, WORLD_H - 8, 22);
      ctx.stroke();
      ctx.restore();

      // Cushion nose — the distinct trim band between the wood rail and the felt.
      const cushionInset = 14;
      ctx.save();
      roundRect(ctx, RAIL - cushionInset, RAIL - cushionInset, TABLE_W + cushionInset * 2, TABLE_H + cushionInset * 2, 12);
      ctx.clip();
      const cushionGrad = ctx.createLinearGradient(0, RAIL - cushionInset, 0, RAIL + TABLE_H + cushionInset);
      cushionGrad.addColorStop(0, "#0a4864");
      cushionGrad.addColorStop(0.5, "#083a52");
      cushionGrad.addColorStop(1, "#062c3e");
      ctx.fillStyle = cushionGrad;
      ctx.fillRect(RAIL - cushionInset, RAIL - cushionInset, TABLE_W + cushionInset * 2, TABLE_H + cushionInset * 2);
      ctx.restore();
      ctx.strokeStyle = "hsl(204 90% 62% / 0.5)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, RAIL - cushionInset + 1.5, RAIL - cushionInset + 1.5, TABLE_W + cushionInset * 2 - 3, TABLE_H + cushionInset * 2 - 3, 11);
      ctx.stroke();

      // Felt.
      ctx.save();
      roundRect(ctx, RAIL, RAIL, TABLE_W, TABLE_H, 6);
      ctx.clip();
      const feltGrad = ctx.createRadialGradient(
        RAIL + TABLE_W / 2,
        RAIL + TABLE_H * 0.35,
        40,
        RAIL + TABLE_W / 2,
        RAIL + TABLE_H / 2,
        TABLE_W * 0.75,
      );
      feltGrad.addColorStop(0, "#12648a");
      feltGrad.addColorStop(0.55, "#0b4a68");
      feltGrad.addColorStop(1, "#052738");
      ctx.fillStyle = feltGrad;
      ctx.fillRect(RAIL, RAIL, TABLE_W, TABLE_H);

      // Subtle felt texture.
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (const d of st.dots!) {
        ctx.beginPath();
        ctx.arc(RAIL + d.x, RAIL + d.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      // Bright trim line where the felt meets the cushion.
      ctx.strokeStyle = "hsl(204 100% 70% / 0.5)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, RAIL + 3, RAIL + 3, TABLE_W - 6, TABLE_H - 6, 4);
      ctx.stroke();
      // Inner shadow for depth.
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 10;
      roundRect(ctx, RAIL + 5, RAIL + 5, TABLE_W - 10, TABLE_H - 10, 4);
      ctx.stroke();

      // Rail diamonds.
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 1; i < 8; i++) {
        const x = RAIL + (TABLE_W / 8) * i;
        if (Math.abs(x - (RAIL + TABLE_W / 2)) < 2) continue;
        ctx.beginPath();
        ctx.arc(x, RAIL - cushionInset - 10, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, RAIL + TABLE_H + cushionInset + 10, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 1; i < 4; i++) {
        const y = RAIL + (TABLE_H / 4) * i;
        ctx.beginPath();
        ctx.arc(RAIL - cushionInset - 10, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(RAIL + TABLE_W + cushionInset + 10, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pockets — a leather lip ring around a deep black cup.
      for (const p of POCKETS) {
        const cx = RAIL + p.x;
        const cy = RAIL + p.y;
        ctx.beginPath();
        ctx.arc(cx, cy, p.r * 1.05, 0, Math.PI * 2);
        ctx.fillStyle = "#1c1108";
        ctx.fill();
        const g = ctx.createRadialGradient(cx, cy, p.r * 0.15, cx, cy, p.r * 0.85);
        g.addColorStop(0, "#000000");
        g.addColorStop(0.75, "#080808");
        g.addColorStop(1, "#2a1a0e");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, p.r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Turn glow border.
      if (st.interactive) {
        ctx.strokeStyle = "hsl(204 100% 55% / 0.55)";
        ctx.lineWidth = 3;
        roundRect(ctx, RAIL - 3, RAIL - 3, TABLE_W + 6, TABLE_H + 6, 10);
        ctx.stroke();
      }

      const cue = displayBalls.find((b) => b.id === 0);

      // Aim guide + cue stick — persistent once it's your turn, not just mid-drag.
      if (st.interactive && !st.playback && !st.ballInHand && cue && !cue.potted) {
        const cuePos = { x: RAIL + cue.x, y: RAIL + cue.y };
        const ray = castAimRay(cue, st.aimAngle, displayBalls);
        ctx.save();
        ctx.setLineDash([6, 7]);
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cuePos.x, cuePos.y);
        ctx.lineTo(RAIL + ray.point.x, RAIL + ray.point.y);
        ctx.stroke();
        ctx.restore();

        if (ray.hitBall) {
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(RAIL + ray.point.x, RAIL + ray.point.y, BALL_R, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Cue stick pulled back opposite the shot direction, charge driven by the side slider.
        const pull = 18 + st.power * 150;
        const tipGap = 10;
        const dx = Math.cos(st.aimAngle);
        const dy = Math.sin(st.aimAngle);
        const tipX = cuePos.x - dx * tipGap;
        const tipY = cuePos.y - dy * tipGap;
        const buttX = cuePos.x - dx * (tipGap + pull + 210);
        const buttY = cuePos.y - dy * (tipGap + pull + 210);
        const midX = cuePos.x - dx * (tipGap + pull);
        const midY = cuePos.y - dy * (tipGap + pull);
        ctx.save();
        ctx.lineCap = "round";
        const stickGrad = ctx.createLinearGradient(buttX, buttY, midX, midY);
        stickGrad.addColorStop(0, "#5a3a1e");
        stickGrad.addColorStop(1, "#c99a5e");
        ctx.strokeStyle = stickGrad;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(buttX, buttY);
        ctx.lineTo(midX, midY);
        ctx.stroke();
        ctx.strokeStyle = "hsl(204 100% 55%)";
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.restore();
      }

      // Ball-in-hand placement preview.
      if (st.placing && st.placement) {
        const ok = canPlaceCueBall(
          st.balls.filter((b) => b.id !== 0),
          st.placement.x,
          st.placement.y,
        );
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = ok ? "hsl(204 100% 55%)" : "#ff5050";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(RAIL + st.placement.x, RAIL + st.placement.y, BALL_R + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Balls.
      for (const b of displayBalls) {
        if (b.potted) continue;
        drawBall(ctx, RAIL + b.x, RAIL + b.y, b.id);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scale]);

  // Pointer interaction.
  const canvasToTable = (clientX: number, clientY: number): Vec | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WORLD_W - RAIL;
    const y = ((clientY - rect.top) / rect.height) * WORLD_H - RAIL;
    return { x, y };
  };

  const clampTable = (p: Vec): Vec => ({
    x: Math.max(BALL_R, Math.min(TABLE_W - BALL_R, p.x)),
    y: Math.max(BALL_R, Math.min(TABLE_H - BALL_R, p.y)),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleDown = (e: PointerEvent) => {
      const st = stateRef.current;
      if (!st.interactive || st.playback || st.finished) return;
      const pt = canvasToTable(e.clientX, e.clientY);
      if (!pt) return;
      e.preventDefault();
      if (st.ballInHand) {
        st.placing = true;
        st.placement = clampTable(pt);
      } else {
        const cue = st.balls.find((b) => b.id === 0);
        if (!cue || cue.potted) return;
        st.aimingDrag = true;
        st.aimAngle = Math.atan2(pt.y - cue.y, pt.x - cue.x);
      }
      window.addEventListener("pointermove", handleMove, { passive: false });
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);
    };

    const handleMove = (e: PointerEvent) => {
      const st = stateRef.current;
      const pt = canvasToTable(e.clientX, e.clientY);
      if (!pt) return;
      e.preventDefault();
      if (st.placing) {
        st.placement = clampTable(pt);
      } else if (st.aimingDrag) {
        const cue = st.balls.find((b) => b.id === 0);
        if (!cue) return;
        st.aimAngle = Math.atan2(pt.y - cue.y, pt.x - cue.x);
      }
    };

    const handleUp = () => {
      const st = stateRef.current;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      if (st.placing) {
        st.placing = false;
        const p = st.placement;
        st.placement = null;
        if (p && canPlaceCueBall(st.balls.filter((b) => b.id !== 0), p.x, p.y)) {
          onPlaceCueRef.current(p.x, p.y);
        }
        return;
      }
      st.aimingDrag = false;
    };

    canvas.addEventListener("pointerdown", handleDown);
    return () => {
      canvas.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  const handlePowerChange = (power: number) => {
    stateRef.current.power = power;
  };

  const handlePowerRelease = (power: number) => {
    stateRef.current.power = 0;
    const st = stateRef.current;
    if (!st.interactive || st.playback || st.finished || st.ballInHand) return;
    if (power > 0.05) onShootRef.current(st.aimAngle, power);
  };

  const canShoot = interactive && !playback && !finished && !ballInHand;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: "radial-gradient(90% 80% at 50% 0%, hsl(210 45% 16%) 0%, hsl(220 45% 9%) 45%, hsl(226 45% 5%) 100%)",
      }}
    >
      {/* Full-height play surface — chrome below is overlaid, not laid out in flow,
          so the table gets every pixel of vertical space this landscape screen has. */}
      <div className="flex h-full w-full items-center justify-center gap-1 px-0.5">
        <div ref={wrapRef} className="flex h-full flex-1 items-center justify-center">
          <canvas ref={canvasRef} className="touch-none" style={{ touchAction: "none" }} />
        </div>
        <div className="flex h-[94%] shrink-0 flex-col items-center">
          <PowerSlider disabled={!canShoot} onChange={handlePowerChange} onRelease={handlePowerRelease} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-1.5 px-2 pt-1.5">
        <button type="button" onClick={onBack} aria-label="Back" className="pointer-events-auto rounded-full bg-black/55 p-1 text-white active:scale-95">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span
          className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
          style={{
            background: myTurn ? "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))" : "rgba(0,0,0,0.55)",
            color: myTurn ? "hsl(var(--primary-foreground))" : "rgba(255,255,255,0.85)",
            boxShadow: myTurn ? "0 0 14px hsl(var(--primary) / 0.55)" : undefined,
          }}
        >
          {turnLabel}
        </span>
        {ballInHand && interactive && <span className="truncate text-[9px] font-bold text-primary">Place the cue ball</span>}
        <div className="pointer-events-auto ml-auto flex items-center gap-1">
          <button type="button" onClick={onToggleMute} aria-label={muted ? "Unmute sound" : "Mute sound"} className="rounded-full bg-black/55 p-1 text-white active:scale-95">
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => setHelp((v) => !v)} aria-label="How to play" className="rounded-full bg-black/55 p-1 text-white active:scale-95">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2">
        <PoolPod name={oppName} avatarUrl={oppAvatar} isComputer={isComputer} group={oppGroup} balls={balls} active={!myTurn && !finished} size="sm" />
      </div>

      {help ? (
        <ul className="absolute inset-x-6 top-10 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[10px] text-white/80 animate-fade-in">
          {howToPlay.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-2 pb-1">
        <PoolPod name={myName} avatarUrl={myAvatar} group={myGroup} balls={balls} active={myTurn && !finished} size="sm" />
        <p className="max-w-[40%] text-right text-[9px] font-bold text-white/50">
          {ballInHand && interactive
            ? "Tap the table to place the cue ball"
            : interactive
              ? "Drag the table to aim, hold the slider to shoot"
              : "Waiting…"}
        </p>
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBall(ctx: CanvasRenderingContext2D, cx: number, cy: number, id: number) {
  const r = BALL_R;
  ctx.save();

  if (id === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f2ea";
    ctx.fill();
  } else if (isStripe(id)) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f5f2ea";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = BALL_COLORS[id];
    ctx.fillRect(cx - r, cy - r * 0.42, r * 2, r * 0.84);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = BALL_COLORS[id] ?? "#f5f2ea";
    ctx.fill();
  }

  // Glossy highlight.
  const gloss = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  gloss.addColorStop(0, "rgba(255,255,255,0.75)");
  gloss.addColorStop(0.25, "rgba(255,255,255,0.15)");
  gloss.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (id > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f2ea";
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = `700 ${Math.round(r * 0.5)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(id), cx, cy + 0.5);
  }
}
