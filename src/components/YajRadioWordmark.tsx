import yajLogo from "@/assets/yaj-logo.png";
import radioWordmark from "@/assets/yaj-radio-wordmark.png";

/** YAJ logo + brush RADIO wordmark — aligned baseline, tight spacing, no splash marks. */
export default function YajRadioWordmark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const logoH = size === "lg" ? "h-14" : size === "sm" ? "h-10" : "h-12";
  // Match visual letter height to YAJ (RADIO asset is wider)
  const radioH = size === "lg" ? "h-10" : size === "sm" ? "h-7" : "h-8";

  return (
    <div className={`flex items-end min-w-0 ${className}`} style={{ gap: 0 }}>
      <img
        src={yajLogo}
        alt="YAJ"
        className={`${logoH} w-auto shrink-0 -my-1`}
      />
      <img
        src={radioWordmark}
        alt="Radio"
        className={`${radioH} w-auto max-w-[8.5rem] shrink-0 object-contain object-left -ml-4 sm:-ml-5 translate-y-[-1px]`}
      />
    </div>
  );
}
