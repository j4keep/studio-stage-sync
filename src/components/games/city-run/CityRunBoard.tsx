import { useEffect, useRef, useState } from "react";
import { HelpCircle, Volume2, VolumeX, X } from "lucide-react";
import {
  Background,
  Branch,
  CHECKPOINTS,
  CourseItem,
  FINISH_DISTANCE,
  ITEM_HALF_WIDTH,
  ItemKind,
  JUNCTION_END,
  JUNCTION_START,
  Lane,
  ObstacleKind,
  RunResult,
  STUMBLE_LIVES,
  generateCourse,
  isPowerUpKind,
  scoreRun,
  sectionAt,
} from "@/lib/city-run-run";
import {
  BOOST_SPEED,
  MAGNET_LANE_REACH,
  MAGNET_RANGE,
  POWER_UP_LABEL,
  POWER_UP_POINTS,
  PowerUpKind,
  PowerUpState,
  activatePowerUp,
  activeList,
  boostBonus,
  consumeShield,
  initialPowerUps,
  isActive,
  tickPowerUps,
} from "@/lib/city-run-powerups";
import { cityRunSfx } from "@/lib/city-run-sfx";


// Same fixed-viewBox trick every physics game this session uses: the camera follows a runner
// whose *world* distance always advances, projected onto a fixed screen row — this is a
// world-position/camera model already (every item has a fixed world distance; only the camera
// reference moves), not "objects sliding toward a fixed character." What was actually missing
// was an animated stride and a course that visibly changes as you travel through it — both
// fixed below.
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
const RUN_SPEED = 10; // track-units/sec at full speed
const JUMP_DURATION = 1.0;
const SLIDE_DURATION = 1.0;
const STUMBLE_DURATION = 0.8;
const INVULN_DURATION = STUMBLE_DURATION + 0.35;
const SWIPE_THRESHOLD = 20;
const TICK_MS = 16;
const ROUND_SECONDS_CAP = 100;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t, 0, 1);
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

const OVERHEAD: readonly string[] = ["sign"];
function isOverhead(kind: ObstacleKind) {
  return OVERHEAD.includes(kind);
}

type AnimState = "run" | "jump" | "slide" | "stumble";
type Pose = { legA: number; legB: number; armA: number; armB: number; bob: number; tilt: number; squashY: number };

/** Legs/arms swing continuously around the original silhouette's base angles instead of sitting
 *  frozen at them — that's the whole fix for "the character never looks like it's running." */
function computePose(state: AnimState, phase: number, jumpProgress: number, stumbleProgress: number): Pose {
  if (state === "jump") {
    return {
      legA: lerp(-55, 25, jumpProgress),
      legB: lerp(55, -25, jumpProgress),
      armA: lerp(-110, -60, jumpProgress),
      armB: lerp(130, 90, jumpProgress),
      bob: 0,
      tilt: 0,
      squashY: 1,
    };
  }
  if (state === "slide") {
    return { legA: 8, legB: -8, armA: -25, armB: 150, bob: 0, tilt: 0, squashY: 0.6 };
  }
  if (state === "stumble") {
    return {
      legA: 55,
      legB: -65,
      armA: 15,
      armB: -35,
      bob: 0,
      tilt: -10 + 20 * Math.sin(stumbleProgress * Math.PI * 3),
      squashY: 1,
    };
  }
  const swing = Math.sin(phase * Math.PI * 2);
  return {
    legA: 38 + 24 * swing,
    legB: -34 - 24 * swing,
    armA: -70 - 22 * swing,
    armB: 95 + 22 * swing,
    bob: Math.abs(swing) * 4,
    tilt: 0,
    squashY: 1,
  };
}

