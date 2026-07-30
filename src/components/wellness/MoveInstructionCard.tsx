import { useEffect, useState } from "react";
import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure } from "@/lib/wellness";

type Props = {
  illustration: MoveIllustrationId;
  title: string;
  stepNumber: number;
  totalSteps: number;
  figure?: WellnessFigure;
  holdLeft?: number | null;
  caption?: string;
  animating?: boolean;
};

const SKIN = "#a8896c";
const HAIR = "#2f2a26";

type Pt = { x: number; y: number };

/** Skeleton joints — limbs are always drawn between connected joints (never CSS-detached). */
type Skeleton = {
  head: Pt;
  neck: Pt;
  hip: Pt;
  lShoulder: Pt;
  rShoulder: Pt;
  lElbow: Pt;
  rElbow: Pt;
  lHand: Pt;
  rHand: Pt;
  lKnee: Pt;
  rKnee: Pt;
  lFoot: Pt;
  rFoot: Pt;
  /** Optional torso lean degrees for drawing only (applied in joint math, not CSS). */
  chair?: boolean;
  wall?: boolean;
  arrow?: "left" | "right" | "up" | "down" | "circle";
};

/**
 * Instruction card with a solid, connected figure.
 * Animation = swap between complete pose drawings (crossfade), never spinning
 * detached head/arm/leg layers.
 */
