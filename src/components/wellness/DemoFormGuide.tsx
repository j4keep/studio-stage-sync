import type { DemoGuideKind } from "@/lib/wellness-demos";
import type { WellnessFigure } from "@/lib/wellness";

type Props = {
  guide: DemoGuideKind;
  setting?: "studio" | "park";
  title?: string;
  /** Ignored — cards are static pictures, not auto-animated. */
  playing?: boolean;
  figure?: WellnessFigure;
  holdSeconds?: number;
};

/** Inclusive mid-tone skin — not coded to one ethnicity. */
const SKIN = "#a8896c";
const HAIR = "#2f2a26";

type PoseId =
  | "neutral"
  | "neck_left"
  | "neck_right"
  | "neck_down"
  | "neck_up"
  | "shrug_up"
  | "arms_up"
  | "fold"
  | "hip_left"
  | "hip_right"
  | "walk_l"
  | "walk_r"
  | "arm_swing_l"
  | "seated"
  | "seated_lift_l"
  | "seated_twist_l"
  | "seated_twist_r"
  | "seated_side_l"
  | "seated_side_r"
  | "sit"
  | "stand"
  | "wall_push"
  | "squat"
  | "side_l"
  | "side_r"
  | "breathe";

type Panel = {
  pose: PoseId;
  label: string;
  caption?: string;
};

type CardSpec = {
  heading: string;
  panels: Panel[];
};

