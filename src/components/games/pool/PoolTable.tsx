import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, HelpCircle, Volume2, VolumeX } from "lucide-react";
import {
  BALL_COLORS,
  BALL_R,
  Ball,
  Group,
  POCKETS,
  TABLE_H,
  TABLE_W,
  canPlaceCueBall,
  isStripe,
} from "@/lib/pool";

const RAIL = 46;
const WORLD_W = TABLE_W + RAIL * 2;
const WORLD_H = TABLE_H + RAIL * 2;
const MAX_DRAG = 210;
const PLAYBACK_STEPS_PER_TICK = 5;

type Vec = { x: number; y: number };

type Props = {
  balls: Ball[];
  playback: Ball[][] | null;
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
  myBallsLeft: number;
  oppName: string;
  oppAvatar: string | null;
  oppGroup: Group | null;
  oppBallsLeft: number;
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

function GroupChip({ group }: { group: Group | null }) {
  if (!group) return <span className="text-[9px] font-bold uppercase tracking-wide text-white/45">Open table</span>;
  return (
    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-white/65">
      <span
        className="h-2.5 w-2.5 rounded-full border border-white/40"
        style={{
          background: group === "solids" ? BALL_COLORS[3] : `linear-gradient(90deg, ${BALL_COLORS[2]} 35%, #f5f2ea 35% 65%, ${BALL_COLORS[2]} 65%)`,
        }}
      />
      {group === "solids" ? "Solids" : "Stripes"}
    </span>
  );
}

function PoolPod({
  name,
  avatarUrl,
  isComputer,
  group,
  ballsLeft,
  active,
  align = "left",
}: {
  name: string;
  avatarUrl?: string | null;
  isComputer?: boolean;
  group: Group | null;
  ballsLeft: number;
  active: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <div className="relative shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full p-[2px]"
          style={{
            background: active ? "hsl(var(--primary))" : "rgba(255,255,255,0.14)",
            boxShadow: active ? "0 0 14px hsl(var(--primary) / 0.6)" : undefined,
          }}
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#0c1a12]">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : isComputer ? (
              <Bot className="h-4 w-4 text-primary" />
            ) : (
              <span className="text-xs font-black text-primary">{name.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>
        {active && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0c1a12] bg-primary" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-black leading-tight text-white">{name}</p>
        <div className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
          <GroupChip group={group} />
          <span className="text-[9px] font-bold text-white/45">· {ballsLeft} left</span>
        </div>
      </div>
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
  myBallsLeft,
  oppName,
  oppAvatar,
  oppGroup,
  oppBallsLeft,
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
    playback: null as Ball[][] | null,
    frameIdx: 0,
    aiming: false,
    aim: null as { angle: number; power: number } | null,
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
    if (playback) {
      stateRef.current.aiming = false;
      stateRef.current.aim = null;
      stateRef.current.placing = false;
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
        st.frameIdx = Math.min(st.frameIdx + PLAYBACK_STEPS_PER_TICK, st.playback.length - 1);
        displayBalls = st.playback[st.frameIdx];
        if (st.frameIdx >= st.playback.length - 1) {
          st.playback = null;
          onPlaybackDoneRef.current();
        }
      } else if (st.placing && st.placement) {
        displayBalls = st.balls.map((b) => (b.id === 0 ? { ...b, x: st.placement!.x, y: st.placement!.y, potted: false } : b));
      }

      const px = scale * dpr;
      ctx.setTransform(px, 0, 0, px, 0, 0);
      ctx.clearRect(0, 0, WORLD_W, WORLD_H);

      // Wood rail.
      const railGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      railGrad.addColorStop(0, "#3a2416");
      railGrad.addColorStop(0.5, "#20130b");
      railGrad.addColorStop(1, "#150c07");
      ctx.fillStyle = railGrad;
      roundRect(ctx, 0, 0, WORLD_W, WORLD_H, 22);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 2;
      roundRect(ctx, 2, 2, WORLD_W - 4, WORLD_H - 4, 20);
      ctx.stroke();

      // Felt.
      ctx.save();
      roundRect(ctx, RAIL, RAIL, TABLE_W, TABLE_H, 8);
      ctx.clip();
      const feltGrad = ctx.createRadialGradient(
        RAIL + TABLE_W / 2,
        RAIL + TABLE_H * 0.35,
        40,
        RAIL + TABLE_W / 2,
        RAIL + TABLE_H / 2,
        TABLE_W * 0.75,
      );
      feltGrad.addColorStop(0, "#0f5a7a");
      feltGrad.addColorStop(0.55, "#0b4a68");
      feltGrad.addColorStop(1, "#062f45");
      ctx.fillStyle = feltGrad;
      ctx.fillRect(RAIL, RAIL, TABLE_W, TABLE_H);

      // Subtle felt texture.
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (const d of st.dots!) {
        ctx.beginPath();
        ctx.arc(RAIL + d.x, RAIL + d.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(RAIL + 3, RAIL + 3, TABLE_W - 6, TABLE_H - 6);

      // Rail diamonds.
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 1; i < 8; i++) {
        const x = RAIL + (TABLE_W / 8) * i;
        if (Math.abs(x - (RAIL + TABLE_W / 2)) < 2) continue;
        ctx.beginPath();
        ctx.arc(x, RAIL - RAIL / 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, RAIL + TABLE_H + RAIL / 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 1; i < 4; i++) {
        const y = RAIL + (TABLE_H / 4) * i;
        ctx.beginPath();
        ctx.arc(RAIL / 2, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(RAIL + TABLE_W + RAIL / 2, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pockets.
      for (const p of POCKETS) {
        const cx = RAIL + p.x;
        const cy = RAIL + p.y;
        const g = ctx.createRadialGradient(cx, cy, p.r * 0.2, cx, cy, p.r);
        g.addColorStop(0, "#000000");
        g.addColorStop(0.7, "#0a0a0a");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#050505";
        ctx.beginPath();
        ctx.arc(cx, cy, p.r * 0.62, 0, Math.PI * 2);
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

      // Aim guide + cue stick.
      if (st.interactive && !st.playback && st.aiming && st.aim && cue && !cue.potted) {
        const cuePos = { x: RAIL + cue.x, y: RAIL + cue.y };
        const ray = castAimRay(cue, st.aim.angle, displayBalls);
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

        // Cue stick pulled back opposite the shot direction.
        const pull = 18 + st.aim.power * 150;
        const tipGap = 10;
        const dx = Math.cos(st.aim.angle);
        const dy = Math.sin(st.aim.angle);
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

        // Power meter.
        const meterX = RAIL + TABLE_W - 18;
        const meterTop = RAIL + 14;
        const meterH = TABLE_H - 28;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        roundRect(ctx, meterX - 6, meterTop, 12, meterH, 6);
        ctx.fill();
        const fillH = meterH * st.aim.power;
        const meterGrad = ctx.createLinearGradient(0, meterTop + meterH - fillH, 0, meterTop + meterH);
        meterGrad.addColorStop(0, "#ff5050");
        meterGrad.addColorStop(1, "hsl(204 100% 55%)");
        ctx.fillStyle = meterGrad;
        roundRect(ctx, meterX - 6, meterTop + meterH - fillH, 12, fillH, 6);
        ctx.fill();
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
        st.aiming = true;
        st.aim = { angle: Math.atan2(cue.y - pt.y, cue.x - pt.x), power: 0 };
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
      } else if (st.aiming) {
        const cue = st.balls.find((b) => b.id === 0);
        if (!cue) return;
        const dist = Math.hypot(pt.x - cue.x, pt.y - cue.y);
        st.aim = { angle: Math.atan2(cue.y - pt.y, cue.x - pt.x), power: Math.min(1, dist / MAX_DRAG) };
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
      if (st.aiming && st.aim) {
        const aim = st.aim;
        st.aiming = false;
        st.aim = null;
        if (aim.power > 0.045) onShootRef.current(aim.angle, aim.power);
      }
    };

    canvas.addEventListener("pointerdown", handleDown);
    return () => {
      canvas.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: "radial-gradient(90% 80% at 50% 0%, hsl(210 45% 16%) 0%, hsl(220 45% 9%) 45%, hsl(226 45% 5%) 100%)",
      }}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full bg-white/10 p-1.5 text-white active:scale-95">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{
            background: myTurn ? "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))" : "rgba(255,255,255,0.08)",
            color: myTurn ? "hsl(var(--primary-foreground))" : "rgba(255,255,255,0.75)",
            boxShadow: myTurn ? "0 0 14px hsl(var(--primary) / 0.55)" : undefined,
          }}
        >
          {turnLabel}
        </span>
        {ballInHand && interactive && <span className="truncate text-[10px] font-bold text-primary">Place the cue ball</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onToggleMute} aria-label={muted ? "Unmute music" : "Mute music"} className="rounded-full bg-white/10 p-1.5 text-white active:scale-95">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setHelp((v) => !v)} aria-label="How to play" className="rounded-full bg-white/10 p-1.5 text-white active:scale-95">
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 px-2 pb-1">
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <PoolPod name={oppName} avatarUrl={oppAvatar} isComputer={isComputer} group={oppGroup} ballsLeft={oppBallsLeft} active={!myTurn && !finished} />
        </div>
        <div ref={wrapRef} className="flex h-full w-full items-center justify-center pt-8">
          <canvas ref={canvasRef} className="touch-none" style={{ touchAction: "none" }} />
        </div>
      </div>

      {help ? (
        <ul className="absolute inset-x-6 top-10 z-30 space-y-1 rounded-xl bg-black/85 p-3 text-[10px] text-white/80 animate-fade-in">
          {howToPlay.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
        <PoolPod name={myName} avatarUrl={myAvatar} group={myGroup} ballsLeft={myBallsLeft} active={myTurn && !finished} />
        <p className="max-w-[45%] text-right text-[10px] font-bold text-white/50">
          {ballInHand && interactive
            ? "Tap the table to place the cue ball"
            : interactive
              ? "Drag from the cue ball to aim, release to shoot"
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