export default function MoveInstructionCard({
  illustration,
  title,
  stepNumber,
  totalSteps,
  figure = "woman",
  holdLeft = null,
  caption,
  animating = true,
}: Props) {
  return (
    <div className="relative mx-auto flex w-full max-w-[340px] flex-col overflow-hidden rounded-[1.6rem] border border-stone-200 bg-white shadow-[0_20px_50px_-28px_rgba(15,80,70,0.45)]">
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
          Step {stepNumber}/{totalSteps}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-600">Form guide</span>
      </div>
      <h2 className="px-4 text-center text-lg font-black tracking-tight text-stone-900">{title}</h2>

      <div className="relative mx-auto my-2 flex aspect-square w-[88%] max-w-[280px] items-center justify-center rounded-2xl bg-gradient-to-b from-[#eef6f3] to-[#f7faf8]">
        <ConnectedFigure kind={illustration} figure={figure} playing={animating} />
        {holdLeft != null && holdLeft > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-teal-950/25 backdrop-blur-[1px]">
            <p className="text-6xl font-black tabular-nums text-white drop-shadow-lg">{holdLeft}</p>
          </div>
        ) : null}
      </div>

      {caption ? (
        <p className="min-h-[3.25rem] px-4 pb-4 text-center text-sm font-medium leading-snug text-stone-600">
          {caption}
        </p>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}

function ConnectedFigure({
  kind,
  figure,
  playing,
}: {
  kind: MoveIllustrationId;
  figure: WellnessFigure;
  playing: boolean;
}) {
  const frames = poseFrames(kind);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!playing || frames.length < 2) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, [kind, playing, frames.length]);

  const sk = frames[Math.min(frame, frames.length - 1)]!;
  const isWoman = figure === "woman";
  const top = isWoman ? "#e07a5f" : "#3d8b8b";
  const stroke = isWoman ? 11 : 13;
  const armStroke = isWoman ? 10 : 12;

  return (
    <svg viewBox="0 0 200 240" className="h-[92%] w-auto transition-opacity duration-500" aria-hidden>
      {sk.chair ? (
        <g opacity="0.35">
          <rect x="55" y="138" width="90" height="9" rx="2" fill="#5a6b66" />
          <rect x="62" y="147" width="7" height="48" rx="2" fill="#5a6b66" />
          <rect x="131" y="147" width="7" height="48" rx="2" fill="#5a6b66" />
          <rect x="70" y="100" width="6" height="38" rx="1" fill="#5a6b66" />
          <rect x="124" y="100" width="6" height="38" rx="1" fill="#5a6b66" />
        </g>
      ) : null}
      {sk.wall ? <rect x="170" y="28" width="10" height="180" rx="2" fill="#7a8f88" opacity="0.4" /> : null}

      {/* Direction arrows — separate from the body */}
      {sk.arrow === "left" && (
        <g stroke="#38bdf8" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M46 68 Q30 56 40 40" />
          <path d="M32 48 L40 38 L46 50" />
        </g>
      )}
      {sk.arrow === "right" && (
        <g stroke="#38bdf8" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M154 68 Q170 56 160 40" />
          <path d="M154 50 L160 38 L168 48" />
        </g>
      )}
      {sk.arrow === "up" && (
        <g stroke="#38bdf8" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M168 90 L168 52" />
          <path d="M160 62 L168 50 L176 62" />
        </g>
      )}
      {sk.arrow === "down" && (
        <g stroke="#38bdf8" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M168 52 L168 96" />
          <path d="M160 86 L168 98 L176 86" />
        </g>
      )}
      {sk.arrow === "circle" && (
        <path
          d="M158 78 A16 16 0 1 1 156 74"
          stroke="#f87171"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* ONE connected body — every segment meets at a joint */}
      <g>
        {/* Legs: hip → knee → foot */}
        <path
          d={`M${sk.hip.x} ${sk.hip.y} L${sk.lKnee.x} ${sk.lKnee.y} L${sk.lFoot.x} ${sk.lFoot.y}`}
          fill="none"
          stroke={SKIN}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${sk.hip.x} ${sk.hip.y} L${sk.rKnee.x} ${sk.rKnee.y} L${sk.rFoot.x} ${sk.rFoot.y}`}
          fill="none"
          stroke={SKIN}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse cx={sk.lFoot.x} cy={sk.lFoot.y + 2} rx="11" ry="4.5" fill="#222" />
        <ellipse cx={sk.rFoot.x} cy={sk.rFoot.y + 2} rx="11" ry="4.5" fill="#222" />

        {/* Shorts / hips */}
        <ellipse cx={sk.hip.x} cy={sk.hip.y - 2} rx={isWoman ? 18 : 22} ry={isWoman ? 10 : 12} fill="#2b2b2b" />

        {/* Torso: neck → hip (filled shape using shoulders) */}
        <path
          d={`M${sk.lShoulder.x} ${sk.lShoulder.y}
              L${sk.rShoulder.x} ${sk.rShoulder.y}
              L${sk.hip.x + (isWoman ? 16 : 20)} ${sk.hip.y}
              L${sk.hip.x - (isWoman ? 16 : 20)} ${sk.hip.y} Z`}
          fill={top}
        />

        {/* Arms: shoulder → elbow → hand */}
        <path
          d={`M${sk.lShoulder.x} ${sk.lShoulder.y} L${sk.lElbow.x} ${sk.lElbow.y} L${sk.lHand.x} ${sk.lHand.y}`}
          fill="none"
          stroke={SKIN}
          strokeWidth={armStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${sk.rShoulder.x} ${sk.rShoulder.y} L${sk.rElbow.x} ${sk.rElbow.y} L${sk.rHand.x} ${sk.rHand.y}`}
          fill="none"
          stroke={SKIN}
          strokeWidth={armStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Neck stub connecting torso to head */}
        <path
          d={`M${sk.neck.x} ${sk.neck.y} L${sk.head.x} ${sk.head.y + 14}`}
          fill="none"
          stroke={SKIN}
          strokeWidth={10}
          strokeLinecap="round"
        />

        {/* Head + hair drawn at head joint */}
        {isWoman ? (
          <path
            d={`M${sk.head.x - 16} ${sk.head.y + 2}
                C${sk.head.x - 18} ${sk.head.y - 22}, ${sk.head.x + 18} ${sk.head.y - 22}, ${sk.head.x + 16} ${sk.head.y + 2}
                C${sk.head.x + 20} ${sk.head.y + 18}, ${sk.head.x + 14} ${sk.head.y + 28}, ${sk.head.x + 10} ${sk.head.y + 30}
                C${sk.head.x + 6} ${sk.head.y + 16}, ${sk.head.x - 6} ${sk.head.y + 16}, ${sk.head.x - 10} ${sk.head.y + 30}
                C${sk.head.x - 14} ${sk.head.y + 28}, ${sk.head.x - 20} ${sk.head.y + 18}, ${sk.head.x - 16} ${sk.head.y + 2} Z`}
            fill={HAIR}
          />
        ) : (
          <>
            <ellipse cx={sk.head.x} cy={sk.head.y - 4} rx="17" ry="12" fill={HAIR} />
            <rect x={sk.head.x - 17} y={sk.head.y - 4} width="34" height="10" fill={HAIR} />
          </>
        )}
        <circle cx={sk.head.x} cy={sk.head.y} r={isWoman ? 15 : 16} fill={SKIN} />
      </g>
    </svg>
  );
}

