import type { MoveIllustrationId } from "@/lib/wellness-move-coach";
import type { WellnessFigure } from "@/lib/wellness";

type Props = {
  illustration: MoveIllustrationId;
  title: string;
  stepNumber: number;
  totalSteps: number;
  figure?: WellnessFigure;
  /** Hold countdown remaining (shows big number). */
  holdLeft?: number | null;
  caption?: string;
  animating?: boolean;
};

const SKIN = "#a8896c";
const HAIR = "#2f2a26";

/**
 * Animated instructional card — clean vector figure loops the move
 * while YAJ narrates. Not a stock video; pose matches the step.
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
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-600">
          {figure === "man" ? "Form guide" : "Form guide"}
        </span>
      </div>
      <h2 className="px-4 text-center text-lg font-black tracking-tight text-stone-900">{title}</h2>

      <div className="relative mx-auto my-2 flex aspect-square w-[88%] max-w-[280px] items-center justify-center rounded-2xl bg-gradient-to-b from-[#eef6f3] to-[#f7faf8]">
        <AnimatedFigure kind={illustration} figure={figure} playing={animating} />
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
      <style>{FIGURE_CSS}</style>
    </div>
  );
}

function AnimatedFigure({
  kind,
  figure,
  playing,
}: {
  kind: MoveIllustrationId;
  figure: WellnessFigure;
  playing: boolean;
}) {
  const isWoman = figure === "woman";
  const top = isWoman ? "#e07a5f" : "#3d8b8b";
  const animClass = playing ? `yaj-move yaj-move--${kind}` : "yaj-move yaj-move--paused";

  return (
    <svg viewBox="0 0 200 240" className="h-[92%] w-auto" aria-hidden>
      {/* Directional arrows for key stretches */}
      {(kind === "neck_left" || kind === "neck_right") && (
        <g stroke="#38bdf8" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
          {kind === "neck_left" ? (
            <>
              <path d="M48 70 Q32 58 42 42" />
              <path d="M34 48 L42 40 L48 50" />
            </>
          ) : (
            <>
              <path d="M152 70 Q168 58 158 42" />
              <path d="M152 50 L158 40 L166 48" />
            </>
          )}
        </g>
      )}
      {(kind === "arms_overhead" || kind === "cool_stretch") && (
        <g stroke="#38bdf8" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
          <path d="M100 110 L100 48" />
          <path d="M92 58 L100 46 L108 58" />
        </g>
      )}
      {kind === "forward_fold" && (
        <g stroke="#38bdf8" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
          <path d="M132 90 Q152 140 118 190" />
          <path d="M112 178 L118 192 L130 184" />
        </g>
      )}

      {(kind.startsWith("seated") || kind === "ankle_circles" || kind === "side_reach" || kind === "sit_to_stand") && (
        <g opacity="0.35">
          <rect x="55" y="135" width="90" height="9" rx="2" fill="#5a6b66" />
          <rect x="62" y="144" width="7" height="48" rx="2" fill="#5a6b66" />
          <rect x="131" y="144" width="7" height="48" rx="2" fill="#5a6b66" />
        </g>
      )}
      {kind === "wall_pushup" && <rect x="168" y="30" width="10" height="170" rx="2" fill="#7a8f88" opacity="0.4" />}

      {/* Entire figure is one group — animations never detach limbs from the body */}
      <g className={animClass}>
        <g className="yaj-body">
          {/* Legs */}
          <path
            className="yaj-leg-l"
            d="M88 128 C84 160, 80 190, 78 215"
            fill="none"
            stroke={SKIN}
            strokeWidth={isWoman ? 11 : 13}
            strokeLinecap="round"
          />
          <path
            className="yaj-leg-r"
            d="M112 128 C116 160, 120 190, 122 215"
            fill="none"
            stroke={SKIN}
            strokeWidth={isWoman ? 11 : 13}
            strokeLinecap="round"
          />
          <ellipse cx="74" cy="218" rx="12" ry="4.5" fill="#222" />
          <ellipse cx="126" cy="218" rx="12" ry="4.5" fill="#222" />
          <path
            d={isWoman ? "M82 122 L118 122 L116 138 L84 138 Z" : "M78 122 L122 122 L120 140 L80 140 Z"}
            fill="#2b2b2b"
          />

          {/* Torso */}
          <path
            d={
              isWoman
                ? "M84 68 C84 58, 116 58, 116 68 L120 122 C120 130, 80 130, 80 122 Z"
                : "M78 66 C78 56, 122 56, 122 66 L126 122 C126 130, 74 130, 74 122 Z"
            }
            fill={top}
          />

          {/* Arms attached at shoulders */}
          <path
            className="yaj-arm-l"
            d={isWoman ? "M88 76 C68 88, 56 110, 58 132" : "M84 74 C62 86, 50 108, 52 132"}
            fill="none"
            stroke={SKIN}
            strokeWidth={isWoman ? 10 : 12}
            strokeLinecap="round"
          />
          <path
            className="yaj-arm-r"
            d={isWoman ? "M112 76 C132 88, 144 110, 142 132" : "M116 74 C138 86, 150 108, 148 132"}
            fill="none"
            stroke={SKIN}
            strokeWidth={isWoman ? 10 : 12}
            strokeLinecap="round"
          />

          {/* Head + hair — child of body so neck tilts stay attached */}
          <g className="yaj-head">
            {isWoman ? (
              <path
                d="M78 52 C76 28, 124 28, 122 52 C128 72, 124 88, 116 92 C110 78, 90 78, 84 92 C76 88, 72 72, 78 52 Z"
                fill={HAIR}
              />
            ) : (
              <>
                <ellipse cx="100" cy="44" rx="18" ry="12" fill={HAIR} />
                <rect x="82" y="44" width="36" height="10" fill={HAIR} />
              </>
            )}
            <rect x="95" y="58" width="10" height="10" rx="2" fill={SKIN} />
            <circle cx="100" cy={isWoman ? 50 : 48} r={isWoman ? 16 : 17} fill={SKIN} />
          </g>
        </g>
      </g>
    </svg>
  );
}

