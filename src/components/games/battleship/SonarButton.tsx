import { Radar } from "lucide-react";

/** The Sonar Pulse trigger — result feedback ("SHIP DETECTED" / "CLEAR WATER") reuses the
 *  page's existing shot-result banner rather than a second toast system. */
export default function SonarButton({
  usesLeft,
  disabled,
  onUse,
}: {
  usesLeft: number;
  disabled?: boolean;
  onUse: () => void;
}) {
  if (usesLeft <= 0) return null;
  return (
    <button
      type="button"
      onClick={onUse}
      disabled={disabled}
      className="mx-auto flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-sky-200 active:scale-95 disabled:opacity-40"
    >
      <Radar className="h-4 w-4" /> Sonar Pulse · {usesLeft} left
    </button>
  );
}
