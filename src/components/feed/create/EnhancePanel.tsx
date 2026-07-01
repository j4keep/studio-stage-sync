import { RotateCcw, Sparkles } from "lucide-react";
import {
  APPEARANCE_TOOLS,
  ENHANCE_TABS,
  FILTER_PRESETS,
  MAKEUP_PRESETS,
  type EnhanceTab,
} from "@/lib/create-modes";

interface Props {
  open: boolean;
  tab: EnhanceTab;
  onTabChange: (tab: EnhanceTab) => void;
  onClose: () => void;
  filterIntensity?: number;
  onFilterIntensityChange?: (value: number) => void;
}

export default function EnhancePanel({
  open,
  tab,
  onTabChange,
  onClose,
  filterIntensity = 80,
  onFilterIntensityChange,
}: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-2xl bg-black/90 backdrop-blur-xl border-t border-white/10 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      {tab === "Filters" && (
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={filterIntensity}
            onChange={(e) => onFilterIntensityChange?.(Number(e.target.value))}
            className="flex-1 accent-white"
          />
          <span className="text-white text-xs font-bold w-8 text-right">{filterIntensity}</span>
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-white/10">
        {ENHANCE_TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTabChange(item)}
            className={`shrink-0 text-sm font-semibold pb-2 border-b-2 transition-colors ${
              tab === item ? "text-white border-white" : "text-white/45 border-transparent"
            }`}
          >
            {item === "Optimize" ? (
              <span className="inline-flex items-center gap-1">
                {item}
                <Sparkles className="w-3 h-3" />
              </span>
            ) : (
              item
            )}
          </button>
        ))}
        <button type="button" onClick={onClose} className="ml-auto shrink-0 text-white/60 p-1">
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 py-3 overflow-x-auto scrollbar-hide">
        {tab === "Appearance" && (
          <div className="flex gap-4">
            {APPEARANCE_TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className="flex flex-col items-center gap-1.5 shrink-0 w-16"
              >
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[10px] text-white font-bold">
                  {tool.label[0]}
                </div>
                <span className="text-[11px] text-white/80">{tool.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "Makeup" && (
          <div className="flex gap-3">
            {MAKEUP_PRESETS.map((name) => (
              <button key={name} type="button" className="flex flex-col items-center gap-1 shrink-0 w-[4.5rem]">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-300/40 to-purple-500/40 border-2 border-white/20" />
                <span className="text-[10px] text-white/75 text-center line-clamp-2">{name}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "Filters" && (
          <div className="flex gap-3">
            {FILTER_PRESETS.map((name) => (
              <button key={name} type="button" className="flex flex-col items-center gap-1 shrink-0 w-[4.5rem]">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-200/30 to-sky-400/30 border-2 border-white/20" />
                <span className="text-[10px] text-white/75">{name}</span>
              </button>
            ))}
          </div>
        )}

        {(tab === "Optimize" || !["Appearance", "Makeup", "Filters"].includes(tab)) && (
          <p className="text-center text-white/50 text-xs py-4">AI optimize coming soon</p>
        )}
      </div>
    </div>
  );
}
