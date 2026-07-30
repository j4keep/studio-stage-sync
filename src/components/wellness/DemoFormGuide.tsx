import type { DemoGuideKind } from "@/lib/wellness-demos";
import type { WellnessFigure } from "@/lib/wellness";

type Props = {
  guide: DemoGuideKind;
  setting?: "studio" | "park";
  title?: string;
  playing?: boolean;
  /** Woman / man illustration so the card reflects the user’s profile. */
  figure?: WellnessFigure;
  /** Hold cue shown on the card (e.g. “5 sec”). */
  holdSeconds?: number;
};

/** Inclusive mid-tone for illustration skin — not coded to one ethnicity. */
const SKIN = "#9a7b5f";
const SKIN_SHADOW = "#7d634c";

/**
 * Instructional stretch/move cards (stock-illustration style) with motion arrows.
 * Gender presentation follows the user’s wellness profile.
 */
export default function DemoFormGuide({
  guide,
  setting = "studio",
  title,
  playing = true,
  figure = "woman",
  holdSeconds,
}: Props) {
  const bg =
    setting === "park"
      ? "from-[#b7d4b0] via-[#dce9d4] to-[#eef4e8]"
      : "from-[#d9e8e4] via-[#e8f2ef] to-[#f3f7f5]";

  const holdLabel =
    holdSeconds && holdSeconds > 0
      ? holdSeconds >= 60
        ? `${Math.round(holdSeconds / 60)} min`
        : `${holdSeconds} sec`
      : null;

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-b ${bg}`}
      data-playing={playing ? "1" : "0"}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.65),_transparent_70%)]"
      />
      {setting === "park" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#8faf7a]/35 to-transparent"
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 bottom-10 h-2 rounded-full bg-stone-900/10 blur-[1px]"
        />
      )}

      {holdLabel ? (
        <span className="absolute right-3 top-3 z-[2] rounded-full bg-sky-500/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
          {holdLabel}
        </span>
      ) : null}

      <div
        className="relative z-[1] w-[78%] max-w-[240px]"
        style={{ animationPlayState: playing ? "running" : "paused" }}
      >
        <GuideSilhouette guide={guide} playing={playing} figure={figure} />
        <MotionArrows guide={guide} />
      </div>

      {title ? (
        <p className="relative z-[1] mt-3 max-w-[85%] text-center text-[11px] font-bold uppercase tracking-[0.12em] text-teal-900/75">
          {title}
        </p>
      ) : null}

      <style>{GUIDE_CSS}</style>
    </div>
  );
}

function MotionArrows({ guide }: { guide: DemoGuideKind }) {
  // Simple directional cues like the neck-stretch stock cards
  if (guide === "neck_tilt") {
    return (
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 200 320" aria-hidden>
        <path d="M48 70 Q30 58 42 42" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M36 46 L42 40 L48 48" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M152 70 Q170 58 158 42" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M164 46 L158 40 L152 48" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (guide === "shoulders_roll" || guide === "hip_circles" || guide === "ankle_circles") {
    return (
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 200 320" aria-hidden>
        <path
          d="M150 100 A28 28 0 1 1 148 95"
          fill="none"
          stroke="#f87171"
          strokeWidth="3"
          strokeLinecap="round"
          markerEnd="url(#yajArrow)"
        />
        <defs>
          <marker id="yajArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 Z" fill="#f87171" />
          </marker>
        </defs>
      </svg>
    );
  }
  if (guide === "arms_overhead" || guide === "cool_stretch" || guide === "side_reach") {
    return (
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 200 320" aria-hidden>
        <path d="M100 120 L100 48" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M92 58 L100 46 L108 58" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (guide === "forward_fold") {
    return (
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 200 320" aria-hidden>
        <path d="M130 90 Q150 140 120 200" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M114 188 L120 202 L132 194" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

function GuideSilhouette({
  guide,
  playing,
  figure,
}: {
  guide: DemoGuideKind;
  playing: boolean;
  figure: WellnessFigure;
}) {
  const anim = playing ? guide : "paused";
  const isWoman = figure === "woman";
  const kit = isWoman ? "#e07a5f" : "#3d8b8b";
  const kitDark = isWoman ? "#c45f48" : "#2f6f6f";
  const pant = "#2a2a2a";

  return (
    <svg viewBox="0 0 200 320" className="h-auto w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="yajKit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={kit} />
          <stop offset="100%" stopColor={kitDark} />
        </linearGradient>
      </defs>

      {(guide.startsWith("seated") ||
        guide === "ankle_circles" ||
        guide === "side_reach" ||
        guide === "sit_to_stand") && (
        <g opacity="0.35">
          <rect x="55" y="175" width="90" height="10" rx="2" fill="#5a6b66" />
          <rect x="62" y="185" width="8" height="55" rx="2" fill="#5a6b66" />
          <rect x="130" y="185" width="8" height="55" rx="2" fill="#5a6b66" />
          <rect x="70" y="120" width="8" height="55" rx="2" fill="#5a6b66" />
          <rect x="122" y="120" width="8" height="55" rx="2" fill="#5a6b66" />
        </g>
      )}

      {guide === "wall_pushup" ? (
        <rect x="168" y="40" width="10" height="220" rx="2" fill="#7a8f88" opacity="0.35" />
      ) : null}

      <g className={`yaj-guide yaj-guide--${anim}`}>
        {/* Hair — woman: soft shoulder length; man: short crop */}
        {isWoman ? (
          <path
            d="M78 52 C76 28, 124 28, 122 52 C128 78, 126 96, 118 102 C112 88, 88 88, 82 102 C74 96, 72 78, 78 52 Z"
            fill="#3f3a36"
          />
        ) : (
          <ellipse cx="100" cy="48" rx="20" ry="14" fill="#3f3a36" />
        )}

        <circle className="yaj-head" cx="100" cy={isWoman ? 60 : 58} r={isWoman ? 17 : 18} fill={SKIN} />
        <ellipse cx="100" cy={isWoman ? 64 : 62} rx="7" ry="3" fill={SKIN_SHADOW} opacity="0.25" />

        {/* Torso — woman slightly narrower; man broader shoulders */}
        <path
          className="yaj-torso"
          d={
            isWoman
              ? "M82 88 C82 80, 118 80, 118 88 L122 152 C122 160, 78 160, 78 152 Z"
              : "M74 86 C74 78, 126 78, 126 86 L130 155 C130 162, 70 162, 70 155 Z"
          }
          fill="url(#yajKit)"
        />

        <path
          className="yaj-arm-l"
          d={isWoman ? "M84 94 C64 102, 52 122, 56 148" : "M78 92 C58 100, 46 120, 50 145"}
          fill="none"
          stroke={SKIN}
          strokeWidth={isWoman ? 11 : 13}
          strokeLinecap="round"
        />
        <path
          className="yaj-arm-r"
          d={isWoman ? "M116 94 C136 102, 148 122, 144 148" : "M122 92 C142 100, 154 120, 150 145"}
          fill="none"
          stroke={SKIN}
          strokeWidth={isWoman ? 11 : 13}
          strokeLinecap="round"
        />

        {/* Shorts / pants */}
        <path
          d={
            isWoman
              ? "M80 150 L120 150 L118 178 L82 178 Z"
              : "M74 152 L126 152 L124 182 L76 182 Z"
          }
          fill={pant}
        />

        <path
          className="yaj-leg-l"
          d="M90 176 C86 210, 82 240, 80 268"
          fill="none"
          stroke={SKIN}
          strokeWidth={isWoman ? 12 : 14}
          strokeLinecap="round"
        />
        <path
          className="yaj-leg-r"
          d="M110 176 C114 210, 118 240, 120 268"
          fill="none"
          stroke={SKIN}
          strokeWidth={isWoman ? 12 : 14}
          strokeLinecap="round"
        />

        <ellipse className="yaj-foot-l" cx="76" cy="275" rx="13" ry="5" fill="#222" />
        <ellipse className="yaj-foot-r" cx="124" cy="275" rx="13" ry="5" fill="#222" />
      </g>
    </svg>
  );
}

const GUIDE_CSS = `
  .yaj-guide { transform-box: fill-box; transform-origin: 100px 200px; }
  .yaj-head, .yaj-torso, .yaj-arm-l, .yaj-arm-r, .yaj-leg-l, .yaj-leg-r, .yaj-foot-l, .yaj-foot-r {
    transform-box: fill-box;
    transform-origin: center;
  }
  .yaj-arm-l { transform-origin: 80px 92px; }
  .yaj-arm-r { transform-origin: 120px 92px; }
  .yaj-leg-l { transform-origin: 86px 155px; }
  .yaj-leg-r { transform-origin: 114px 155px; }
  .yaj-head { transform-origin: 100px 58px; }
  .yaj-torso { transform-origin: 100px 120px; }

  .yaj-guide--shoulders_roll .yaj-arm-l { animation: yajShoulderL 3.2s ease-in-out infinite; }
  .yaj-guide--shoulders_roll .yaj-arm-r { animation: yajShoulderR 3.2s ease-in-out infinite; }
  @keyframes yajShoulderL {
    0%,100% { transform: translate(0,0) rotate(0deg); }
    50% { transform: translate(2px,-6px) rotate(-12deg); }
  }
  @keyframes yajShoulderR {
    0%,100% { transform: translate(0,0) rotate(0deg); }
    50% { transform: translate(-2px,-6px) rotate(12deg); }
  }

  .yaj-guide--neck_tilt .yaj-head { animation: yajNeck 4.5s ease-in-out infinite; }
  @keyframes yajNeck {
    0%,100% { transform: rotate(0deg); }
    25% { transform: rotate(-18deg); }
    50% { transform: rotate(0deg); }
    75% { transform: rotate(18deg); }
  }

  .yaj-guide--arms_overhead .yaj-arm-l { animation: yajArmsUpL 4s ease-in-out infinite; }
  .yaj-guide--arms_overhead .yaj-arm-r { animation: yajArmsUpR 4s ease-in-out infinite; }
  @keyframes yajArmsUpL {
    0%,100% { transform: rotate(0deg); }
    45%,55% { transform: rotate(-150deg) translate(-4px,-8px); }
  }
  @keyframes yajArmsUpR {
    0%,100% { transform: rotate(0deg); }
    45%,55% { transform: rotate(150deg) translate(4px,-8px); }
  }

  .yaj-guide--forward_fold { animation: yajFold 5s ease-in-out infinite; }
  .yaj-guide--forward_fold .yaj-arm-l { animation: yajFoldArms 5s ease-in-out infinite; }
  .yaj-guide--forward_fold .yaj-arm-r { animation: yajFoldArmsR 5s ease-in-out infinite; }
  @keyframes yajFold {
    0%,100% { transform: rotate(0deg) translateY(0); }
    40%,60% { transform: rotate(0deg) translateY(10px) scaleY(0.92); }
  }
  @keyframes yajFoldArms {
    0%,100% { transform: rotate(0deg); }
    40%,60% { transform: rotate(55deg) translateY(20px); }
  }
  @keyframes yajFoldArmsR {
    0%,100% { transform: rotate(0deg); }
    40%,60% { transform: rotate(-55deg) translateY(20px); }
  }

  .yaj-guide--hip_circles { animation: yajHips 3.6s ease-in-out infinite; }
  @keyframes yajHips {
    0% { transform: translate(0,0) rotate(0deg); }
    25% { transform: translate(8px,2px) rotate(3deg); }
    50% { transform: translate(0,4px) rotate(0deg); }
    75% { transform: translate(-8px,2px) rotate(-3deg); }
    100% { transform: translate(0,0) rotate(0deg); }
  }

  .yaj-guide--stand_tall .yaj-torso { animation: yajStand 3.5s ease-in-out infinite; }
  @keyframes yajStand {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  .yaj-guide--walk .yaj-leg-l,
  .yaj-guide--march_place .yaj-leg-l,
  .yaj-guide--cool_down_walk .yaj-leg-l { animation: yajWalkL 1.4s ease-in-out infinite; }
  .yaj-guide--walk .yaj-leg-r,
  .yaj-guide--march_place .yaj-leg-r,
  .yaj-guide--cool_down_walk .yaj-leg-r { animation: yajWalkR 1.4s ease-in-out infinite; }
  .yaj-guide--walk .yaj-arm-l,
  .yaj-guide--march_place .yaj-arm-l,
  .yaj-guide--cool_down_walk .yaj-arm-l { animation: yajWalkArmL 1.4s ease-in-out infinite; }
  .yaj-guide--walk .yaj-arm-r,
  .yaj-guide--march_place .yaj-arm-r,
  .yaj-guide--cool_down_walk .yaj-arm-r { animation: yajWalkArmR 1.4s ease-in-out infinite; }
  .yaj-guide--brisk_walk .yaj-leg-l { animation: yajWalkL 0.85s ease-in-out infinite; }
  .yaj-guide--brisk_walk .yaj-leg-r { animation: yajWalkR 0.85s ease-in-out infinite; }
  .yaj-guide--brisk_walk .yaj-arm-l { animation: yajWalkArmL 0.85s ease-in-out infinite; }
  .yaj-guide--brisk_walk .yaj-arm-r { animation: yajWalkArmR 0.85s ease-in-out infinite; }
  .yaj-guide--cool_down_walk .yaj-leg-l,
  .yaj-guide--cool_down_walk .yaj-leg-r,
  .yaj-guide--cool_down_walk .yaj-arm-l,
  .yaj-guide--cool_down_walk .yaj-arm-r { animation-duration: 2s; }
  @keyframes yajWalkL {
    0%,100% { transform: rotate(12deg); }
    50% { transform: rotate(-14deg); }
  }
  @keyframes yajWalkR {
    0%,100% { transform: rotate(-12deg); }
    50% { transform: rotate(14deg); }
  }
  @keyframes yajWalkArmL {
    0%,100% { transform: rotate(-18deg); }
    50% { transform: rotate(16deg); }
  }
  @keyframes yajWalkArmR {
    0%,100% { transform: rotate(18deg); }
    50% { transform: rotate(-16deg); }
  }

  .yaj-guide--arm_swing .yaj-arm-l { animation: yajWalkArmL 1.5s ease-in-out infinite; }
  .yaj-guide--arm_swing .yaj-arm-r { animation: yajWalkArmR 1.5s ease-in-out infinite; }

  .yaj-guide--seated_march .yaj-leg-l { animation: yajSeatMarchL 1.6s ease-in-out infinite; }
  .yaj-guide--seated_march .yaj-leg-r { animation: yajSeatMarchR 1.6s ease-in-out infinite; }
  @keyframes yajSeatMarchL {
    0%,100% { transform: rotate(0deg) translateY(0); }
    50% { transform: rotate(-8deg) translateY(-18px); }
  }
  @keyframes yajSeatMarchR {
    0%,100% { transform: rotate(0deg) translateY(0); }
    50% { transform: rotate(8deg) translateY(-18px); }
  }

  .yaj-guide--seated_twist .yaj-torso,
  .yaj-guide--seated_twist .yaj-arm-l,
  .yaj-guide--seated_twist .yaj-arm-r,
  .yaj-guide--seated_twist .yaj-head { animation: yajTwist 3.8s ease-in-out infinite; }
  @keyframes yajTwist {
    0%,100% { transform: rotate(0deg); }
    25% { transform: rotate(-12deg); }
    75% { transform: rotate(12deg); }
  }

  .yaj-guide--ankle_circles .yaj-foot-r { animation: yajAnkle 2.4s ease-in-out infinite; }
  .yaj-guide--ankle_circles .yaj-leg-r { animation: yajAnkleLeg 2.4s ease-in-out infinite; }
  @keyframes yajAnkle {
    0% { transform: translate(0,0); }
    25% { transform: translate(6px,-2px); }
    50% { transform: translate(0,3px); }
    75% { transform: translate(-6px,-2px); }
    100% { transform: translate(0,0); }
  }
  @keyframes yajAnkleLeg {
    0%,100% { transform: rotate(0deg); }
    50% { transform: rotate(6deg); }
  }

  .yaj-guide--side_reach .yaj-arm-r { animation: yajSideR 4s ease-in-out infinite; }
  .yaj-guide--side_reach .yaj-torso { animation: yajSideTorso 4s ease-in-out infinite; }
  .yaj-guide--side_reach .yaj-arm-l { animation: yajSideL 4s ease-in-out infinite; }
  @keyframes yajSideR {
    0%,45%,100% { transform: rotate(0deg); }
    20%,30% { transform: rotate(145deg) translate(4px,-10px); }
  }
  @keyframes yajSideL {
    0%,55% { transform: rotate(0deg); }
    70%,80% { transform: rotate(-145deg) translate(-4px,-10px); }
    100% { transform: rotate(0deg); }
  }
  @keyframes yajSideTorso {
    0%,45%,55%,100% { transform: rotate(0deg); }
    20%,30% { transform: rotate(8deg); }
    70%,80% { transform: rotate(-8deg); }
  }

  .yaj-guide--sit_to_stand { animation: yajSitStand 4.2s ease-in-out infinite; }
  @keyframes yajSitStand {
    0%,20% { transform: translateY(28px) scaleY(0.92); }
    45%,55% { transform: translateY(0) scaleY(1); }
    80%,100% { transform: translateY(28px) scaleY(0.92); }
  }

  .yaj-guide--wall_pushup { animation: yajPush 3.2s ease-in-out infinite; transform-origin: 160px 160px; }
  .yaj-guide--wall_pushup .yaj-arm-l,
  .yaj-guide--wall_pushup .yaj-arm-r { animation: yajPushArms 3.2s ease-in-out infinite; }
  @keyframes yajPush {
    0%,100% { transform: translateX(0) rotate(0deg); }
    50% { transform: translateX(14px) rotate(4deg); }
  }
  @keyframes yajPushArms {
    0%,100% { transform: rotate(0deg); }
    50% { transform: rotate(-8deg); }
  }

  .yaj-guide--squat { animation: yajSquat 3.4s ease-in-out infinite; }
  .yaj-guide--squat .yaj-arm-l { animation: yajSquatArms 3.4s ease-in-out infinite; }
  .yaj-guide--squat .yaj-arm-r { animation: yajSquatArmsR 3.4s ease-in-out infinite; }
  @keyframes yajSquat {
    0%,100% { transform: translateY(0) scaleY(1); }
    50% { transform: translateY(18px) scaleY(0.9); }
  }
  @keyframes yajSquatArms {
    0%,100% { transform: rotate(0deg); }
    50% { transform: rotate(25deg); }
  }
  @keyframes yajSquatArmsR {
    0%,100% { transform: rotate(0deg); }
    50% { transform: rotate(-25deg); }
  }

  .yaj-guide--side_steps { animation: yajSideStep 2.8s ease-in-out infinite; }
  @keyframes yajSideStep {
    0%,100% { transform: translateX(0); }
    25% { transform: translateX(16px); }
    75% { transform: translateX(-16px); }
  }

  .yaj-guide--cool_stretch .yaj-arm-l { animation: yajArmsUpL 5s ease-in-out infinite; }
  .yaj-guide--cool_stretch .yaj-arm-r { animation: yajArmsUpR 5s ease-in-out infinite; }
  .yaj-guide--cool_stretch { animation: yajCool 5s ease-in-out infinite; }
  @keyframes yajCool {
    0%,40% { transform: translateY(0); }
    70%,85% { transform: translateY(8px) scaleY(0.94); }
    100% { transform: translateY(0); }
  }

  .yaj-guide--breathe_calm .yaj-torso { animation: yajBreathe 4.5s ease-in-out infinite; }
  .yaj-guide--breathe_calm .yaj-arm-l,
  .yaj-guide--breathe_calm .yaj-arm-r { animation: yajBreatheArms 4.5s ease-in-out infinite; }
  @keyframes yajBreathe {
    0%,100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  @keyframes yajBreatheArms {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  .yaj-guide--paused * { animation-play-state: paused !important; }
`;