function standingBase(overrides: Partial<Skeleton> = {}): Skeleton {
  return {
    head: { x: 100, y: 48 },
    neck: { x: 100, y: 64 },
    lShoulder: { x: 78, y: 78 },
    rShoulder: { x: 122, y: 78 },
    lElbow: { x: 64, y: 108 },
    rElbow: { x: 136, y: 108 },
    lHand: { x: 58, y: 138 },
    rHand: { x: 142, y: 138 },
    hip: { x: 100, y: 128 },
    lKnee: { x: 88, y: 170 },
    rKnee: { x: 112, y: 170 },
    lFoot: { x: 82, y: 210 },
    rFoot: { x: 118, y: 210 },
    ...overrides,
  };
}

function seatedBase(overrides: Partial<Skeleton> = {}): Skeleton {
  return {
    head: { x: 100, y: 52 },
    neck: { x: 100, y: 68 },
    lShoulder: { x: 80, y: 82 },
    rShoulder: { x: 120, y: 82 },
    lElbow: { x: 66, y: 108 },
    rElbow: { x: 134, y: 108 },
    lHand: { x: 62, y: 128 },
    rHand: { x: 138, y: 128 },
    hip: { x: 100, y: 132 },
    lKnee: { x: 78, y: 168 },
    rKnee: { x: 122, y: 168 },
    lFoot: { x: 70, y: 200 },
    rFoot: { x: 130, y: 200 },
    chair: true,
    ...overrides,
  };
}

