import { useEffect, useRef, useState } from "react";
import { HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import {
  ItemKind,
  Lane,
  OVERHEAD_KINDS,
  ObstacleKind,
  RunResult,
  TRACK_LENGTH,
  TrackItem,
  scoreRun,
  spawnCourse,
} from "@/lib/city-run-run";
import { cityRunSfx } from "@/lib/city-run-sfx";

// Same fixed-viewBox trick every physics game this session uses: the world scrolls past a
// runner fixed near the bottom of the screen, so the tick logic only ever deals with logical
// track-units, never real device pixels. Coordinates match the approved concept mockup 1:1.
const VIEW_W = 320;
const VIEW_H = 690;
const ROAD_TOP_Y = 342;
const ROAD_BOTTOM_Y = 690;
const ROAD_TOP_L = 124;
const ROAD_TOP_R = 196;
const ROAD_BOT_L = 24;
const ROAD_BOT_R = 296;
const PLAYER_SCREEN_Y = 600;
const PIXELS_PER_UNIT = 9;
const RUN_SPEED = 10; // track-units/sec
const JUMP_DURATION = 1.0; // seconds airborne — reach (10 units) comfortably exceeds hazard width
const SLIDE_DURATION = 1.0;
const JUMP_HEIGHT_PX = 68;
const ITEM_HALF_WIDTH = 3; // half-width of every obstacle/star's hazard or pickup window
const SWIPE_THRESHOLD = 20;
const TICK_MS = 16;
const ROUND_SECONDS_CAP = 20;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function roadEdgesAtY(y: number) {
  const t = clamp((y - ROAD_TOP_Y) / (ROAD_BOTTOM_Y - ROAD_TOP_Y), 0, 1);
  return { left: ROAD_TOP_L + (ROAD_BOT_L - ROAD_TOP_L) * t, right: ROAD_TOP_R + (ROAD_BOT_R - ROAD_TOP_R) * t };
}

function laneCenterX(lane: number, y: number) {
  const { left, right } = roadEdgesAtY(y);
  const laneW = (right - left) / 3;
  return left + laneW * (lane + 0.5);
}

function worldToScreenY(distance: number, playerDistance: number) {
  return PLAYER_SCREEN_Y - (distance - playerDistance) * PIXELS_PER_UNIT;
}

function depthScale(y: number) {
  return clamp(0.42 + 0.58 * ((y - ROAD_TOP_Y) / (PLAYER_SCREEN_Y - ROAD_TOP_Y)), 0.4, 1.05);
}

function isOverhead(kind: ObstacleKind) {
  return (OVERHEAD_KINDS as readonly string[]).includes(kind);
}

/** The shaded blocky runner, approved after several concept-review rounds — proportions and
 *  shading are locked; do not change without a new round of visual sign-off. */
function RunnerGraphic() {
  return (
    <>
      <g transform="translate(4,4) rotate(38)">
        <rect x="-11" y="0" width="22" height="48" rx="6" fill="url(#pantsGradCR)" />
        <rect x="-11" y="0" width="7" height="48" rx="6" fill="#FFFFFF" opacity="0.1" />
        <rect x="3" y="0" width="8" height="48" fill="#000" opacity="0.18" />
        <rect x="-16" y="36" width="32" height="9" rx="3" fill="#FFF7EA" />
        <rect x="-16" y="26" width="32" height="14" rx="4" fill="url(#shoeGradCR)" />
        <rect x="-16" y="26" width="32" height="4" rx="2" fill="#FFFFFF" opacity="0.25" />
      </g>
      <g transform="translate(20,-44) rotate(-70)">
        <rect x="-8" y="0" width="16" height="24" rx="4" fill="url(#hoodieGradCR)" />
        <rect x="-7" y="22" width="14" height="14" rx="4" fill="url(#skinGradCR)" />
      </g>
      <g transform="rotate(9)">
        <rect x="-33" y="-56" width="66" height="60" rx="8" fill="url(#hoodieGradCR)" />
        <rect x="-33" y="-56" width="66" height="8" rx="8" fill="#FFFFFF" opacity="0.16" />
        <rect x="12" y="-56" width="21" height="60" rx="8" fill="#000" opacity="0.16" />
        <rect x="-14" y="-58" width="28" height="10" rx="3" fill="#136572" />
        <line x1="0" y1="-48" x2="0" y2="-2" stroke="#0F6772" strokeWidth="2" opacity="0.45" />
        <text x="0" y="-22" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="14" fill="#FFF7EA">
          YAJ
        </text>
      </g>
      <g transform="translate(-2,4) rotate(-34)">
        <rect x="-11" y="0" width="22" height="48" rx="6" fill="url(#pantsGradCR)" />
        <rect x="-11" y="0" width="7" height="48" rx="6" fill="#FFFFFF" opacity="0.1" />
        <rect x="3" y="0" width="8" height="48" fill="#000" opacity="0.18" />
        <rect x="-16" y="36" width="32" height="9" rx="3" fill="#FFF7EA" />
        <rect x="-16" y="26" width="32" height="14" rx="4" fill="url(#shoeGradCR)" />
        <rect x="-16" y="26" width="32" height="4" rx="2" fill="#FFFFFF" opacity="0.25" />
      </g>
      <g transform="translate(-24,-42) rotate(95)">
        <rect x="-8" y="0" width="16" height="24" rx="4" fill="url(#hoodieGradCR)" />
        <rect x="-7" y="22" width="14" height="14" rx="4" fill="url(#skinGradCR)" />
      </g>
      <rect x="-8" y="-70" width="16" height="14" rx="3" fill="url(#skinGradCR)" />
      <rect x="-25" y="-116" width="50" height="46" rx="8" fill="url(#headGradCR)" />
      <rect x="-25" y="-116" width="50" height="7" rx="8" fill="#FFFFFF" opacity="0.2" />
      <rect x="8" y="-116" width="17" height="46" rx="8" fill="#000" opacity="0.14" />
      <rect x="-29" y="-100" width="6" height="13" rx="2" fill="url(#headGradCR)" />
      <rect x="23" y="-100" width="6" height="13" rx="2" fill="url(#headGradCR)" />
      <rect x="-28" y="-132" width="56" height="20" rx="8" fill="url(#hairGradCR)" />
      <rect x="-28" y="-132" width="56" height="5" rx="8" fill="#FFFFFF" opacity="0.22" />
      <rect x="-28" y="-118" width="56" height="7" rx="3" fill="url(#hairGradCR)" />
      <rect x="18" y="-130" width="16" height="9" rx="3" fill="url(#hairGradCR)" transform="rotate(-18 26 -125)" />
      <rect x="-15" y="-96" width="8" height="10" rx="2" fill="#241638" />
      <rect x="7" y="-96" width="8" height="10" rx="2" fill="#241638" />
      <rect x="-13" y="-100" width="6" height="2.3" rx="1" fill="#3A2A55" />
      <rect x="7" y="-100" width="6" height="2.3" rx="1" fill="#3A2A55" />
      <ellipse cx="-18" cy="-83" rx="4.6" ry="3" fill="#FF9270" opacity="0.4" />
      <ellipse cx="18" cy="-83" rx="4.6" ry="3" fill="#FF9270" opacity="0.4" />
      <rect x="-8" y="-78" width="16" height="5" rx="2.5" fill="#7A3B2A" />
    </>
  );
}

function ItemGraphic({ kind }: { kind: ItemKind }) {
  if (kind === "cone") {
    return (
      <>
        <ellipse cx="0" cy="27" rx="18" ry="6" fill="url(#shadowGradCR)" />
        <polygon points="0,-22 15,26 -15,26" fill="url(#coneGradCR)" />
        <polygon points="0,-22 -15,26 -6,26" fill="#000000" opacity="0.12" />
        <line x1="-2" y1="-18" x2="-10" y2="20" stroke="#FFF3E8" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
        <rect x="-17" y="23" width="34" height="6" rx="2" fill="url(#coneGradCR)" />
        <polygon points="-6,-2 6,-2 4,8 -4,8" fill="#FFF7EA" />
      </>
    );
  }
  if (kind === "trash") {
    return (
      <>
        <ellipse cx="0" cy="23" rx="16" ry="5.5" fill="url(#shadowGradCR)" />
        <rect x="-13" y="-4" width="26" height="26" rx="4" fill="url(#binGradCR)" />
        <rect x="-13" y="-4" width="9" height="26" rx="4" fill="#FFFFFF" opacity="0.16" />
        <line x1="0" y1="0" x2="0" y2="18" stroke="#2A3440" strokeWidth="1.4" opacity="0.5" />
        <rect x="-13" y="4" width="26" height="4" fill="#000" opacity="0.2" />
        <rect x="-15" y="-9" width="30" height="7" rx="3" fill="#5C6B7A" />
        <rect x="-4" y="-12" width="8" height="4" rx="1.5" fill="#3F4A57" />
      </>
    );
  }
  if (kind === "barrier") {
    return (
      <>
        <ellipse cx="0" cy="21" rx="22" ry="6" fill="url(#shadowGradCR)" />
        <rect x="-20" y="-9" width="7" height="24" fill="#241636" />
        <rect x="13" y="-9" width="7" height="24" fill="#241636" />
        <rect x="-22" y="-17" width="44" height="11" rx="2" fill="#FF7A59" />
        <rect x="-22" y="-17" width="11" height="11" fill="#FFF7EA" />
        <rect x="0" y="-17" width="11" height="11" fill="#FFF7EA" />
        <rect x="-22" y="-17" width="44" height="3" rx="1.5" fill="#FFFFFF" opacity="0.3" />
        <polygon points="0,-30 -4,-19 4,-19" fill="#FFD166" />
        <circle cx="0" cy="-21" r="0.9" fill="#241636" />
      </>
    );
  }
  if (kind === "puddle") {
    return (
      <>
        <ellipse cx="0" cy="0" rx="24" ry="8" fill="#5CC7D6" opacity="0.7" />
        <ellipse cx="0" cy="0" rx="24" ry="8" fill="none" stroke="#FFF7EA" strokeWidth="1.4" opacity="0.4" />
        <ellipse cx="0" cy="0" rx="15" ry="5" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
        <ellipse cx="-6" cy="-3" rx="7" ry="2.6" fill="#FFFFFF" opacity="0.3" />
      </>
    );
  }
  if (kind === "sign") {
    return (
      <>
        <line x1="-16" y1="-62" x2="-11" y2="-30" stroke="#8290A0" strokeWidth="2" />
        <line x1="16" y1="-62" x2="11" y2="-30" stroke="#8290A0" strokeWidth="2" />
        <rect x="-22" y="-38" width="44" height="13" rx="3" fill="#432A72" />
        <rect x="-22" y="-38" width="44" height="4" rx="2" fill="#FFFFFF" opacity="0.2" />
        <text x="0" y="-28" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="9" fill="#FFF7EA">
          YAJ
        </text>
      </>
    );
  }
  // star
  return (
    <>
      <circle cx="0" cy="0" r="21" fill="url(#starGlowCR)" />
      <path d="M0 -10 l3.5 7.9 8.5 1 -6.3 6 1.5 8.5 -7.2-4.2 -7.2 4.2 1.5-8.5 -6.3-6 8.5-1z" fill="#FFD166" />
      <path d="M0 -6 l2-4.5 4.9 0.6 -3.6 3.4 0.9 4.9 -4.2-2.4 -4.2 2.4 0.9-4.9 -3.6-3.4 4.9-0.6z" fill="#FFF3D6" />
      <line x1="-12" y1="-12" x2="-9" y2="-9" stroke="#FFF3D6" strokeWidth="1.5" opacity="0.8" strokeLinecap="round" />
      <line x1="12" y1="10" x2="9" y2="7" stroke="#FFF3D6" strokeWidth="1.5" opacity="0.8" strokeLinecap="round" />
    </>
  );
}

type Popup = { id: number; text: string };
type AutoTarget = { key: number; triggerDistance: number; overhead: boolean; preferLaneChange: boolean };

export default function CityRunBoard({
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
  onComplete: (result: RunResult) => void;
}) {
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);
  const [help, setHelp] = useState(false);
  const [course, setCourse] = useState<TrackItem[] | null>(null);
  const [distance, setDistance] = useState(0);
  const [stars, setStars] = useState(0);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [ended, setEnded] = useState(false);

  const courseRef = useRef<TrackItem[] | null>(null);
  const playerDistanceRef = useRef(0);
  const laneRef = useRef<Lane>(1);
  const lanePosRef = useRef(1);
  const jumpTRef = useRef(0);
  const slideTRef = useRef(0);
  const endedRef = useRef(false);
  const starsRef = useRef(0);
  const collectedRef = useRef<Set<number>>(new Set());
  const popupIdRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoTargetRef = useRef<AutoTarget | null>(null);
  const timeLeftRef = useRef(ROUND_SECONDS_CAP);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS_CAP);
  const jumpHandlerRef = useRef<(() => void) | null>(null);
  const slideHandlerRef = useRef<(() => void) | null>(null);
  const laneHandlerRef = useRef<((dir: -1 | 1) => void) | null>(null);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const skillRef = useRef(skill);
  skillRef.current = skill;

  useEffect(() => {
    if (!active) return;
    const c = spawnCourse();
    courseRef.current = c;
    setCourse(c);
    playerDistanceRef.current = 0;
    laneRef.current = 1;
    lanePosRef.current = 1;
    jumpTRef.current = 0;
    slideTRef.current = 0;
    endedRef.current = false;
    starsRef.current = 0;
    collectedRef.current = new Set();
    autoTargetRef.current = null;
    timeLeftRef.current = ROUND_SECONDS_CAP;
    setDistance(0);
    setStars(0);
    setPopup(null);
    setEnded(false);
    setTimeLeft(ROUND_SECONDS_CAP);

    const spawnPopup = (text: string) => {
      popupIdRef.current += 1;
      const p = { id: popupIdRef.current, text };
      setPopup(p);
      window.setTimeout(() => setPopup((cur) => (cur?.id === p.id ? null : cur)), 850);
    };

    const finish = (finished: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setEnded(true);
      const d = Math.min(playerDistanceRef.current, TRACK_LENGTH);
      const score = scoreRun(d, starsRef.current, finished);
      if (finished) {
        spawnPopup(`FINISH! +${score}`);
        cityRunSfx.finish();
      } else {
        spawnPopup("CAUGHT!");
        cityRunSfx.stumble();
      }
      window.setTimeout(() => {
        onComplete({ distance: d, stars: starsRef.current, finished, score });
      }, 1000);
    };

    const jump = () => {
      if (endedRef.current || jumpTRef.current > 0 || slideTRef.current > 0) return;
      jumpTRef.current = 0.0001;
      cityRunSfx.jump();
    };
    const slide = () => {
      if (endedRef.current || jumpTRef.current > 0 || slideTRef.current > 0) return;
      slideTRef.current = 0.0001;
      cityRunSfx.slide();
    };
    const changeLane = (dir: -1 | 1) => {
      if (endedRef.current) return;
      const next = clamp(laneRef.current + dir, 0, 2) as Lane;
      if (next === laneRef.current) return;
      laneRef.current = next;
      cityRunSfx.laneChange();
    };
    jumpHandlerRef.current = jump;
    slideHandlerRef.current = slide;
    laneHandlerRef.current = changeLane;

    // Safety-net timer — a run always finishes on its own well before this in practice.
    const timerId = window.setInterval(() => {
      if (endedRef.current) return;
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finish(false);
    }, 1000);

    const loop = window.setInterval(() => {
      if (endedRef.current) return;
      const dt = TICK_MS / 1000;
      const track = courseRef.current!;

      playerDistanceRef.current += RUN_SPEED * dt;
      if (jumpTRef.current > 0) {
        jumpTRef.current += dt;
        if (jumpTRef.current >= JUMP_DURATION) jumpTRef.current = 0;
      }
      if (slideTRef.current > 0) {
        slideTRef.current += dt;
        if (slideTRef.current >= SLIDE_DURATION) slideTRef.current = 0;
      }
      lanePosRef.current += (laneRef.current - lanePosRef.current) * Math.min(1, dt * 10);
      const airborne = jumpTRef.current > 0;
      const sliding = slideTRef.current > 0;
      const d = playerDistanceRef.current;

      if (d >= TRACK_LENGTH) {
        finish(true);
        bump();
        return;
      }

      // Computer: closed-form lane/jump/slide decision on the next relevant item — same
      // "aim deterministically, don't rely on emergent physics" approach used everywhere else.
      if (autoRef.current) {
        const next = track.find((it) => it.distance + ITEM_HALF_WIDTH > d);
        if (next && next.kind !== "star" && next.lane === laneRef.current) {
          if (!autoTargetRef.current || autoTargetRef.current.key !== next.distance) {
            const poorReactionChance = (1 - skillRef.current) * 0.35;
            const reactsLate = Math.random() < poorReactionChance;
            const overhead = isOverhead(next.kind);
            // Margin must clear ITEM_HALF_WIDTH with real room to spare: the action needs to
            // have been active for at least a tick *before* the hazard window opens, since the
            // collision check on the very same tick an action fires still reads the airborne/
            // sliding state from before that tick's decision ran.
            const triggerDistance = reactsLate
              ? next.distance + ITEM_HALF_WIDTH + 1
              : next.distance - (ITEM_HALF_WIDTH + 1 + Math.random() * 1.5);
            autoTargetRef.current = { key: next.distance, triggerDistance, overhead, preferLaneChange: Math.random() < 0.5 };
          }
        }
        // Fires purely on distance — must NOT also require `next` to still resolve to the
        // same item, since a closer star between the player and the target obstacle would
        // make `next` point at the star instead, silently blocking the trigger for however
        // long the star stays nearer, well past the time the evasive action was needed.
        const target = autoTargetRef.current;
        if (target && d >= target.triggerDistance) {
          if (target.preferLaneChange) {
            laneHandlerRef.current?.(laneRef.current === 0 ? 1 : -1);
          } else if (target.overhead) {
            slideHandlerRef.current?.();
          } else {
            jumpHandlerRef.current?.();
          }
          autoTargetRef.current = null;
        }
      }

      // Obstacles + stars: only one item ever occupies a given distance, always in one lane.
      for (const item of track) {
        if (d < item.distance - ITEM_HALF_WIDTH || d >= item.distance + ITEM_HALF_WIDTH) continue;
        if (laneRef.current !== item.lane) continue;
        if (item.kind === "star") {
          if (!collectedRef.current.has(item.distance)) {
            collectedRef.current.add(item.distance);
            starsRef.current += 1;
            setStars(starsRef.current);
            cityRunSfx.star();
            spawnPopup("+STAR");
          }
          continue;
        }
        const safe = isOverhead(item.kind) ? sliding : airborne;
        if (!safe) {
          finish(false);
          bump();
          return;
        }
      }

      setDistance(d);
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
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      laneHandlerRef.current?.(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      jumpHandlerRef.current?.();
    } else {
      slideHandlerRef.current?.();
    }
    dragStartRef.current = pt;
  };
  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  if (!active || !course) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(190,55%,8%)] text-white">
        <p className="text-sm font-black uppercase tracking-wide text-white/60">{roundLabel}</p>
        <p className="text-xs text-white/40">Waiting for the other run to finish…</p>
      </div>
    );
  }

  const jumpLift = jumpTRef.current > 0 ? JUMP_HEIGHT_PX * 4 * Math.min(1, jumpTRef.current / JUMP_DURATION) * (1 - Math.min(1, jumpTRef.current / JUMP_DURATION)) : 0;
  const slideSquash = slideTRef.current > 0 ? 0.6 : 1;
  const playerX = laneCenterX(lanePosRef.current, PLAYER_SCREEN_Y);
  const pct = Math.min(100, Math.round((distance / TRACK_LENGTH) * 100));

  return (
    <div
      className="relative h-full w-full overflow-hidden touch-none select-none"
      style={{ background: "linear-gradient(180deg, hsl(190 55% 16%) 0%, hsl(192 55% 9%) 45%, hsl(194 58% 5%) 100%)" }}
    >
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
            <linearGradient id="skyCR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ED0DC" />
              <stop offset="100%" stopColor="#CFF8EF" />
            </linearGradient>
            <radialGradient id="sunGlowCR" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE9B0" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FFE9B0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bldgACR" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#9A6BDD" />
              <stop offset="100%" stopColor="#5A3494" />
            </linearGradient>
            <linearGradient id="bldgBCR" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7A4FC9" />
              <stop offset="100%" stopColor="#432A72" />
            </linearGradient>
            <linearGradient id="roadGradCR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4A3570" />
              <stop offset="100%" stopColor="#1D1230" />
            </linearGradient>
            <radialGradient id="lampGlowCR" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE9B0" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#FFE9B0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="headGradCR" x1="0.2" y1="0.15" x2="0.9" y2="1">
              <stop offset="0%" stopColor="#FCD9B0" />
              <stop offset="100%" stopColor="#D89A6B" />
            </linearGradient>
            <linearGradient id="hairGradCR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9A6BDD" />
              <stop offset="100%" stopColor="#5A3494" />
            </linearGradient>
            <linearGradient id="hoodieGradCR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#52E1E8" />
              <stop offset="100%" stopColor="#1B8B96" />
            </linearGradient>
            <linearGradient id="pantsGradCR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4A3570" />
              <stop offset="100%" stopColor="#1B1230" />
            </linearGradient>
            <linearGradient id="skinGradCR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FCD9B0" />
              <stop offset="100%" stopColor="#E3AA79" />
            </linearGradient>
            <linearGradient id="shoeGradCR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF9C7D" />
              <stop offset="100%" stopColor="#E85A3D" />
            </linearGradient>
            <linearGradient id="coneGradCR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFB89A" />
              <stop offset="100%" stopColor="#E85A3D" />
            </linearGradient>
            <linearGradient id="binGradCR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8290A0" />
              <stop offset="100%" stopColor="#3F4A57" />
            </linearGradient>
            <radialGradient id="shadowGradCR" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="starGlowCR" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFEFB0" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#FFD166" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#FFD166" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="hazeGradCR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DFFAF3" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#DFFAF3" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="vignetteCR" cx="50%" cy="52%" r="72%">
              <stop offset="55%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.26" />
            </radialGradient>
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="url(#skyCR)" />
          <circle cx="266" cy="56" r="34" fill="url(#sunGlowCR)" />
          <circle cx="266" cy="56" r="16" fill="#FFD166" />
          <g fill="#FFFFFF" opacity="0.75">
            <ellipse cx="46" cy="42" rx="22" ry="10" />
            <ellipse cx="64" cy="37" rx="15" ry="8" />
          </g>

          {/* skyline: shaded blocks with lit windows, a rooftop sign, and a couple of accents */}
          <g>
            <rect x="0" y="132" width="56" height="120" fill="url(#bldgACR)" />
            <rect x="0" y="132" width="56" height="6" fill="#FFFFFF" opacity="0.16" />
            <rect x="47" y="132" width="9" height="120" fill="#000" opacity="0.2" />
            <rect x="48" y="98" width="66" height="154" fill="url(#bldgBCR)" />
            <rect x="48" y="98" width="66" height="6" fill="#FFFFFF" opacity="0.18" />
            <rect x="105" y="98" width="9" height="154" fill="#000" opacity="0.22" />
            <rect x="66" y="88" width="16" height="12" fill="#432A72" />
            <line x1="74" y1="88" x2="74" y2="76" stroke="#432A72" strokeWidth="2.4" />
            <circle cx="74" cy="74" r="2.4" fill="#FF7A59" />
            <rect x="110" y="140" width="50" height="112" fill="url(#bldgACR)" />
            <rect x="110" y="140" width="50" height="6" fill="#FFFFFF" opacity="0.16" />
            <rect x="151" y="140" width="9" height="112" fill="#000" opacity="0.2" />
            <rect x="196" y="112" width="60" height="140" fill="url(#bldgBCR)" />
            <rect x="196" y="112" width="60" height="6" fill="#FFFFFF" opacity="0.18" />
            <rect x="247" y="112" width="9" height="140" fill="#000" opacity="0.22" />
            <rect x="211" y="100" width="18" height="14" rx="2" fill="#3A2A55" />
            <polygon points="209,100 231,100 220,88" fill="#3A2A55" />
            <rect x="252" y="150" width="54" height="102" fill="url(#bldgACR)" />
            <rect x="252" y="150" width="54" height="6" fill="#FFFFFF" opacity="0.16" />
            <rect x="297" y="150" width="9" height="102" fill="#000" opacity="0.2" />
            <g fill="#2A1B45" opacity="0.55">
              <rect x="10" y="150" width="8" height="10" /><rect x="26" y="150" width="8" height="10" /><rect x="42" y="150" width="8" height="10" />
              <rect x="10" y="170" width="8" height="10" /><rect x="42" y="170" width="8" height="10" />
              <rect x="10" y="190" width="8" height="10" /><rect x="26" y="190" width="8" height="10" /><rect x="42" y="190" width="8" height="10" />
              <rect x="10" y="210" width="8" height="10" /><rect x="26" y="210" width="8" height="10" /><rect x="42" y="210" width="8" height="10" />
              <rect x="60" y="112" width="8" height="10" /><rect x="78" y="112" width="8" height="10" /><rect x="96" y="112" width="8" height="10" />
              <rect x="60" y="134" width="8" height="10" /><rect x="96" y="134" width="8" height="10" />
              <rect x="60" y="156" width="8" height="10" /><rect x="78" y="156" width="8" height="10" /><rect x="96" y="156" width="8" height="10" />
              <rect x="60" y="178" width="8" height="10" /><rect x="78" y="178" width="8" height="10" /><rect x="96" y="178" width="8" height="10" />
              <rect x="120" y="152" width="8" height="10" /><rect x="136" y="152" width="8" height="10" />
              <rect x="120" y="174" width="8" height="10" /><rect x="136" y="174" width="8" height="10" />
              <rect x="204" y="128" width="8" height="10" /><rect x="222" y="128" width="8" height="10" /><rect x="240" y="128" width="8" height="10" />
              <rect x="204" y="150" width="8" height="10" /><rect x="240" y="150" width="8" height="10" />
              <rect x="204" y="172" width="8" height="10" /><rect x="222" y="172" width="8" height="10" /><rect x="240" y="172" width="8" height="10" />
              <rect x="260" y="164" width="8" height="10" /><rect x="278" y="164" width="8" height="10" />
              <rect x="260" y="186" width="8" height="10" /><rect x="278" y="186" width="8" height="10" />
            </g>
            <g fill="#FFD98A" opacity="0.85">
              <rect x="26" y="170" width="8" height="10" />
              <rect x="78" y="134" width="8" height="10" />
              <rect x="136" y="152" width="8" height="10" />
              <rect x="222" y="150" width="8" height="10" />
              <rect x="260" y="186" width="8" height="10" />
            </g>
            <polygon points="196,128 196,158 244,166 244,136" fill="#136572" />
            <text x="220" y="148" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="12" fill="#FFF7EA">
              RUN THE CITY
            </text>
          </g>

          <rect x="0" y="88" width="320" height="170" fill="url(#hazeGradCR)" />

          <rect x="0" y="252" width="320" height="60" fill="#F4EDE0" />
          <g fill="#2FB6C4">
            <rect x="16" y="292" width="16" height="20" /><rect x="46" y="292" width="16" height="20" />
            <rect x="76" y="292" width="16" height="20" /><rect x="106" y="292" width="16" height="20" />
          </g>
          <g fill="#FF7A59">
            <rect x="16" y="292" width="16" height="7" /><rect x="76" y="292" width="16" height="7" />
          </g>
          <text x="24" y="266" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700" fontSize="8" fill="#6B3FA0">
            CAFÉ
          </text>
          <text x="84" y="266" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700" fontSize="8" fill="#2FB6C4">
            SHOP
          </text>
          <g>
            <rect x="150" y="266" width="46" height="42" rx="3" fill="#CFE7EA" />
            <rect x="150" y="266" width="46" height="42" rx="3" fill="none" stroke="#2A1B45" strokeWidth="2" />
            <polygon points="152,306 172,270 196,270 196,306" fill="#FFFFFF" opacity="0.28" />
            <rect x="206" y="266" width="46" height="42" rx="3" fill="#CFE7EA" />
            <rect x="206" y="266" width="46" height="42" rx="3" fill="none" stroke="#2A1B45" strokeWidth="2" />
            <polygon points="208,306 228,270 252,270 252,306" fill="#FFFFFF" opacity="0.28" />
            <rect x="262" y="266" width="44" height="42" rx="3" fill="#CFE7EA" />
            <rect x="262" y="266" width="44" height="42" rx="3" fill="none" stroke="#2A1B45" strokeWidth="2" />
            <polygon points="264,306 284,270 306,270 306,306" fill="#FFFFFF" opacity="0.28" />
          </g>

          <g transform="translate(38,330) scale(0.62)">
            <ellipse cx="0" cy="22" rx="32" ry="7" fill="url(#shadowGradCR)" />
            <rect x="-24" y="-4" width="48" height="16" rx="5" fill="#F4C542" />
            <rect x="-24" y="-4" width="14" height="16" rx="5" fill="#FFFFFF" opacity="0.22" />
            <rect x="-15" y="-16" width="30" height="14" rx="5" fill="#F4C542" />
            <rect x="-12" y="-14" width="24" height="9" rx="2" fill="#BFEFF5" opacity="0.85" />
            <circle cx="20" cy="2" r="3" fill="#FFF3D6" />
            <circle cx="-14" cy="12" r="6" fill="#1B1230" /><circle cx="14" cy="12" r="6" fill="#1B1230" />
            <circle cx="-14" cy="12" r="2.4" fill="#7A7A85" /><circle cx="14" cy="12" r="2.4" fill="#7A7A85" />
          </g>
          <g transform="translate(284,328) scale(-0.58,0.58)">
            <ellipse cx="0" cy="22" rx="32" ry="7" fill="url(#shadowGradCR)" />
            <rect x="-24" y="-4" width="48" height="16" rx="5" fill="#E85A3D" />
            <rect x="-24" y="-4" width="14" height="16" rx="5" fill="#FFFFFF" opacity="0.22" />
            <rect x="-15" y="-16" width="30" height="14" rx="5" fill="#E85A3D" />
            <rect x="-12" y="-14" width="24" height="9" rx="2" fill="#BFEFF5" opacity="0.85" />
            <circle cx="20" cy="2" r="3" fill="#FFF3D6" />
            <circle cx="-14" cy="12" r="6" fill="#1B1230" /><circle cx="14" cy="12" r="6" fill="#1B1230" />
            <circle cx="-14" cy="12" r="2.4" fill="#7A7A85" /><circle cx="14" cy="12" r="2.4" fill="#7A7A85" />
          </g>

          <ellipse cx="290" cy="311" rx="7" ry="2.5" fill="url(#shadowGradCR)" />
          <circle cx="290" cy="278" r="16" fill="url(#lampGlowCR)" />
          <circle cx="290" cy="278" r="5" fill="#FFE9B0" />
          <rect x="287" y="283" width="5" height="28" fill="#3C2A5C" />
          <rect x="284" y="309" width="12" height="4" rx="1" fill="#241636" />

          <ellipse cx="45" cy="514" rx="12" ry="4" fill="url(#shadowGradCR)" />
          <circle cx="45" cy="460" r="24" fill="url(#lampGlowCR)" />
          <circle cx="45" cy="460" r="7" fill="#FFE9B0" />
          <rect x="41" y="467" width="7" height="46" fill="#3C2A5C" />
          <rect x="35" y="510" width="19" height="6" rx="2" fill="#241636" />
          <polygon points="48,472 66,476 66,492 48,488" fill="#432A72" />
          <text x="57" y="486" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="9" fill="#FFF7EA">
            YAJ
          </text>

          <polygon points="0,312 124,342 24,690 0,690" fill="#E6DCC9" />
          <polygon points="320,312 196,342 296,690 320,690" fill="#E6DCC9" />
          <polygon points="0,312 124,342 118,352 0,322" fill="#FFFFFF" opacity="0.18" />
          <polygon points="320,312 196,342 202,352 320,322" fill="#FFFFFF" opacity="0.18" />
          <g stroke="#C9BCA2" strokeWidth="1" opacity="0.6">
            <line x1="20" y1="420" x2="97" y2="420" /><line x1="12" y1="520" x2="72" y2="520" /><line x1="6" y1="610" x2="46" y2="610" />
            <line x1="300" y1="420" x2="223" y2="420" /><line x1="308" y1="520" x2="248" y2="520" /><line x1="314" y1="610" x2="274" y2="610" />
          </g>
          <ellipse cx="255" cy="400" rx="10" ry="4" fill="#C9BCA2" opacity="0.7" />
          <ellipse cx="255" cy="400" rx="10" ry="4" fill="none" stroke="#8A7E68" strokeWidth="1" opacity="0.6" />

          <ellipse cx="265" cy="352" rx="12" ry="3" fill="url(#shadowGradCR)" />
          <rect x="262" y="322" width="6" height="30" fill="#7A5A3A" />
          <circle cx="265" cy="315" r="15" fill="#1B8B96" />
          <circle cx="257" cy="309" r="10" fill="#2FB6C4" />
          <circle cx="273" cy="309" r="10" fill="#2FB6C4" />

          <polygon points="124,342 196,342 296,690 24,690" fill="url(#roadGradCR)" />
          <g stroke="#FFFFFF" strokeWidth="1" opacity="0.08">
            <line x1="136" y1="342" x2="60" y2="690" />
            <line x1="184" y1="342" x2="260" y2="690" />
          </g>
          <line x1="148" y1="342" x2="115" y2="690" stroke="#FFF7EA" strokeWidth="2.5" strokeDasharray="10 9" opacity="0.55" />
          <line x1="172" y1="342" x2="205" y2="690" stroke="#FFF7EA" strokeWidth="2.5" strokeDasharray="10 9" opacity="0.55" />

          <ellipse cx="283" cy="518" rx="26" ry="7" fill="url(#shadowGradCR)" />
          <rect x="278" y="470" width="10" height="46" fill="#7A5A3A" />
          <rect x="278" y="470" width="4" height="46" fill="#000" opacity="0.15" />
          <circle cx="283" cy="458" r="24" fill="#1B8B96" />
          <circle cx="268" cy="448" r="16" fill="#2FB6C4" />
          <circle cx="298" cy="448" r="16" fill="#2FB6C4" />
          <circle cx="283" cy="434" r="15" fill="#52E1E8" />

          <ellipse cx="34" cy="602" rx="32" ry="6" fill="url(#shadowGradCR)" />
          <g transform="translate(34,600)">
            <rect x="-30" y="-9" width="60" height="8" rx="3" fill="#8A5CC2" />
            <rect x="-30" y="-9" width="60" height="3" rx="3" fill="#FFFFFF" opacity="0.2" />
            <rect x="-30" y="-23" width="60" height="8" rx="3" fill="#8A5CC2" />
            <rect x="-30" y="-23" width="60" height="3" rx="3" fill="#FFFFFF" opacity="0.2" />
            <rect x="-25" y="-2" width="6" height="16" fill="#2A1B45" />
            <rect x="19" y="-2" width="6" height="16" fill="#2A1B45" />
          </g>

          {/* live obstacles + stars, positioned by lane and world distance */}
          {course.map((item, i) => {
            const y = worldToScreenY(item.distance, distance);
            if (y < ROAD_TOP_Y - 80 || y > VIEW_H + 40) return null;
            const x = laneCenterX(item.lane, y);
            const s = depthScale(y);
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
                <ItemGraphic kind={item.kind} />
              </g>
            );
          })}

          {/* runner */}
          <g transform={`translate(${playerX} ${PLAYER_SCREEN_Y - jumpLift})`}>
            <ellipse cx="0" cy="72" rx="42" ry="11" fill="url(#shadowGradCR)" />
            <g transform={`scale(1, ${slideSquash}) translate(0, ${slideSquash < 1 ? 78 - 78 * (1 / slideSquash) : 0})`}>
              <RunnerGraphic />
            </g>
          </g>

          <rect width={VIEW_W} height={VIEW_H} fill="url(#vignetteCR)" />
        </svg>

        {popup && (
          <span
            key={popup.id}
            className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 rounded-full bg-[#FFD166] px-3 py-1 text-sm font-black text-black"
            style={{ animation: "cr-pop 900ms ease-out forwards" }}
          >
            {popup.text}
          </span>
        )}
        <style>{`@keyframes cr-pop { 0% { transform: translate(-50%,0) scale(0.6); opacity: 0; } 25% { transform: translate(-50%,-6px) scale(1.15); opacity: 1; } 100% { transform: translate(-50%,-46px) scale(1); opacity: 0; } }`}</style>

        {auto && !ended && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/45">Watching their run</p>
        )}
        {canSteer && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-[11px] font-bold text-white/45">
            Swipe left/right to change lanes · up to jump · down to slide
          </p>
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
          style={{ borderColor: "rgba(240,216,76,0.35)", background: "rgba(6,10,10,0.88)", boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }}
        >
          <div className="flex flex-col items-center px-2.5">
            <span className="text-[8px] font-black uppercase tracking-wide text-blue-300">You</span>
            <span className="text-xl font-black leading-none text-blue-300" style={{ textShadow: "0 0 8px rgba(96,165,250,0.85)" }}>
              {myScore}
            </span>
          </div>
          <div className="flex flex-col items-center border-x border-white/15 px-3">
            <span className={`font-mono text-[22px] font-black leading-none tabular-nums text-[#FFD166] ${timeLeft <= 5 ? "animate-pulse" : ""}`} style={{ textShadow: "0 0 10px rgba(255,209,102,0.85)" }}>
              {pct}%
            </span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">Stars {stars}</span>
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
