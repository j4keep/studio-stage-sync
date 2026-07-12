import { Ban } from "lucide-react";
import { EFFECT_CATEGORIES, EFFECT_ITEMS } from "@/lib/create-modes";

interface Props {
  open: boolean;
  category: string;
  onCategoryChange: (category: string) => void;
  onClose: () => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export default function EffectsPanel({
  open,
  category,
  onCategoryChange,
  onClose,
  selectedId,
  onSelect,
}: Props) {
  if (!open) return null;

  const items = EFFECT_ITEMS.filter(
    (item) => item.id === "none" || item.category === category,
  );

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 max-h-[62dvh] rounded-t-2xl bg-black/92 backdrop-blur-xl border-t border-white/10 flex flex-col pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <button
          type="button"
          onClick={() => onSelect?.("none")}
          className="text-white/80 p-1.5 rounded-lg bg-white/5"
          aria-label="No effect"
        >
          <Ban className="w-5 h-5" />
        </button>
        <div className="flex-1 overflow-x-auto scrollbar-hide flex gap-3 ml-1">
          {EFFECT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`shrink-0 text-sm font-semibold pb-1 border-b-2 whitespace-nowrap ${
                category === cat ? "text-white border-white" : "text-white/45 border-transparent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="text-white text-xs font-bold px-2">
          Done
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 p-3 overflow-y-auto">
        {items.map((item) => {
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item.id)}
              className={`flex flex-col items-center gap-1 rounded-xl p-1 transition-all ${
                active ? "bg-white/15" : "bg-white/5"
              }`}
            >
              <div
                className={`w-full aspect-square rounded-xl border-2 ${
                  active ? "border-white" : "border-white/10"
                }`}
                style={{ background: item.preview, filter: item.filter }}
              />
              <span className="text-[10px] text-white/90 text-center leading-tight truncate w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
