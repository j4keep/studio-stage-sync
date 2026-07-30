import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure, WellnessSkinTone } from "@/lib/wellness";

type Props = {
  move: MoveIllustrationId;
  figure?: WellnessFigure;
  skinTone?: WellnessSkinTone;
  playing?: boolean;
  className?: string;
};

const SKIN: Record<WellnessSkinTone, string> = {
  porcelain: "#e8c4a8",
  warm: "#c9956c",
  medium: "#a67c52",
  rich: "#8b5e3c",
  deep: "#5c3a24",
};

const SEATED: MoveIllustrationId[] = [
  "seated_march",
  "seated_twist",
  "ankle_circles",
  "side_reach",
  "sit_to_stand",
];

/**
 * YAJ Wellness Coach — one reusable fitness avatar (Apple Fitness / NTC style).
 *
 * Joint POSITION lives only in SVG `transform="translate(...)"` wrappers that
 * CSS never touches. Inner `.rot-*` groups receive CSS `rotate()` only, with
 * `transform-origin` at the joint (top-center for limbs, bottom-center for head).
 * That keeps the skeleton connected — no floating limbs or detached heads.
 */
export default function YajWellnessAvatar({
  move,
  figure = "woman",
  skinTone = "medium",
  playing = true,
  className = "",
}: Props) {
  const skin = SKIN[skinTone] ?? SKIN.medium;
  const isWoman = figure === "woman";
  const top = isWoman ? "#2dd4bf" : "#0f766e";
  const topDark = isWoman ? "#14b8a6" : "#115e59";
  const shorts = "#1e293b";
  const shoe = "#0f172a";
  const hair = "#292524";
  const anim = playing ? move : "idle";
  const showChair = SEATED.includes(move);

  return (
    <svg
      viewBox="0 0 200 260"
      className={`h-full w-auto max-h-full ${className}`}
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id="yajCoachTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={topDark} />
        </linearGradient>
        <linearGradient id="yajCoachGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dfece7" stopOpacity="0" />
          <stop offset="100%" stopColor="#cbd5d1" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="248" rx="48" ry="7" fill="url(#yajCoachGround)" />

      {showChair && (
        <g opacity="0.38">
          <rect x="56" y="154" width="88" height="9" rx="2.5" fill="#64748b" />
          <rect x="62" y="163" width="7" height="52" rx="1.5" fill="#64748b" />
          <rect x="131" y="163" width="7" height="52" rx="1.5" fill="#64748b" />
          <rect x="54" y="150" width="12" height="18" rx="2" fill="#94a3b8" />
          <rect x="134" y="150" width="12" height="18" rx="2" fill="#94a3b8" />
        </g>
      )}
      {move === "wall_pushup" && (
        <rect x="176" y="36" width="10" height="190" rx="2" fill="#94a3b8" opacity="0.5" />
      )}

      {(move === "neck_left" || move === "neck_right") && (
        <g
          stroke="#38bdf8"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        >
          {move === "neck_left" ? (
            <>
              <path d="M42 78 Q28 66 36 50" />
              <path d="M28 58 L36 48 L44 58" />
            </>
          ) : (
            <>
              <path d="M158 78 Q172 66 164 50" />
              <path d="M156 58 L164 48 L172 58" />
            </>
          )}
        </g>
      )}

      <g className={`yaj-coach yaj-coach--${anim}`} data-figure={figure}>
        {/* Hip root — SVG translate only */}
        <g transform="translate(100 148)">
          {/* LEFT LEG */}
          <g transform="translate(-12 2)">
            <g className="rot-leg-l limb">
              <rect x="-7" y="0" width="14" height="36" rx="7" fill={skin} />
              <rect x="-8" y="0" width="16" height="16" rx="6" fill={shorts} opacity="0.95" />
              <g transform="translate(0 34)">
                <g className="rot-shin-l limb">
                  <rect x="-6.5" y="0" width="13" height="38" rx="6.5" fill={skin} />
                  <ellipse cx="2" cy="40" rx="11" ry="4.5" fill={shoe} />
                </g>
              </g>
            </g>
          </g>

          {/* RIGHT LEG */}
          <g transform="translate(12 2)">
            <g className="rot-leg-r limb">
              <rect x="-7" y="0" width="14" height="36" rx="7" fill={skin} />
              <rect x="-8" y="0" width="16" height="16" rx="6" fill={shorts} opacity="0.95" />
              <g transform="translate(0 34)">
                <g className="rot-shin-r limb">
                  <rect x="-6.5" y="0" width="13" height="38" rx="6.5" fill={skin} />
                  <ellipse cx="-2" cy="40" rx="11" ry="4.5" fill={shoe} />
                </g>
              </g>
            </g>
          </g>

          {/* Shorts bridge */}
          <rect
            x={isWoman ? -20 : -23}
            y="-6"
            width={isWoman ? 40 : 46}
            height={isWoman ? 20 : 22}
            rx="10"
            fill={shorts}
          />

          {/* Upper body hinge at hips */}
          <g className="rot-upper">
            <path
              d={
                isWoman
                  ? "M-16 2 C-18 -8, -16 -48, -14 -52 L14 -52 C16 -48, 18 -8, 16 2 Z"
                  : "M-19 2 C-21 -8, -19 -50, -16 -54 L16 -54 C19 -50, 21 -8, 19 2 Z"
              }
              fill="url(#yajCoachTop)"
            />
            {/* Collar */}
            <ellipse cx="0" cy={isWoman ? -50 : -52} rx="10" ry="4" fill={skin} opacity="0.35" />

            {/* LEFT ARM — hangs down from shoulder */}
            <g transform={`translate(${isWoman ? -16 : -18} ${isWoman ? -44 : -46})`}>
              <g className="rot-arm-l limb">
                <rect x="-6" y="0" width="12" height="26" rx="6" fill={skin} />
                <rect x="-7" y="-2" width="14" height="12" rx="5" fill={topDark} />
                <g transform="translate(0 24)">
                  <g className="rot-forearm-l limb">
                    <rect x="-5.5" y="0" width="11" height="24" rx="5.5" fill={skin} />
                    <circle cx="0" cy="26" r="4.8" fill={skin} />
                  </g>
                </g>
              </g>
            </g>

            {/* RIGHT ARM */}
            <g transform={`translate(${isWoman ? 16 : 18} ${isWoman ? -44 : -46})`}>
              <g className="rot-arm-r limb">
                <rect x="-6" y="0" width="12" height="26" rx="6" fill={skin} />
                <rect x="-7" y="-2" width="14" height="12" rx="5" fill={topDark} />
                <g transform="translate(0 24)">
                  <g className="rot-forearm-r limb">
                    <rect x="-5.5" y="0" width="11" height="24" rx="5.5" fill={skin} />
                    <circle cx="0" cy="26" r="4.8" fill={skin} />
                  </g>
                </g>
              </g>
            </g>

            {/* HEAD — all geometry stays at/above y=0 so bottom-center = neck joint */}
            <g transform={`translate(0 ${isWoman ? -52 : -54})`}>
              <g className="rot-head head">
                <rect x="-4" y="-10" width="8" height="10" rx="3" fill={skin} />
                {isWoman ? (
                  <path
                    d="M-15 -12 C-17 -34, 17 -34, 15 -12 C17 -4, 12 -1, 8 -1 L-8 -1 C-12 -1, -17 -4, -15 -12 Z"
                    fill={hair}
                  />
                ) : (
                  <>
                    <ellipse cx="0" cy="-24" rx="15" ry="10" fill={hair} />
                    <rect x="-15" y="-24" width="30" height="10" fill={hair} />
                  </>
                )}
                <circle cx="0" cy="-20" r={isWoman ? 13.5 : 14.5} fill={skin} />
                <circle cx="-4.2" cy="-21" r="1.25" fill="#44403c" opacity="0.45" />
                <circle cx="4.2" cy="-21" r="1.25" fill="#44403c" opacity="0.45" />
                <path
                  d="M-3.2 -15.5 Q0 -13.5 3.2 -15.5"
                  fill="none"
                  stroke="#44403c"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity="0.32"
                />
                {/* Explicit neck-base pivot so fill-box bottom = joint */}
                <circle cx="0" cy="0" r="1" fill={skin} />
              </g>
            </g>
          </g>
        </g>
      </g>

      <style>{coachCss()}</style>
    </svg>
  );
}