/** Two (or more) complete connected poses per move — crossfaded by frame index. */
function poseFrames(kind: MoveIllustrationId): Skeleton[] {
  switch (kind) {
    case "shoulders_roll":
      return [
        standingBase(),
        standingBase({
          lShoulder: { x: 78, y: 70 },
          rShoulder: { x: 122, y: 70 },
          lElbow: { x: 62, y: 98 },
          rElbow: { x: 138, y: 98 },
          lHand: { x: 56, y: 124 },
          rHand: { x: 144, y: 124 },
          arrow: "circle",
        }),
      ];
    case "neck_left":
      return [
        standingBase({ head: { x: 100, y: 48 }, arrow: "left" }),
        standingBase({ head: { x: 82, y: 58 }, neck: { x: 94, y: 66 }, arrow: "left" }),
      ];
    case "neck_right":
      return [
        standingBase({ head: { x: 100, y: 48 }, arrow: "right" }),
        standingBase({ head: { x: 118, y: 58 }, neck: { x: 106, y: 66 }, arrow: "right" }),
      ];
    case "arms_overhead":
      return [
        standingBase({ arrow: "up" }),
        standingBase({
          lElbow: { x: 70, y: 48 },
          rElbow: { x: 130, y: 48 },
          lHand: { x: 78, y: 22 },
          rHand: { x: 122, y: 22 },
          arrow: "up",
        }),
      ];
    case "forward_fold":
      return [
        standingBase({ arrow: "down" }),
        standingBase({
          head: { x: 100, y: 150 },
          neck: { x: 100, y: 130 },
          lShoulder: { x: 82, y: 118 },
          rShoulder: { x: 118, y: 118 },
          lElbow: { x: 90, y: 150 },
          rElbow: { x: 110, y: 150 },
          lHand: { x: 96, y: 178 },
          rHand: { x: 104, y: 178 },
          hip: { x: 100, y: 118 },
          lKnee: { x: 90, y: 165 },
          rKnee: { x: 110, y: 165 },
          arrow: "down",
        }),
      ];
    case "hip_circles":
      return [
        standingBase({ hip: { x: 92, y: 130 }, arrow: "circle" }),
        standingBase({ hip: { x: 108, y: 130 }, arrow: "circle" }),
      ];
    case "stand_tall":
      return [standingBase(), standingBase({ head: { x: 100, y: 46 }, neck: { x: 100, y: 62 } })];
    case "walk":
    case "march_place":
      return [
        standingBase({
          lKnee: { x: 78, y: 160 },
          lFoot: { x: 70, y: 200 },
          rKnee: { x: 120, y: 175 },
          rFoot: { x: 128, y: 212 },
          lHand: { x: 70, y: 130 },
          rHand: { x: 148, y: 145 },
        }),
        standingBase({
          rKnee: { x: 122, y: 160 },
          rFoot: { x: 130, y: 200 },
          lKnee: { x: 80, y: 175 },
          lFoot: { x: 72, y: 212 },
          rHand: { x: 130, y: 130 },
          lHand: { x: 52, y: 145 },
        }),
      ];
    case "arm_swing":
      return [
        standingBase({ lHand: { x: 50, y: 120 }, rHand: { x: 150, y: 150 } }),
        standingBase({ lHand: { x: 50, y: 150 }, rHand: { x: 150, y: 120 } }),
      ];
    case "brisk_walk":
      return poseFrames("walk").map((s) => ({ ...s }));
    case "cool_down":
      return [
        standingBase({
          lKnee: { x: 90, y: 168 },
          rKnee: { x: 110, y: 168 },
          lFoot: { x: 86, y: 208 },
          rFoot: { x: 114, y: 208 },
        }),
        standingBase(),
      ];
    case "seated_march":
      return [
        seatedBase(),
        seatedBase({
          lKnee: { x: 78, y: 150 },
          lFoot: { x: 72, y: 180 },
        }),
        seatedBase({
          rKnee: { x: 122, y: 150 },
          rFoot: { x: 128, y: 180 },
        }),
      ];
    case "seated_twist":
      return [
        seatedBase({
          lShoulder: { x: 70, y: 86 },
          rShoulder: { x: 110, y: 78 },
          head: { x: 92, y: 52 },
          arrow: "left",
        }),
        seatedBase({
          lShoulder: { x: 90, y: 78 },
          rShoulder: { x: 130, y: 86 },
          head: { x: 108, y: 52 },
          arrow: "right",
        }),
      ];
    case "ankle_circles":
      return [
        seatedBase({ rFoot: { x: 138, y: 195 }, arrow: "circle" }),
        seatedBase({ rFoot: { x: 122, y: 205 }, arrow: "circle" }),
      ];
    case "side_reach":
      return [
        seatedBase({
          rHand: { x: 150, y: 36 },
          rElbow: { x: 138, y: 60 },
          head: { x: 108, y: 56 },
          arrow: "right",
        }),
        seatedBase({
          lHand: { x: 50, y: 36 },
          lElbow: { x: 62, y: 60 },
          head: { x: 92, y: 56 },
          arrow: "left",
        }),
      ];
    case "sit_to_stand":
      return [
        seatedBase(),
        standingBase({
          chair: true,
          hip: { x: 100, y: 120 },
          lKnee: { x: 88, y: 165 },
          rKnee: { x: 112, y: 165 },
        }),
      ];
    case "wall_pushup":
      return [
        standingBase({
          wall: true,
          lHand: { x: 168, y: 90 },
          rHand: { x: 168, y: 100 },
          lElbow: { x: 140, y: 92 },
          rElbow: { x: 140, y: 102 },
          lShoulder: { x: 110, y: 80 },
          rShoulder: { x: 125, y: 82 },
          hip: { x: 95, y: 130 },
          head: { x: 118, y: 50 },
          neck: { x: 115, y: 66 },
        }),
        standingBase({
          wall: true,
          lHand: { x: 168, y: 90 },
          rHand: { x: 168, y: 100 },
          lElbow: { x: 150, y: 92 },
          rElbow: { x: 150, y: 102 },
          lShoulder: { x: 125, y: 78 },
          rShoulder: { x: 140, y: 80 },
          hip: { x: 105, y: 128 },
          head: { x: 132, y: 48 },
          neck: { x: 128, y: 64 },
        }),
      ];
    case "squat":
      return [
        standingBase(),
        standingBase({
          hip: { x: 100, y: 150 },
          lKnee: { x: 78, y: 175 },
          rKnee: { x: 122, y: 175 },
          lFoot: { x: 72, y: 212 },
          rFoot: { x: 128, y: 212 },
          head: { x: 100, y: 70 },
          neck: { x: 100, y: 86 },
          lShoulder: { x: 78, y: 100 },
          rShoulder: { x: 122, y: 100 },
          lElbow: { x: 60, y: 120 },
          rElbow: { x: 140, y: 120 },
          lHand: { x: 52, y: 140 },
          rHand: { x: 148, y: 140 },
          arrow: "down",
        }),
      ];
    case "side_steps":
      return [
        standingBase({
          hip: { x: 88, y: 128 },
          head: { x: 88, y: 48 },
          neck: { x: 88, y: 64 },
          lShoulder: { x: 66, y: 78 },
          rShoulder: { x: 110, y: 78 },
          lFoot: { x: 70, y: 210 },
          rFoot: { x: 106, y: 210 },
          arrow: "left",
        }),
        standingBase({
          hip: { x: 112, y: 128 },
          head: { x: 112, y: 48 },
          neck: { x: 112, y: 64 },
          lShoulder: { x: 90, y: 78 },
          rShoulder: { x: 134, y: 78 },
          lFoot: { x: 94, y: 210 },
          rFoot: { x: 130, y: 210 },
          arrow: "right",
        }),
      ];
    case "cool_stretch":
      return poseFrames("arms_overhead");
    default:
      return [standingBase()];
  }
}