function RunnerGraphic({ pose }: { pose: Pose }) {
  return (
    <>
      <g transform={`translate(4,4) rotate(${pose.legA})`}>
        <rect x="-11" y="0" width="22" height="48" rx="6" fill="url(#pantsGradCR)" />
        <rect x="-11" y="0" width="7" height="48" rx="6" fill="#FFFFFF" opacity="0.1" />
        <rect x="3" y="0" width="8" height="48" fill="#000" opacity="0.18" />
        <rect x="-16" y="36" width="32" height="9" rx="3" fill="#FFF7EA" />
        <rect x="-16" y="26" width="32" height="14" rx="4" fill="url(#shoeGradCR)" />
        <rect x="-16" y="26" width="32" height="4" rx="2" fill="#FFFFFF" opacity="0.25" />
      </g>
      <g transform={`translate(20,-44) rotate(${pose.armA})`}>
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
      <g transform={`translate(-2,4) rotate(${pose.legB})`}>
        <rect x="-11" y="0" width="22" height="48" rx="6" fill="url(#pantsGradCR)" />
        <rect x="-11" y="0" width="7" height="48" rx="6" fill="#FFFFFF" opacity="0.1" />
        <rect x="3" y="0" width="8" height="48" fill="#000" opacity="0.18" />
        <rect x="-16" y="36" width="32" height="9" rx="3" fill="#FFF7EA" />
        <rect x="-16" y="26" width="32" height="14" rx="4" fill="url(#shoeGradCR)" />
        <rect x="-16" y="26" width="32" height="4" rx="2" fill="#FFFFFF" opacity="0.25" />
      </g>
      <g transform={`translate(-24,-42) rotate(${pose.armB})`}>
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
  if (kind === "box") {
    return (
      <>
        <ellipse cx="0" cy="20" rx="16" ry="5" fill="url(#shadowGradCR)" />
        <rect x="-15" y="-8" width="30" height="28" rx="2" fill="#C08A4E" />
        <rect x="-15" y="-8" width="30" height="8" fill="#A8703A" />
        <line x1="-15" y1="-8" x2="15" y2="20" stroke="#8A5A2E" strokeWidth="2" opacity="0.5" />
        <line x1="15" y1="-8" x2="-15" y2="20" stroke="#8A5A2E" strokeWidth="2" opacity="0.5" />
      </>
    );
  }
  if (kind === "bike") {
    return (
      <>
        <ellipse cx="0" cy="24" rx="20" ry="5" fill="url(#shadowGradCR)" />
        <circle cx="-12" cy="18" r="10" fill="none" stroke="#241636" strokeWidth="3" />
        <circle cx="12" cy="18" r="10" fill="none" stroke="#241636" strokeWidth="3" />
        <line x1="-12" y1="18" x2="0" y2="-4" stroke="#2FB6C4" strokeWidth="3" />
        <line x1="0" y1="-4" x2="12" y2="18" stroke="#2FB6C4" strokeWidth="3" />
        <line x1="-6" y1="6" x2="6" y2="6" stroke="#2FB6C4" strokeWidth="3" />
        <line x1="0" y1="-4" x2="-4" y2="-14" stroke="#241636" strokeWidth="2.5" />
      </>
    );
  }
  if (kind === "roadwork") {
    return (
      <>
        <ellipse cx="0" cy="20" rx="20" ry="5" fill="url(#shadowGradCR)" />
        <rect x="-20" y="-4" width="40" height="12" rx="2" fill="#FFD166" />
        <rect x="-20" y="-4" width="10" height="12" fill="#241636" />
        <rect x="10" y="-4" width="10" height="12" fill="#241636" />
        <rect x="-3" y="8" width="6" height="14" fill="#8290A0" />
      </>
    );
  }
  if (kind === "car") {
    return (
      <>
        <ellipse cx="0" cy="24" rx="22" ry="6" fill="url(#shadowGradCR)" />
        <rect x="-18" y="0" width="36" height="14" rx="4" fill="#E85A3D" />
        <rect x="-11" y="-10" width="22" height="12" rx="4" fill="#E85A3D" />
        <rect x="-9" y="-8" width="18" height="7" rx="2" fill="#BFEFF5" opacity="0.85" />
        <circle cx="-11" cy="16" r="5" fill="#1B1230" />
        <circle cx="11" cy="16" r="5" fill="#1B1230" />
      </>
    );
  }
  if (kind === "magnet") {
    return (
      <>
        <circle cx="0" cy="-4" r="24" fill="url(#magnetGlowCR)" />
        <path d="M-13 -18 a13 13 0 0 1 26 0 v10 h-9 v-10 a4 4 0 0 0 -8 0 v10 h-9 z" fill="#7A4FC9" />
        <rect x="-13" y="-8" width="9" height="12" rx="2" fill="#FF7A59" />
        <rect x="4" y="-8" width="9" height="12" rx="2" fill="#FF7A59" />
        <rect x="-13" y="-20" width="26" height="4" rx="2" fill="#FFFFFF" opacity="0.3" />
      </>
    );
  }
  if (kind === "shield") {
    return (
      <>
        <circle cx="0" cy="-6" r="24" fill="url(#shieldGlowCR)" />
        <path d="M0 -26 l16 6 v10 c0 9 -7 16 -16 20 c-9 -4 -16 -11 -16 -20 v-10 z" fill="#2FB6C4" />
        <path d="M0 -26 l16 6 v10 c0 9 -7 16 -16 20 z" fill="#000000" opacity="0.14" />
        <path d="M-6 -8 l4 5 8 -10" fill="none" stroke="#FFF7EA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  if (kind === "boost") {
    return (
      <>
        <circle cx="0" cy="-4" r="24" fill="url(#boostGlowCR)" />
        <path d="M2 -26 l-14 18 h9 l-5 16 15 -20 h-9 z" fill="#FFD166" />
        <path d="M2 -26 l-14 18 h5 z" fill="#FFFFFF" opacity="0.35" />
        <line x1="-18" y1="6" x2="-9" y2="6" stroke="#FFD166" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        <line x1="10" y1="6" x2="19" y2="6" stroke="#FFD166" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
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

const SECTION_THEME: Record<Background, { road: string; sidewalk: string; label: string }> = {
  street: { road: "#4A3570", sidewalk: "#E6DCC9", label: "DOWNTOWN STREET" },
  construction: { road: "#5A4A3A", sidewalk: "#D9C9A8", label: "CONSTRUCTION ZONE" },
  alley: { road: "#332A4A", sidewalk: "#4A3F5C", label: "SIDE ALLEY" },
  park: { road: "#3D5A3E", sidewalk: "#8FC77A", label: "CITY PARK" },
  rooftop: { road: "#5C6B7A", sidewalk: "#8290A0", label: "ROOFTOP RUN" },
  bridge: { road: "#3A4A5C", sidewalk: "#6B7A8A", label: "CITY BRIDGE" },
  finalBlock: { road: "#4A3570", sidewalk: "#E6DCC9", label: "FINAL BLOCK" },
};

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
  const [course, setCourse] = useState<CourseItem[] | null>(null);
  const [distance, setDistance] = useState(0);
  const [stars, setStars] = useState(0);
  const [stumblesLeft, setStumblesLeft] = useState(STUMBLE_LIVES);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [ended, setEnded] = useState(false);
  const [showJunction, setShowJunction] = useState(false);

  const courseRef = useRef<CourseItem[] | null>(null);
  const playerDistanceRef = useRef(0);
  const laneRef = useRef<Lane>(1);
  const lanePosRef = useRef(1);
  const jumpTRef = useRef(0);
  const slideTRef = useRef(0);
  const stumbleTRef = useRef(0);
  const invulnRef = useRef(0);
  const runPhaseRef = useRef(0);
  const branchRef = useRef<Branch | null>(null);
  const junctionResolvedRef = useRef(false);
  const endedRef = useRef(false);
  const starsRef = useRef(0);
  const stumblesLeftRef = useRef(STUMBLE_LIVES);
  const checkpointsRef = useRef(0);
  const collectedRef = useRef<Set<number>>(new Set());
  const resolvedHazardsRef = useRef<Set<number>>(new Set());
  const checkpointsHitRef = useRef<Set<number>>(new Set());
  const lastSectionRef = useRef<string | null>(null);
  const popupIdRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoTargetRef = useRef<AutoTarget | null>(null);
  const timeLeftRef = useRef(ROUND_SECONDS_CAP);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS_CAP);
  const jumpHandlerRef = useRef<(() => void) | null>(null);
  const slideHandlerRef = useRef<(() => void) | null>(null);
  const laneHandlerRef = useRef<((dir: -1 | 1) => void) | null>(null);
  const branchHandlerRef = useRef<((b: Branch) => void) | null>(null);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const skillRef = useRef(skill);
  skillRef.current = skill;

  const activeItems = () => {
    const c = courseRef.current;
    if (!c) return [];
    const b = branchRef.current;
    return c.filter((it) => (it.sectionId !== "alley" && it.sectionId !== "main_street") || it.sectionId === b);
  };

  useEffect(() => {
    if (!active) return;
    const c = generateCourse();
    courseRef.current = c;
    setCourse(c);
    playerDistanceRef.current = 0;
    laneRef.current = 1;
    lanePosRef.current = 1;
    jumpTRef.current = 0;
    slideTRef.current = 0;
    stumbleTRef.current = 0;
    invulnRef.current = 0;
    runPhaseRef.current = 0;
    branchRef.current = null;
    junctionResolvedRef.current = false;
    endedRef.current = false;
    starsRef.current = 0;
    stumblesLeftRef.current = STUMBLE_LIVES;
    checkpointsRef.current = 0;
    collectedRef.current = new Set();
    resolvedHazardsRef.current = new Set();
    checkpointsHitRef.current = new Set();
    lastSectionRef.current = null;
    autoTargetRef.current = null;
    timeLeftRef.current = ROUND_SECONDS_CAP;
    setDistance(0);
    setStars(0);
    setStumblesLeft(STUMBLE_LIVES);
    setPopup(null);
    setEnded(false);
    setShowJunction(false);
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
      const d = Math.min(playerDistanceRef.current, FINISH_DISTANCE);
      const score = scoreRun(d, starsRef.current, checkpointsRef.current, finished);
      if (finished) {
        spawnPopup(`FINISH! +${score}`);
        cityRunSfx.finish();
      } else {
        spawnPopup("OUT OF STUMBLES");
        cityRunSfx.stumble();
      }
      window.setTimeout(() => {
        onComplete({ distance: d, stars: starsRef.current, checkpoints: checkpointsRef.current, stumbles: STUMBLE_LIVES - stumblesLeftRef.current, finished, score });
      }, 1000);
    };

    const jump = () => {
      if (endedRef.current || jumpTRef.current > 0 || slideTRef.current > 0 || stumbleTRef.current > 0) return;
      jumpTRef.current = 0.0001;
      cityRunSfx.jump();
    };
    const slide = () => {
      if (endedRef.current || jumpTRef.current > 0 || slideTRef.current > 0 || stumbleTRef.current > 0) return;
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
    const chooseBranch = (b: Branch) => {
      if (junctionResolvedRef.current) return;
      junctionResolvedRef.current = true;
      branchRef.current = b;
      setShowJunction(false);
      cityRunSfx.branchSelect();
      spawnPopup(b === "alley" ? "TAKING THE ALLEY" : "TAKING MAIN STREET");
    };
    jumpHandlerRef.current = jump;
    slideHandlerRef.current = slide;
    laneHandlerRef.current = changeLane;
    branchHandlerRef.current = chooseBranch;

    const timerId = window.setInterval(() => {
      if (endedRef.current) return;
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) finish(false);
    }, 1000);

    const loop = window.setInterval(() => {
      if (endedRef.current) return;
      const dt = TICK_MS / 1000;

      const stumbling = stumbleTRef.current > 0;
      const speedMult = stumbling ? 0.5 : 1;
      playerDistanceRef.current += RUN_SPEED * speedMult * dt;

      if (jumpTRef.current > 0) {
        jumpTRef.current += dt;
        if (jumpTRef.current >= JUMP_DURATION) jumpTRef.current = 0;
      }
      if (slideTRef.current > 0) {
        slideTRef.current += dt;
        if (slideTRef.current >= SLIDE_DURATION) slideTRef.current = 0;
      }
      if (stumbleTRef.current > 0) {
        stumbleTRef.current += dt;
        if (stumbleTRef.current >= STUMBLE_DURATION) stumbleTRef.current = 0;
      }
      if (invulnRef.current > 0) invulnRef.current = Math.max(0, invulnRef.current - dt);

      const airborne = jumpTRef.current > 0;
      const sliding = slideTRef.current > 0;
      if (!stumbling && !airborne) runPhaseRef.current = (runPhaseRef.current + dt * (sliding ? 0 : 2.1 * speedMult)) % 1;

      const d = playerDistanceRef.current;

      if (d >= FINISH_DISTANCE) {
        finish(true);
        bump();
        return;
      }

      // Junction: show the fork UI on entry, resolve it (default to main street) by the exit.
      if (d >= JUNCTION_START && d < JUNCTION_END && !junctionResolvedRef.current) {
        if (!showJunction) setShowJunction(true);
      } else if (d >= JUNCTION_END && !junctionResolvedRef.current) {
        chooseBranch("main_street");
      }

      // Section-change callout.
      const sec = sectionAt(d, branchRef.current ?? "main_street");
      if (sec && sec.id !== lastSectionRef.current) {
        lastSectionRef.current = sec.id;
        spawnPopup(SECTION_THEME[sec.background].label);
      }

      // Checkpoints.
      for (const cp of CHECKPOINTS) {
        if (d >= cp && !checkpointsHitRef.current.has(cp)) {
          checkpointsHitRef.current.add(cp);
          checkpointsRef.current += 1;
          cityRunSfx.checkpoint();
          spawnPopup("CHECKPOINT!");
        }
      }

      const items = activeItems();

      // Computer: closed-form decisions — branch choice at the junction, then lane/jump/slide
      // reaction to the next in-lane hazard, same approach used everywhere else.
      if (autoRef.current) {
        if (d >= JUNCTION_START && d < JUNCTION_END && !junctionResolvedRef.current) {
          chooseBranch(Math.random() < 0.35 + skillRef.current * 0.3 ? "alley" : "main_street");
        }
        const next = items.find((it) => it.distance + ITEM_HALF_WIDTH > d);
        if (next && next.kind !== "star" && next.lane === laneRef.current) {
          if (!autoTargetRef.current || autoTargetRef.current.key !== next.distance) {
            const poorReactionChance = (1 - skillRef.current) * 0.3;
            const reactsLate = Math.random() < poorReactionChance;
            const overhead = isOverhead(next.kind as ObstacleKind);
            const triggerDistance = reactsLate
              ? next.distance + ITEM_HALF_WIDTH + 1
              : next.distance - (ITEM_HALF_WIDTH + 1 + Math.random() * 1.5);
            autoTargetRef.current = { key: next.distance, triggerDistance, overhead, preferLaneChange: Math.random() < 0.5 };
          }
        }
        const target = autoTargetRef.current;
        if (target && d >= target.triggerDistance) {
          if (target.preferLaneChange) laneHandlerRef.current?.(laneRef.current === 0 ? 1 : -1);
          else if (target.overhead) slideHandlerRef.current?.();
          else jumpHandlerRef.current?.();
          autoTargetRef.current = null;
        }
      }

      lanePosRef.current += (laneRef.current - lanePosRef.current) * Math.min(1, dt * 10);

      // Obstacles + stars, skipped entirely while briefly invulnerable after a stumble.
      if (invulnRef.current <= 0) {
        for (const item of items) {
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
          if (resolvedHazardsRef.current.has(item.distance)) continue;
          const safe = isOverhead(item.kind) ? sliding : airborne;
          if (!safe) {
            resolvedHazardsRef.current.add(item.distance);
            stumbleTRef.current = 0.0001;
            invulnRef.current = INVULN_DURATION;
            stumblesLeftRef.current = Math.max(0, stumblesLeftRef.current - 1);
            setStumblesLeft(stumblesLeftRef.current);
            cityRunSfx.stumble();
            spawnPopup(stumblesLeftRef.current > 0 ? "OUCH!" : "LAST STUMBLE!");
            if (stumblesLeftRef.current <= 0) {
              finish(false);
              bump();
              return;
            }
          }
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

  const canSteer = active && !auto && !ended;
  const canSteerRef = useRef(canSteer);
  canSteerRef.current = canSteer;

  // Desktop keyboard support (arrows or WASD) for testing, mirroring the swipe handlers.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (showJunction) {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") branchHandlerRef.current?.("alley");
        if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") branchHandlerRef.current?.("main_street");
        return;
      }
      if (!canSteerRef.current) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") laneHandlerRef.current?.(-1);
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") laneHandlerRef.current?.(1);
      else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") jumpHandlerRef.current?.();
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") slideHandlerRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, showJunction]);

  const canvasToView = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * VIEW_W, y: ((clientY - rect.top) / rect.height) * VIEW_H };
  };

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
    if (showJunction) {
      if (Math.abs(dx) > Math.abs(dy)) branchHandlerRef.current?.(dx > 0 ? "main_street" : "alley");
    } else if (Math.abs(dx) > Math.abs(dy)) {
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

  const animState: AnimState =
    stumbleTRef.current > 0 ? "stumble" : jumpTRef.current > 0 ? "jump" : slideTRef.current > 0 ? "slide" : "run";
  const jumpProgress = jumpTRef.current > 0 ? Math.min(1, jumpTRef.current / JUMP_DURATION) : 0;
  const stumbleProgress = stumbleTRef.current > 0 ? Math.min(1, stumbleTRef.current / STUMBLE_DURATION) : 0;
  const pose = computePose(animState, runPhaseRef.current, jumpProgress, stumbleProgress);
  const jumpLift = jumpTRef.current > 0 ? 68 * 4 * jumpProgress * (1 - jumpProgress) : 0;
  const playerX = laneCenterX(lanePosRef.current, PLAYER_SCREEN_Y);
  const pct = Math.min(100, Math.round((distance / FINISH_DISTANCE) * 100));
  const currentSection = sectionAt(distance, branchRef.current ?? "main_street");
  const theme = SECTION_THEME[currentSection?.background ?? "street"];
  const isRooftop = currentSection?.background === "rooftop";

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
            <radialGradient id="magnetGlowCR" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C9A6FF" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#7A4FC9" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7A4FC9" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="shieldGlowCR" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#B6F5FA" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#2FB6C4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2FB6C4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="boostGlowCR" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF3D6" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#FF9C4A" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#FF9C4A" stopOpacity="0" />
            </radialGradient>

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

          {!isRooftop && (
            <g>
              <rect x="0" y="132" width="56" height="120" fill="url(#bldgACR)" />
              <rect x="48" y="98" width="66" height="154" fill="url(#bldgBCR)" />
              <rect x="110" y="140" width="50" height="112" fill="url(#bldgACR)" />
              <rect x="196" y="112" width="60" height="140" fill="url(#bldgBCR)" />
              <rect x="252" y="150" width="54" height="102" fill="url(#bldgACR)" />
              <g fill="#2A1B45" opacity="0.5">
                <rect x="10" y="150" width="8" height="10" /><rect x="26" y="150" width="8" height="10" />
                <rect x="60" y="112" width="8" height="10" /><rect x="78" y="112" width="8" height="10" />
                <rect x="204" y="128" width="8" height="10" /><rect x="222" y="128" width="8" height="10" />
              </g>
            </g>
          )}
          {isRooftop && (
            <g>
              <rect x="0" y="132" width="320" height="120" fill="#3A4658" opacity="0.85" />
              <rect x="0" y="240" width="320" height="12" fill="#2A3440" />
            </g>
          )}

          <rect x="0" y="252" width="320" height="60" fill={isRooftop ? "#5C6B7A" : "#F4EDE0"} />

          <polygon points={`0,312 124,342 24,${ROAD_BOTTOM_Y} 0,${ROAD_BOTTOM_Y}`} fill={theme.sidewalk} />
          <polygon points={`320,312 196,342 296,${ROAD_BOTTOM_Y} 320,${ROAD_BOTTOM_Y}`} fill={theme.sidewalk} />

          <polygon points="124,342 196,342 296,690 24,690" fill={theme.road} />
          <line x1="148" y1="342" x2="115" y2="690" stroke="#FFF7EA" strokeWidth="2.5" strokeDasharray="10 9" opacity="0.55" />
          <line x1="172" y1="342" x2="205" y2="690" stroke="#FFF7EA" strokeWidth="2.5" strokeDasharray="10 9" opacity="0.55" />

          {course.map((item, i) => {
            if ((item.sectionId === "alley" || item.sectionId === "main_street") && item.sectionId !== branchRef.current) return null;
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

          <g transform={`translate(${playerX} ${PLAYER_SCREEN_Y - jumpLift - pose.bob})`}>
            <ellipse cx="0" cy={72 + pose.bob} rx="42" ry="11" fill="url(#shadowGradCR)" />
            <g transform={`rotate(${pose.tilt}) scale(1, ${pose.squashY}) translate(0, ${pose.squashY < 1 ? 78 - 78 / pose.squashY : 0})`}>
              <RunnerGraphic pose={pose} />
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

        {showJunction && (
          <div className="pointer-events-auto absolute inset-x-6 top-[30%] z-40 flex flex-col items-center gap-2 rounded-2xl bg-black/80 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-[#FFD166]">Choose your path</p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() => branchHandlerRef.current?.("alley")}
                className="flex-1 rounded-xl border-2 border-white/30 bg-white/10 px-2 py-2 text-[11px] font-black text-white active:scale-95"
              >
                ← ALLEY
                <div className="font-normal text-white/60">tighter, more stars</div>
              </button>
              <button
                type="button"
                onClick={() => branchHandlerRef.current?.("main_street")}
                className="flex-1 rounded-xl border-2 border-white/30 bg-white/10 px-2 py-2 text-[11px] font-black text-white active:scale-95"
              >
                MAIN ST →
                <div className="font-normal text-white/60">easier, fewer stars</div>
              </button>
            </div>
          </div>
        )}

        {auto && !ended && !showJunction && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/45">Watching their run</p>
        )}
        {canSteer && !showJunction && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-[11px] font-bold text-white/45">
            Swipe left/right for lanes · up to jump · down to slide
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

        <div className="flex flex-col items-center gap-1">
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
              <span className={`font-mono text-[22px] font-black leading-none tabular-nums text-[#FFD166] ${timeLeft <= 8 ? "animate-pulse" : ""}`} style={{ textShadow: "0 0 10px rgba(255,209,102,0.85)" }}>
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
          <div className="flex items-center gap-1">
            {Array.from({ length: STUMBLE_LIVES }).map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i < stumblesLeft ? "bg-[#FF7A59]" : "bg-white/20"}`} />
            ))}
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
