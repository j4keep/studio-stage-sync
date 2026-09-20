import { KIND_META } from "./yajTvMeta";
import type { WheuatTvKind } from "./wheuatTvStore";

/**
 * Original, non-copyrighted poster art for any YAJ.TV card that has no
 * uploaded cover image. Deterministic per title, so the same item always
 * gets the same gradient instead of a random one on every render.
 */
const GRADIENTS: [string, string][] = [
  ["#7c3aed", "#1e1b4b"],
  ["#db2777", "#1e1b4b"],
  ["#0ea5e9", "#0f172a"],
  ["#f59e0b", "#1c1917"],
  ["#10b981", "#0f172a"],
  ["#ef4444", "#1c0a0a"],
  ["#6366f1", "#0b1020"],
  ["#14b8a6", "#0b1615"],
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function YajTvPosterPlaceholder({
  title,
  kind,
  className = "",
}: {
  title: string;
  kind: WheuatTvKind;
  className?: string;
}) {
  const [from, to] = GRADIENTS[hashString(title) % GRADIENTS.length];
  const Icon = KIND_META[kind].Icon;

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(155deg, ${from} 0%, ${to} 100%)` }}
    >
      <div className="absolute inset-0 opacity-20 mix-blend-overlay [background-image:radial-gradient(circle_at_30%_20%,white,transparent_45%)]" />
      <Icon className="h-8 w-8 text-white/30" strokeWidth={1.5} />
      <span className="absolute top-2 left-2 text-[9px] font-bold tracking-widest text-white/40">YAJ.TV</span>
      <span className="absolute inset-x-2 bottom-2 line-clamp-3 text-center text-[11px] font-semibold leading-tight text-white/85">
        {title}
      </span>
    </div>
  );
}