const CARDS: Record<DemoGuideKind, CardSpec> = {
  neck_tilt: {
    heading: "Neck stretches",
    panels: [
      { pose: "neck_left", label: "5 sec", caption: "Tilt left" },
      { pose: "neck_right", label: "5 sec", caption: "Tilt right" },
      { pose: "neck_down", label: "5 sec", caption: "Chin to chest" },
      { pose: "neck_up", label: "5–10 sec", caption: "Look up gently" },
    ],
  },
  shoulders_roll: {
    heading: "Shoulder rolls",
    panels: [
      { pose: "neutral", label: "Start", caption: "Relaxed" },
      { pose: "shrug_up", label: "Up", caption: "Lift shoulders" },
      { pose: "neutral", label: "Back", caption: "Roll back" },
      { pose: "neutral", label: "Down", caption: "Release" },
    ],
  },
  arms_overhead: {
    heading: "Arms overhead",
    panels: [
      { pose: "neutral", label: "Start", caption: "Arms down" },
      { pose: "arms_up", label: "8 sec", caption: "Reach up" },
      { pose: "arms_up", label: "Breathe", caption: "Hold & inhale" },
      { pose: "neutral", label: "Lower", caption: "Exhale down" },
    ],
  },
  forward_fold: {
    heading: "Forward fold",
    panels: [
      { pose: "neutral", label: "Stand", caption: "Soft knees" },
      { pose: "fold", label: "10 sec", caption: "Hinge forward" },
      { pose: "fold", label: "Hold", caption: "Easy stretch" },
      { pose: "neutral", label: "Rise", caption: "Roll up slow" },
    ],
  },
  hip_circles: {
    heading: "Hip circles",
    panels: [
      { pose: "neutral", label: "Center", caption: "Hands on hips" },
      { pose: "hip_left", label: "Left", caption: "Circle left" },
      { pose: "hip_right", label: "Right", caption: "Circle right" },
      { pose: "neutral", label: "Shake", caption: "Shake out" },
    ],
  },
  stand_tall: {
    heading: "Stand tall",
    panels: [
      { pose: "neutral", label: "Posture", caption: "Soft knees" },
      { pose: "neutral", label: "Ready", caption: "Shoulders soft" },
    ],
  },
  walk: {
    heading: "Easy walk",
    panels: [
      { pose: "walk_l", label: "Step", caption: "Natural pace" },
      { pose: "walk_r", label: "Step", caption: "Keep talking" },
    ],
  },
  arm_swing: {
    heading: "Arm swing",
    panels: [
      { pose: "arm_swing_l", label: "Swing", caption: "Loose arms" },
      { pose: "walk_r", label: "Opposite", caption: "Stay relaxed" },
    ],
  },
  brisk_walk: {
    heading: "Brisk finish",
    panels: [
      { pose: "walk_l", label: "Quicker", caption: "Pick up pace" },
      { pose: "walk_r", label: "Steady", caption: "Not a sprint" },
    ],
  },
  cool_down_walk: {
    heading: "Cool down",
    panels: [
      { pose: "walk_l", label: "Slow", caption: "Ease the pace" },
      { pose: "neutral", label: "Stop", caption: "Breathe easy" },
    ],
  },
  seated_march: {
    heading: "Seated marches",
    panels: [
      { pose: "seated", label: "Sit tall", caption: "Feet flat" },
      { pose: "seated_lift_l", label: "30 sec", caption: "Lift knees" },
    ],
  },
  seated_twist: {
    heading: "Torso twists",
    panels: [
      { pose: "seated", label: "Center", caption: "Sit tall" },
      { pose: "seated_twist_l", label: "5 sec", caption: "Twist left" },
      { pose: "seated_twist_r", label: "5 sec", caption: "Twist right" },
      { pose: "seated", label: "Center", caption: "Reset" },
    ],
  },
  ankle_circles: {
    heading: "Ankle circles",
    panels: [
      { pose: "seated", label: "Lift", caption: "One foot" },
      { pose: "seated", label: "5 sec", caption: "Circle both ways" },
    ],
  },
  side_reach: {
    heading: "Side reaches",
    panels: [
      { pose: "seated", label: "Center", caption: "Sit tall" },
      { pose: "seated_side_l", label: "5 sec", caption: "Reach left" },
      { pose: "seated_side_r", label: "5 sec", caption: "Reach right" },
      { pose: "seated", label: "Done", caption: "Relax" },
    ],
  },
  sit_to_stand: {
    heading: "Sit to stand",
    panels: [
      { pose: "sit", label: "Sit", caption: "Ready" },
      { pose: "stand", label: "Stand", caption: "Push up" },
      { pose: "sit", label: "Sit", caption: "Controlled" },
      { pose: "stand", label: "×6", caption: "Easy reps" },
    ],
  },
  march_place: {
    heading: "March in place",
    panels: [
      { pose: "walk_l", label: "March", caption: "Soft knees" },
      { pose: "walk_r", label: "1 min", caption: "Steady rhythm" },
    ],
  },
  wall_pushup: {
    heading: "Wall push-ups",
    panels: [
      { pose: "neutral", label: "Setup", caption: "Hands on wall" },
      { pose: "wall_push", label: "Bend", caption: "Elbows soft" },
      { pose: "neutral", label: "Press", caption: "Push away" },
      { pose: "wall_push", label: "×8", caption: "Slow reps" },
    ],
  },
  squat: {
    heading: "Bodyweight squats",
    panels: [
      { pose: "neutral", label: "Stand", caption: "Feet hip-width" },
      { pose: "squat", label: "Down", caption: "Shallow OK" },
      { pose: "neutral", label: "Up", caption: "Stand tall" },
      { pose: "squat", label: "×8", caption: "Easy reps" },
    ],
  },
  side_steps: {
    heading: "Side steps",
    panels: [
      { pose: "side_l", label: "Left", caption: "Step out" },
      { pose: "side_r", label: "Right", caption: "Step out" },
      { pose: "side_l", label: "45 sec", caption: "Keep going" },
      { pose: "neutral", label: "Done", caption: "Reset" },
    ],
  },
  cool_stretch: {
    heading: "Cool-down stretch",
    panels: [
      { pose: "arms_up", label: "Reach", caption: "Overhead" },
      { pose: "fold", label: "10 sec", caption: "Soft fold" },
      { pose: "neutral", label: "Rise", caption: "Slow" },
      { pose: "breathe", label: "Breathe", caption: "Easy" },
    ],
  },
  breathe_calm: {
    heading: "Calm breathing",
    panels: [
      { pose: "breathe", label: "In", caption: "Breathe in" },
      { pose: "breathe", label: "Hold", caption: "Pause" },
      { pose: "neutral", label: "Out", caption: "Breathe out" },
      { pose: "breathe", label: "Repeat", caption: "Stay soft" },
    ],
  },
};

/**
 * Static instructional exercise cards (like the neck-stretch stock diagrams).
 * Numbered panels with hold times + arrows — not auto-animated silhouettes.
 */
