import yajLogo from "@/assets/yaj-logo.png";
import radioWordmark from "@/assets/yaj-radio-wordmark.png";

/** YAJ logo + RADIO wordmark — RADIO smaller than YAJ, tight left cluster. */
export default function YajRadioWordmark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  // YAJ is the hero size; RADIO stays clearly smaller
  const logoH = size === "lg" ? "h-12" : size === "sm" ? "h-9" : "h-11";
  const radioH = size === "lg" ? "h-6" : size === "sm" ? "h-5" : "h-[1.35rem]";

  return (
    <div className={`inline-flex items-center min-w-0 ${className}`} style={{ gap: 0 }}>
      <img src={yajLogo} alt="YAJ" className={`${logoH} w-auto shrink-0`} />
      <img
        src={radioWordmark}
        alt="Radio"
        className={`${radioH} w-auto max-w-[6.5rem] shrink-0 object-contain object-left -ml-3.5 sm:-ml-4`}
      />
    </div>
  );
}
