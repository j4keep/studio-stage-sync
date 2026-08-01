import { battleCategoryFromMedia } from "@/lib/battle-ui";

export default function BattleCategoryChip({
  mediaType,
  className = "",
}: {
  mediaType?: string | null;
  className?: string;
}) {
  const cat = battleCategoryFromMedia(mediaType);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/90 ring-1 ring-white/15 backdrop-blur-sm ${className}`}
    >
      <span aria-hidden>{cat.emoji}</span>
      {cat.label} Battle
    </span>
  );
}
