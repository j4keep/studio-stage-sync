import yajLogo from "@/assets/yaj-logo.png";

/** YAJ logo + brush-style “Radio” using logo palette (purple / magenta / teal / orange). */
export default function YajRadioWordmark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const logoH = size === "lg" ? "h-14" : size === "sm" ? "h-9" : "h-12";
  const radioSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-xl" : "text-2xl";
  const letters = [
    { ch: "R", color: "#A855F7" },
    { ch: "a", color: "#EC4899" },
    { ch: "d", color: "#14B8A6" },
    { ch: "i", color: "#F97316" },
    { ch: "o", color: "#A855F7" },
  ];

  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className}`}>
      <img src={yajLogo} alt="YAJ" className={`${logoH} w-auto shrink-0 -my-2`} />
      <span
        className={`${radioSize} font-black italic tracking-tight leading-none select-none`}
        aria-label="Radio"
        style={{
          fontFamily: '"Arial Black", "Helvetica Neue", Impact, sans-serif',
          textShadow: "0 1px 0 rgba(0,0,0,0.12)",
          transform: "skewX(-6deg)",
        }}
      >
        {letters.map((l, i) => (
          <span key={i} style={{ color: l.color }}>
            {l.ch}
          </span>
        ))}
      </span>
    </div>
  );
}
