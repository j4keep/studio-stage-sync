import winnerCheck from "@/assets/battle-winner-check.png";

type Props = {
  /** slightly larger on expanded feed / fullscreen cards */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: "w-[48%] max-w-[6.25rem]",
  md: "w-[52%] max-w-[7.75rem]",
  lg: "w-[42%] max-w-[10rem]",
} as const;

/**
 * Election-style winner checkmark — lower-right of the winning competitor card.
 * Stays through replay / post view until the battle is deleted.
 */
export default function BattleWinnerCheckBadge({ size = "md", className = "" }: Props) {
  return (
    <div
      className={`pointer-events-none absolute bottom-1.5 right-1 z-30 ${SIZE[size]} ${className}`}
      aria-label="Winner"
    >
      <img
        src={winnerCheck}
        alt="Winner"
        className="h-auto w-full select-none [mix-blend-mode:screen] drop-shadow-[0_4px_18px_rgba(236,72,153,0.55)]"
        draggable={false}
      />
    </div>
  );
}