function coachCss(): string {
  return `
    /* Limbs hang downward from joint → rotate around top-center of bbox */
    .yaj-coach .limb {
      transform-box: fill-box;
      transform-origin: 50% 0%;
    }
    /* Head sits above neck joint → rotate around bottom-center */
    .yaj-coach .head {
      transform-box: fill-box;
      transform-origin: 50% 100%;
    }
    /* Hip hinge uses viewport origin — fill-box would include hanging arms and detach the torso */
    .yaj-coach .rot-upper {
      transform-box: view-box;
      transform-origin: 100px 148px;
    }

    /* Natural resting arm hang */
    .yaj-coach .rot-arm-l { transform: rotate(8deg); }
    .yaj-coach .rot-arm-r { transform: rotate(-8deg); }
    .yaj-coach .rot-forearm-l { transform: rotate(4deg); }
    .yaj-coach .rot-forearm-r { transform: rotate(-4deg); }

    /* Seated rest: thighs nearly horizontal, shins down */
    .yaj-coach--seated_march .rot-leg-l,
    .yaj-coach--seated_twist .rot-leg-l,
    .yaj-coach--ankle_circles .rot-leg-l,
    .yaj-coach--side_reach .rot-leg-l {
      transform: rotate(78deg);
    }
    .yaj-coach--seated_march .rot-leg-r,
    .yaj-coach--seated_twist .rot-leg-r,
    .yaj-coach--ankle_circles .rot-leg-r,
    .yaj-coach--side_reach .rot-leg-r {
      transform: rotate(-78deg);
    }
    .yaj-coach--seated_march .rot-shin-l,
    .yaj-coach--seated_twist .rot-shin-l,
    .yaj-coach--ankle_circles .rot-shin-l,
    .yaj-coach--side_reach .rot-shin-l {
      transform: rotate(-96deg);
    }
    .yaj-coach--seated_march .rot-shin-r,
    .yaj-coach--seated_twist .rot-shin-r,
    .yaj-coach--ankle_circles .rot-shin-r,
    .yaj-coach--side_reach .rot-shin-r {
      transform: rotate(96deg);
    }

    .yaj-coach--idle .rot-upper { animation: breath 4s ease-in-out infinite; }

    .yaj-coach--shoulders_roll .rot-arm-l { animation: shL 4s ease-in-out infinite; }
    .yaj-coach--shoulders_roll .rot-arm-r { animation: shR 4s ease-in-out infinite; }
    @keyframes shL {
      0%,100% { transform: rotate(12deg); }
      25% { transform: rotate(-6deg); }
      50% { transform: rotate(-32deg); }
      75% { transform: rotate(8deg); }
    }
    @keyframes shR {
      0%,100% { transform: rotate(-12deg); }
      25% { transform: rotate(6deg); }
      50% { transform: rotate(32deg); }
      75% { transform: rotate(-8deg); }
    }

    .yaj-coach--neck_left .rot-head { animation: neckL 4s ease-in-out infinite; }
    .yaj-coach--neck_right .rot-head { animation: neckR 4s ease-in-out infinite; }
    @keyframes neckL {
      0%,100% { transform: rotate(0deg); }
      35%,65% { transform: rotate(-22deg); }
    }
    @keyframes neckR {
      0%,100% { transform: rotate(0deg); }
      35%,65% { transform: rotate(22deg); }
    }

    .yaj-coach--arms_overhead .rot-arm-l,
    .yaj-coach--cool_stretch .rot-arm-l { animation: armsL 4.5s ease-in-out infinite; }
    .yaj-coach--arms_overhead .rot-arm-r,
    .yaj-coach--cool_stretch .rot-arm-r { animation: armsR 4.5s ease-in-out infinite; }
    @keyframes armsL {
      0%,100% { transform: rotate(10deg); }
      40%,60% { transform: rotate(-168deg); }
    }
    @keyframes armsR {
      0%,100% { transform: rotate(-10deg); }
      40%,60% { transform: rotate(168deg); }
    }

    .yaj-coach--forward_fold .rot-upper { animation: fold 5s ease-in-out infinite; }
    .yaj-coach--forward_fold .rot-leg-l,
    .yaj-coach--forward_fold .rot-leg-r { animation: foldKnee 5s ease-in-out infinite; }
    @keyframes fold {
      0%,100% { transform: rotate(0deg); }
      40%,60% { transform: rotate(68deg); }
    }
    @keyframes foldKnee {
      0%,100% { transform: rotate(0deg); }
      40%,60% { transform: rotate(8deg); }
    }

    .yaj-coach--hip_circles .rot-upper { animation: hips 4s ease-in-out infinite; }
    @keyframes hips {
      0% { transform: rotate(0deg) translate(0px, 0px); }
      25% { transform: rotate(5deg) translate(4px, 1px); }
      50% { transform: rotate(0deg) translate(0px, 3px); }
      75% { transform: rotate(-5deg) translate(-4px, 1px); }
      100% { transform: rotate(0deg) translate(0px, 0px); }
    }

    .yaj-coach--stand_tall .rot-upper { animation: breath 3.5s ease-in-out infinite; }
    @keyframes breath {
      0%,100% { transform: translate(0, 0); }
      50% { transform: translate(0, -2px); }
    }

    .yaj-coach--walk .rot-leg-l,
    .yaj-coach--march_place .rot-leg-l,
    .yaj-coach--cool_down .rot-leg-l { animation: wL 1.4s ease-in-out infinite; }
    .yaj-coach--walk .rot-leg-r,
    .yaj-coach--march_place .rot-leg-r,
    .yaj-coach--cool_down .rot-leg-r { animation: wR 1.4s ease-in-out infinite; }
    .yaj-coach--walk .rot-arm-l,
    .yaj-coach--march_place .rot-arm-l,
    .yaj-coach--arm_swing .rot-arm-l,
    .yaj-coach--cool_down .rot-arm-l { animation: aL 1.4s ease-in-out infinite; }
    .yaj-coach--walk .rot-arm-r,
    .yaj-coach--march_place .rot-arm-r,
    .yaj-coach--arm_swing .rot-arm-r,
    .yaj-coach--cool_down .rot-arm-r { animation: aR 1.4s ease-in-out infinite; }
    .yaj-coach--brisk_walk .rot-leg-l { animation: wL 0.95s ease-in-out infinite; }
    .yaj-coach--brisk_walk .rot-leg-r { animation: wR 0.95s ease-in-out infinite; }
    .yaj-coach--brisk_walk .rot-arm-l { animation: aL 0.95s ease-in-out infinite; }
    .yaj-coach--brisk_walk .rot-arm-r { animation: aR 0.95s ease-in-out infinite; }
    .yaj-coach--cool_down .rot-leg-l,
    .yaj-coach--cool_down .rot-leg-r,
    .yaj-coach--cool_down .rot-arm-l,
    .yaj-coach--cool_down .rot-arm-r { animation-duration: 1.95s; }
    @keyframes wL { 0%,100% { transform: rotate(16deg); } 50% { transform: rotate(-16deg); } }
    @keyframes wR { 0%,100% { transform: rotate(-16deg); } 50% { transform: rotate(16deg); } }
    @keyframes aL { 0%,100% { transform: rotate(-18deg); } 50% { transform: rotate(16deg); } }
    @keyframes aR { 0%,100% { transform: rotate(18deg); } 50% { transform: rotate(-16deg); } }

    .yaj-coach--seated_march .rot-leg-l { animation: sL 1.55s ease-in-out infinite; }
    .yaj-coach--seated_march .rot-leg-r { animation: sR 1.55s ease-in-out infinite; }
    @keyframes sL {
      0%,100% { transform: rotate(78deg); }
      50% { transform: rotate(28deg); }
    }
    @keyframes sR {
      0%,100% { transform: rotate(-78deg); }
      50% { transform: rotate(-28deg); }
    }

    .yaj-coach--seated_twist .rot-upper { animation: twist 4s ease-in-out infinite; }
    .yaj-coach--seated_twist .rot-arm-l { transform: rotate(55deg); }
    .yaj-coach--seated_twist .rot-arm-r { transform: rotate(-55deg); }
    @keyframes twist {
      0%,100% { transform: rotate(0deg); }
      25% { transform: rotate(-14deg); }
      75% { transform: rotate(14deg); }
    }

    .yaj-coach--ankle_circles .rot-shin-r { animation: ankle 2.5s ease-in-out infinite; }
    .yaj-coach--ankle_circles .rot-leg-r { transform: rotate(-40deg); }
    @keyframes ankle {
      0% { transform: rotate(96deg); }
      25% { transform: rotate(116deg); }
      50% { transform: rotate(96deg); }
      75% { transform: rotate(76deg); }
      100% { transform: rotate(96deg); }
    }

    .yaj-coach--side_reach .rot-arm-r { animation: sideArm 4s ease-in-out infinite; }
    .yaj-coach--side_reach .rot-upper { animation: sideBody 4s ease-in-out infinite; }
    @keyframes sideArm {
      0%,45%,100% { transform: rotate(-8deg); }
      20%,30% { transform: rotate(155deg); }
    }
    @keyframes sideBody {
      0%,45%,100% { transform: rotate(0deg); }
      20%,30% { transform: rotate(9deg); }
    }

    .yaj-coach--sit_to_stand .rot-upper { animation: stsU 4s ease-in-out infinite; }
    .yaj-coach--sit_to_stand .rot-leg-l,
    .yaj-coach--sit_to_stand .rot-leg-r { animation: stsL 4s ease-in-out infinite; }
    .yaj-coach--sit_to_stand .rot-shin-l { animation: stsShinL 4s ease-in-out infinite; }
    .yaj-coach--sit_to_stand .rot-shin-r { animation: stsShinR 4s ease-in-out infinite; }
    @keyframes stsU {
      0%,22% { transform: translate(0, 10px) rotate(5deg); }
      50%,60% { transform: translate(0, -4px) rotate(0deg); }
      82%,100% { transform: translate(0, 10px) rotate(5deg); }
    }
    @keyframes stsL {
      0%,22% { transform: rotate(70deg); }
      50%,60% { transform: rotate(6deg); }
      82%,100% { transform: rotate(70deg); }
    }
    @keyframes stsShinL {
      0%,22% { transform: rotate(-95deg); }
      50%,60% { transform: rotate(-6deg); }
      82%,100% { transform: rotate(-95deg); }
    }
    @keyframes stsShinR {
      0%,22% { transform: rotate(95deg); }
      50%,60% { transform: rotate(6deg); }
      82%,100% { transform: rotate(95deg); }
    }

    .yaj-coach--wall_pushup .rot-upper { animation: pushU 3s ease-in-out infinite; }
    .yaj-coach--wall_pushup .rot-arm-l,
    .yaj-coach--wall_pushup .rot-arm-r { animation: pushA 3s ease-in-out infinite; }
    .yaj-coach--wall_pushup .rot-forearm-l,
    .yaj-coach--wall_pushup .rot-forearm-r { transform: rotate(-8deg); }
    @keyframes pushU {
      0%,100% { transform: translate(0,0) rotate(0deg); }
      50% { transform: translate(10px,0) rotate(7deg); }
    }
    @keyframes pushA {
      0%,100% { transform: rotate(-88deg); }
      50% { transform: rotate(-108deg); }
    }

    .yaj-coach--squat .rot-upper { animation: squatU 3.2s ease-in-out infinite; }
    .yaj-coach--squat .rot-leg-l,
    .yaj-coach--squat .rot-leg-r { animation: squatL 3.2s ease-in-out infinite; }
    .yaj-coach--squat .rot-shin-l { animation: squatShinL 3.2s ease-in-out infinite; }
    .yaj-coach--squat .rot-shin-r { animation: squatShinR 3.2s ease-in-out infinite; }
    .yaj-coach--squat .rot-arm-l { transform: rotate(20deg); }
    .yaj-coach--squat .rot-arm-r { transform: rotate(-20deg); }
    @keyframes squatU {
      0%,100% { transform: translate(0,0); }
      50% { transform: translate(0, 16px); }
    }
    @keyframes squatL {
      0%,100% { transform: rotate(6deg); }
      50% { transform: rotate(42deg); }
    }
    @keyframes squatShinL {
      0%,100% { transform: rotate(-4deg); }
      50% { transform: rotate(-48deg); }
    }
    @keyframes squatShinR {
      0%,100% { transform: rotate(4deg); }
      50% { transform: rotate(48deg); }
    }

    .yaj-coach--side_steps { animation: sideStep 2.8s ease-in-out infinite; }
    .yaj-coach--side_steps .rot-leg-l { animation: sideLegL 2.8s ease-in-out infinite; }
    .yaj-coach--side_steps .rot-leg-r { animation: sideLegR 2.8s ease-in-out infinite; }
    @keyframes sideStep {
      0%,100% { transform: translateX(0); }
      25% { transform: translateX(11px); }
      75% { transform: translateX(-11px); }
    }
    @keyframes sideLegL {
      0%,100% { transform: rotate(4deg); }
      25% { transform: rotate(14deg); }
      75% { transform: rotate(-6deg); }
    }
    @keyframes sideLegR {
      0%,100% { transform: rotate(-4deg); }
      25% { transform: rotate(6deg); }
      75% { transform: rotate(-14deg); }
    }
  `;
}