const FIGURE_CSS = `
  .yaj-move .yaj-body { transform-box: fill-box; transform-origin: 100px 140px; }
  .yaj-move .yaj-head { transform-box: fill-box; transform-origin: 100px 58px; }
  .yaj-move .yaj-arm-l { transform-box: fill-box; transform-origin: 88px 76px; }
  .yaj-move .yaj-arm-r { transform-box: fill-box; transform-origin: 112px 76px; }
  .yaj-move .yaj-leg-l { transform-box: fill-box; transform-origin: 88px 128px; }
  .yaj-move .yaj-leg-r { transform-box: fill-box; transform-origin: 112px 128px; }

  .yaj-move--shoulders_roll .yaj-arm-l { animation: shL 2.8s ease-in-out infinite; }
  .yaj-move--shoulders_roll .yaj-arm-r { animation: shR 2.8s ease-in-out infinite; }
  @keyframes shL {
    0%,100% { transform: translate(0,0) rotate(0deg); }
    50% { transform: translate(2px,-8px) rotate(-14deg); }
  }
  @keyframes shR {
    0%,100% { transform: translate(0,0) rotate(0deg); }
    50% { transform: translate(-2px,-8px) rotate(14deg); }
  }

  .yaj-move--neck_left .yaj-head { animation: nL 3.2s ease-in-out infinite; }
  .yaj-move--neck_right .yaj-head { animation: nR 3.2s ease-in-out infinite; }
  @keyframes nL {
    0%,100% { transform: rotate(0deg); }
    40%,60% { transform: rotate(-22deg); }
  }
  @keyframes nR {
    0%,100% { transform: rotate(0deg); }
    40%,60% { transform: rotate(22deg); }
  }

  .yaj-move--arms_overhead .yaj-arm-l,
  .yaj-move--cool_stretch .yaj-arm-l { animation: armUpL 4s ease-in-out infinite; }
  .yaj-move--arms_overhead .yaj-arm-r,
  .yaj-move--cool_stretch .yaj-arm-r { animation: armUpR 4s ease-in-out infinite; }
  @keyframes armUpL {
    0%,100% { transform: rotate(0deg); }
    45%,55% { transform: rotate(-145deg) translate(-2px,-6px); }
  }
  @keyframes armUpR {
    0%,100% { transform: rotate(0deg); }
    45%,55% { transform: rotate(145deg) translate(2px,-6px); }
  }

  .yaj-move--forward_fold .yaj-body { animation: fold 4.5s ease-in-out infinite; }
  @keyframes fold {
    0%,100% { transform: translateY(0) scaleY(1); }
    45%,55% { transform: translateY(10px) scaleY(0.9); }
  }
  .yaj-move--forward_fold .yaj-arm-l { animation: foldAL 4.5s ease-in-out infinite; }
  .yaj-move--forward_fold .yaj-arm-r { animation: foldAR 4.5s ease-in-out infinite; }
  @keyframes foldAL {
    0%,100% { transform: rotate(0deg); }
    45%,55% { transform: rotate(50deg) translateY(12px); }
  }
  @keyframes foldAR {
    0%,100% { transform: rotate(0deg); }
    45%,55% { transform: rotate(-50deg) translateY(12px); }
  }

  .yaj-move--hip_circles .yaj-body { animation: hips 3.4s ease-in-out infinite; }
  @keyframes hips {
    0% { transform: translate(0,0); }
    25% { transform: translate(8px,2px); }
    50% { transform: translate(0,4px); }
    75% { transform: translate(-8px,2px); }
    100% { transform: translate(0,0); }
  }

  .yaj-move--stand_tall .yaj-body { animation: stand 3s ease-in-out infinite; }
  @keyframes stand {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  .yaj-move--walk .yaj-leg-l,
  .yaj-move--march_place .yaj-leg-l,
  .yaj-move--cool_down .yaj-leg-l,
  .yaj-move--brisk_walk .yaj-leg-l { animation: wL 1.2s ease-in-out infinite; }
  .yaj-move--walk .yaj-leg-r,
  .yaj-move--march_place .yaj-leg-r,
  .yaj-move--cool_down .yaj-leg-r,
  .yaj-move--brisk_walk .yaj-leg-r { animation: wR 1.2s ease-in-out infinite; }
  .yaj-move--walk .yaj-arm-l,
  .yaj-move--march_place .yaj-arm-l,
  .yaj-move--arm_swing .yaj-arm-l,
  .yaj-move--brisk_walk .yaj-arm-l { animation: aL 1.2s ease-in-out infinite; }
  .yaj-move--walk .yaj-arm-r,
  .yaj-move--march_place .yaj-arm-r,
  .yaj-move--arm_swing .yaj-arm-r,
  .yaj-move--brisk_walk .yaj-arm-r { animation: aR 1.2s ease-in-out infinite; }
  .yaj-move--brisk_walk .yaj-leg-l,
  .yaj-move--brisk_walk .yaj-leg-r,
  .yaj-move--brisk_walk .yaj-arm-l,
  .yaj-move--brisk_walk .yaj-arm-r { animation-duration: 0.85s; }
  .yaj-move--cool_down .yaj-leg-l,
  .yaj-move--cool_down .yaj-leg-r,
  .yaj-move--cool_down .yaj-arm-l,
  .yaj-move--cool_down .yaj-arm-r { animation-duration: 1.8s; }
  @keyframes wL { 0%,100% { transform: rotate(12deg); } 50% { transform: rotate(-14deg); } }
  @keyframes wR { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(14deg); } }
  @keyframes aL { 0%,100% { transform: rotate(-16deg); } 50% { transform: rotate(14deg); } }
  @keyframes aR { 0%,100% { transform: rotate(16deg); } 50% { transform: rotate(-14deg); } }

  .yaj-move--seated_march .yaj-leg-l { animation: smL 1.5s ease-in-out infinite; }
  .yaj-move--seated_march .yaj-leg-r { animation: smR 1.5s ease-in-out infinite; }
  @keyframes smL { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px) rotate(-6deg); } }
  @keyframes smR { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px) rotate(6deg); } }

  .yaj-move--seated_twist .yaj-body { animation: twist 3.6s ease-in-out infinite; }
  @keyframes twist {
    0%,100% { transform: rotate(0deg); }
    25% { transform: rotate(-12deg); }
    75% { transform: rotate(12deg); }
  }

  .yaj-move--ankle_circles .yaj-leg-r { animation: ank 2.2s ease-in-out infinite; }
  @keyframes ank {
    0% { transform: rotate(0deg); }
    25% { transform: rotate(8deg); }
    50% { transform: rotate(0deg); }
    75% { transform: rotate(-8deg); }
    100% { transform: rotate(0deg); }
  }

  .yaj-move--side_reach .yaj-arm-r { animation: sr 3.8s ease-in-out infinite; }
  .yaj-move--side_reach .yaj-body { animation: srb 3.8s ease-in-out infinite; }
  @keyframes sr {
    0%,45%,100% { transform: rotate(0deg); }
    20%,30% { transform: rotate(140deg) translate(2px,-8px); }
  }
  @keyframes srb {
    0%,45%,100% { transform: rotate(0deg); }
    20%,30% { transform: rotate(8deg); }
  }

  .yaj-move--sit_to_stand .yaj-body { animation: sts 3.8s ease-in-out infinite; }
  @keyframes sts {
    0%,25% { transform: translateY(18px) scaleY(0.92); }
    50%,60% { transform: translateY(0) scaleY(1); }
    85%,100% { transform: translateY(18px) scaleY(0.92); }
  }

  .yaj-move--wall_pushup .yaj-body { animation: push 2.8s ease-in-out infinite; transform-origin: 150px 120px; }
  @keyframes push {
    0%,100% { transform: translateX(0) rotate(0deg); }
    50% { transform: translateX(12px) rotate(5deg); }
  }

  .yaj-move--squat .yaj-body { animation: sq 3s ease-in-out infinite; }
  @keyframes sq {
    0%,100% { transform: translateY(0) scaleY(1); }
    50% { transform: translateY(14px) scaleY(0.9); }
  }

  .yaj-move--side_steps .yaj-body { animation: ss 2.6s ease-in-out infinite; }
  @keyframes ss {
    0%,100% { transform: translateX(0); }
    25% { transform: translateX(14px); }
    75% { transform: translateX(-14px); }
  }

  .yaj-move--paused * { animation-play-state: paused !important; }
`;
