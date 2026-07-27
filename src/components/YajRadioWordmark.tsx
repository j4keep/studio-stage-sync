import yajLogo from "@/assets/yaj-logo.png";
import radioWordmark from "@/assets/yaj-radio-wordmark.png";

/** YAJ logo + brush RADIO wordmark (transparent), tight spacing. */
export default function YajRadioWordmark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const logoH = size === "lg" ? "h-14" : size === "sm" ? "h-10" : "h-12";
  // RADIO asset is wider/taller than YAJ — keep height close to logo
  const radioH = size === "lg" ? "h-11" : size === "sm" ? "h-7" : "h-9";

  return (
    <div className={`flex items-center min-w-0 ${className}`} style={{ gap: 0 }}>
      <img src={yajLogo} alt="YAJ" className={`${logoH} w-auto shrink-0 -my-2`} />
      <img
        src={radioWordmark}
        alt="Radio"
        className={`${radioH} w-auto max-w-[9.5rem] shrink-0 object-contain object-left -ml-3 sm:-ml-3.5`}
      />
    </div>
  );
}
