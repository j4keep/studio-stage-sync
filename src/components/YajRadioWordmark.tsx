import yajLogo from "@/assets/yaj-logo.png";
import radioWordmark from "@/assets/yaj-radio-wordmark.png";

/** YAJ logo + brush-style Radio wordmark matching logo paint style. */
export default function YajRadioWordmark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const logoH = size === "lg" ? "h-14" : size === "sm" ? "h-9" : "h-12";
  const radioH = size === "lg" ? "h-10" : size === "sm" ? "h-6" : "h-8";

  return (
    <div className={`flex items-center gap-0 min-w-0 ${className}`}>
      <img src={yajLogo} alt="YAJ" className={`${logoH} w-auto shrink-0 -my-2`} />
      <img
        src={radioWordmark}
        alt="Radio"
        className={`${radioH} w-auto shrink-0 -ml-2 object-contain object-left sm:-ml-2.5`}
      />
    </div>
  );
}