export default function DemoFormGuide({
  guide,
  title,
  figure = "woman",
  holdSeconds,
}: Props) {
  const card = CARDS[guide] ?? {
    heading: title || "Exercise guide",
    panels: [
      { pose: "neutral" as PoseId, label: "Start", caption: "Ready" },
      {
        pose: "neutral" as PoseId,
        label: holdSeconds ? `${holdSeconds} sec` : "Hold",
        caption: title || "Follow along",
      },
    ],
  };

  return (
    <div className="relative flex h-full w-full flex-col bg-[#f7faf8] px-2.5 pb-2.5 pt-3">
      <p className="text-center text-[11px] font-black uppercase tracking-[0.14em] text-rose-600">
        {card.heading}
      </p>
      <p className="mt-0.5 text-center text-[10px] font-semibold text-stone-500">
        {figure === "man" ? "Men’s form guide" : "Women’s form guide"}
        {holdSeconds ? ` · hold ~${holdSeconds}s` : ""}
      </p>

      <div className="mt-2 grid flex-1 grid-cols-2 gap-1.5" style={{ gridAutoRows: "1fr" }}>
        {card.panels.map((panel, i) => (
          <div
            key={`${panel.pose}-${i}`}
            className="relative flex flex-col items-center justify-between rounded-xl border border-stone-200/90 bg-white px-1 pb-1.5 pt-1 shadow-sm"
          >
            <span className="absolute left-1.5 top-1 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-stone-800 text-[9px] font-black text-white">
              {i + 1}
            </span>
            <div className="flex w-full flex-1 items-center justify-center pt-1">
              <StaticFigure figure={figure} pose={panel.pose} />
            </div>
            <div className="mt-0.5 w-full text-center">
              {panel.caption ? (
                <p className="text-[9px] font-bold uppercase tracking-wide text-stone-600">{panel.caption}</p>
              ) : null}
              <p className="text-[10px] font-black text-sky-600">{panel.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type FigureProps = { figure: WellnessFigure; pose: PoseId };

/**
 * One complete connected figure per pose.
 * Limbs are drawn from the torso — no CSS animations that detach body parts.
 */
function StaticFigure({ figure, pose }: FigureProps) {
  const isWoman = figure === "woman";
  const top = isWoman ? "#e07a5f" : "#3d8b8b";
  const topDark = isWoman ? "#c45f48" : "#2f6f6f";
  const pants = "#2b2b2b";
  const cfg = poseConfig(pose);

  return (
    <svg viewBox="0 0 120 160" className="h-[112px] w-auto max-w-full" aria-hidden>
      {cfg.chair ? (
        <g opacity="0.4">
          <rect x="28" y="88" width="64" height="7" rx="2" fill="#6b7c76" />
          <rect x="32" y="95" width="6" height="36" rx="1" fill="#6b7c76" />
          <rect x="82" y="95" width="6" height="36" rx="1" fill="#6b7c76" />
          <rect x="38" y="58" width="5" height="30" rx="1" fill="#6b7c76" />
          <rect x="77" y="58" width="5" height="30" rx="1" fill="#6b7c76" />
        </g>
      ) : null}

      {cfg.wall ? <rect x="102" y="20" width="8" height="120" rx="2" fill="#8a9a94" opacity="0.45" /> : null}

      <g transform={`translate(${cfg.shiftX},${cfg.shiftY + cfg.squatY})`}>
        {/* Legs */}
        <path
          d={`M52 95 C${50 + cfg.legLX} 118, ${48 + cfg.legLX} 138, ${46 + cfg.legLX} 148`}
          fill="none"
          stroke={SKIN}
          strokeWidth={isWoman ? 9 : 10}
          strokeLinecap="round"
        />
        <path
          d={`M68 95 C${70 + cfg.legRX} 118, ${72 + cfg.legRX} 138, ${74 + cfg.legRX} 148`}
          fill="none"
          stroke={SKIN}
          strokeWidth={isWoman ? 9 : 10}
          strokeLinecap="round"
        />
        <ellipse cx={44 + cfg.legLX} cy={150} rx="9" ry="3.5" fill="#222" />
        <ellipse cx={76 + cfg.legRX} cy={150} rx="9" ry="3.5" fill="#222" />
        <path
          d={isWoman ? "M48 90 L72 90 L70 104 L50 104 Z" : "M46 90 L74 90 L72 106 L48 106 Z"}
          fill={pants}
        />

        {/* Torso + arms + head — one unit so nothing disconnects */}
        <g transform={`rotate(${cfg.torsoRot} 60 70)`}>
          <path
            d={
              isWoman
                ? "M50 48 C50 42, 70 42, 70 48 L72 90 C72 96, 48 96, 48 90 Z"
                : "M46 46 C46 40, 74 40, 74 46 L76 90 C76 96, 44 96, 44 90 Z"
            }
            fill={top}
          />
          <path
            d={
              isWoman
                ? "M50 48 C50 42, 70 42, 70 48 L71 62 L49 62 Z"
                : "M46 46 C46 40, 74 40, 74 46 L75 60 L45 60 Z"
            }
            fill={topDark}
            opacity="0.35"
          />

          <path
            d={`M${isWoman ? 52 : 50} 54 C${cfg.armLX1} ${cfg.armLY1}, ${cfg.armLX2} ${cfg.armLY2}, ${cfg.armLX3} ${cfg.armLY3}`}
            fill="none"
            stroke={SKIN}
            strokeWidth={isWoman ? 8 : 9}
            strokeLinecap="round"
          />
          <path
            d={`M${isWoman ? 68 : 70} 54 C${cfg.armRX1} ${cfg.armRY1}, ${cfg.armRX2} ${cfg.armRY2}, ${cfg.armRX3} ${cfg.armRY3}`}
            fill="none"
            stroke={SKIN}
            strokeWidth={isWoman ? 8 : 9}
            strokeLinecap="round"
          />

          <g transform={`rotate(${cfg.headTilt} 60 ${isWoman ? 38 : 36}) translate(0, ${cfg.headY})`}>
            {isWoman ? (
              <path
                d="M44 34 C42 18, 78 18, 76 34 C80 48, 78 58, 72 60 C68 50, 52 50, 48 60 C42 58, 40 48, 44 34 Z"
                fill={HAIR}
              />
            ) : (
              <>
                <ellipse cx="60" cy="28" rx="15" ry="11" fill={HAIR} />
                <rect x="46" y="28" width="28" height="8" fill={HAIR} />
              </>
            )}
            <rect x="56" y="40" width="8" height="8" rx="2" fill={SKIN} />
            <circle cx="60" cy={isWoman ? 34 : 32} r={isWoman ? 12 : 13} fill={SKIN} />
          </g>
        </g>
      </g>

      {cfg.arrow ? (
        <g stroke="#38bdf8" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {cfg.arrow === "left" && (
            <>
              <path d="M28 36 Q18 30 24 20" />
              <path d="M20 24 L24 18 L28 24" />
            </>
          )}
          {cfg.arrow === "right" && (
            <>
              <path d="M92 36 Q102 30 96 20" />
              <path d="M92 24 L96 18 L100 24" />
            </>
          )}
          {cfg.arrow === "down" && (
            <>
              <path d="M96 40 L96 58" />
              <path d="M90 52 L96 60 L102 52" />
            </>
          )}
          {cfg.arrow === "up" && (
            <>
              <path d="M96 58 L96 40" />
              <path d="M90 46 L96 38 L102 46" />
            </>
          )}
          {cfg.arrow === "circle" && <path d="M90 44 A12 12 0 1 1 88 40" />}
        </g>
      ) : null}
    </svg>
  );
}

type PoseCfg = {
  headTilt: number;
  headY: number;
  torsoRot: number;
  squatY: number;
  shiftX: number;
  shiftY: number;
  legLX: number;
  legRX: number;
  armLX1: number;
  armLY1: number;
  armLX2: number;
  armLY2: number;
  armLX3: number;
  armLY3: number;
  armRX1: number;
  armRY1: number;
  armRX2: number;
  armRY2: number;
  armRX3: number;
  armRY3: number;
  chair?: boolean;
  wall?: boolean;
  arrow?: "left" | "right" | "up" | "down" | "circle";
};

function basePose(): PoseCfg {
  return {
    headTilt: 0,
    headY: 0,
    torsoRot: 0,
    squatY: 0,
    shiftX: 0,
    shiftY: 0,
    legLX: 0,
    legRX: 0,
    armLX1: 36,
    armLY1: 70,
    armLX2: 30,
    armLY2: 95,
    armLX3: 32,
    armLY3: 112,
    armRX1: 84,
    armRY1: 70,
    armRX2: 90,
    armRY2: 95,
    armRX3: 88,
    armRY3: 112,
  };
}

function poseConfig(pose: PoseId): PoseCfg {
  const p = basePose();
  switch (pose) {
    case "neck_left":
      return { ...p, headTilt: -28, arrow: "left" };
    case "neck_right":
      return { ...p, headTilt: 28, arrow: "right" };
    case "neck_down":
      return { ...p, headY: 5, arrow: "down" };
    case "neck_up":
      return { ...p, headY: -4, arrow: "up" };
    case "shrug_up":
      return {
        ...p,
        armLY1: 58,
        armLY2: 78,
        armLY3: 98,
        armRY1: 58,
        armRY2: 78,
        armRY3: 98,
        arrow: "up",
      };
    case "arms_up":
      return {
        ...p,
        armLX1: 40,
        armLY1: 40,
        armLX2: 36,
        armLY2: 22,
        armLX3: 42,
        armLY3: 8,
        armRX1: 80,
        armRY1: 40,
        armRX2: 84,
        armRY2: 22,
        armRX3: 78,
        armRY3: 8,
        arrow: "up",
      };
    case "fold":
      return {
        ...p,
        squatY: 8,
        shiftY: 6,
        armLX1: 44,
        armLY1: 90,
        armLX2: 48,
        armLY2: 115,
        armLX3: 52,
        armLY3: 132,
        armRX1: 76,
        armRY1: 90,
        armRX2: 72,
        armRY2: 115,
        armRX3: 68,
        armRY3: 132,
        arrow: "down",
      };
    case "hip_left":
      return { ...p, shiftX: -8, torsoRot: -6, arrow: "circle" };
    case "hip_right":
      return { ...p, shiftX: 8, torsoRot: 6, arrow: "circle" };
    case "walk_l":
      return { ...p, legLX: -10, legRX: 10, armLX3: 28, armLY3: 100, armRX3: 92, armRY3: 120 };
    case "walk_r":
      return { ...p, legLX: 10, legRX: -10, armLX3: 28, armLY3: 120, armRX3: 92, armRY3: 100 };
    case "arm_swing_l":
      return { ...p, armLX3: 24, armLY3: 95, armRX3: 96, armRY3: 118 };
    case "seated":
      return { ...p, chair: true, squatY: 18, shiftY: -6, legLX: 4, legRX: -4, armLY3: 100, armRY3: 100 };
    case "seated_lift_l":
      return {
        ...p,
        chair: true,
        squatY: 18,
        shiftY: -6,
        legLX: -6,
        legRX: -4,
        armLY3: 100,
        armRY3: 100,
        arrow: "up",
      };
    case "seated_twist_l":
      return { ...p, chair: true, squatY: 18, shiftY: -6, torsoRot: -16, arrow: "left" };
    case "seated_twist_r":
      return { ...p, chair: true, squatY: 18, shiftY: -6, torsoRot: 16, arrow: "right" };
    case "seated_side_l":
      return {
        ...p,
        chair: true,
        squatY: 18,
        shiftY: -6,
        torsoRot: -10,
        armLX1: 40,
        armLY1: 36,
        armLX2: 28,
        armLY2: 18,
        armLX3: 22,
        armLY3: 8,
        arrow: "left",
      };
    case "seated_side_r":
      return {
        ...p,
        chair: true,
        squatY: 18,
        shiftY: -6,
        torsoRot: 10,
        armRX1: 80,
        armRY1: 36,
        armRX2: 92,
        armRY2: 18,
        armRX3: 98,
        armRY3: 8,
        arrow: "right",
      };
    case "sit":
      return { ...p, chair: true, squatY: 22, shiftY: -4 };
    case "stand":
      return { ...p, chair: true };
    case "wall_push":
      return {
        ...p,
        wall: true,
        shiftX: 10,
        torsoRot: 8,
        armLX1: 70,
        armLY1: 55,
        armLX2: 88,
        armLY2: 55,
        armLX3: 100,
        armLY3: 55,
        armRX1: 74,
        armRY1: 62,
        armRX2: 90,
        armRY2: 62,
        armRX3: 100,
        armRY3: 62,
      };
    case "squat":
      return {
        ...p,
        squatY: 16,
        armLX1: 34,
        armLY1: 75,
        armLX2: 28,
        armLY2: 95,
        armLX3: 30,
        armLY3: 108,
        armRX1: 86,
        armRY1: 75,
        armRX2: 92,
        armRY2: 95,
        armRX3: 90,
        armRY3: 108,
        arrow: "down",
      };
    case "side_l":
      return { ...p, shiftX: -12, legLX: -8, legRX: 4, arrow: "left" };
    case "side_r":
      return { ...p, shiftX: 12, legLX: -4, legRX: 8, arrow: "right" };
    case "breathe":
      return {
        ...p,
        armLX1: 40,
        armLY1: 68,
        armLX2: 38,
        armLY2: 82,
        armLX3: 42,
        armLY3: 92,
        armRX1: 80,
        armRY1: 68,
        armRX2: 82,
        armRY2: 82,
        armRX3: 78,
        armRY3: 92,
      };
    case "neutral":
    default:
      return p;
  }
}
