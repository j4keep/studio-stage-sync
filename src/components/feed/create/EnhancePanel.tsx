import { Ban, RotateCcw, Sparkles } from "lucide-react";
import {
  APPEARANCE_TOOLS,
  DEFAULT_ENHANCE,
  ENHANCE_TABS,
  FILTER_PRESETS,
  MAKEUP_PRESETS,
  optimizeEnhanceSettings,
  type AppearanceToolId,
  type EnhanceSettings,
  type EnhanceTab,
} from "@/lib/create-modes";

interface Props {
  open: boolean;
  tab: EnhanceTab;
  onTabChange: (tab: EnhanceTab) => void;
  onClose: () => void;
  settings: EnhanceSettings;
  onChange: (settings: EnhanceSettings) => void;
  /** Which Appearance tool the intensity slider edits. */
  appearanceTool: AppearanceToolId;
  onAppearanceToolChange: (id: AppearanceToolId) => void;
}

export default function EnhancePanel({
  open,
  tab,
  onTabChange,
  onClose,
  settings,
  onChange,
  appearanceTool,
  onAppearanceToolChange,
}: Props) {
  if (!open) return null;

  const resetAll = () => onChange({ ...DEFAULT_ENHANCE });

  const appearanceValue = settings[appearanceTool];

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-2xl bg-black/90 backdrop-blur-xl border-t border-white/10 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      {(tab === "Filters" || tab === "Appearance") && (
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={tab === "Filters" ? settings.filterIntensity : appearanceValue}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (tab === "Filters") {
                onChange({ ...settings, filterIntensity: value });
              } else {
                onChange({ ...settings, [appearanceTool]: value });
              }
            }}
            className="flex-1 accent-white"
            aria-label={tab === "Filters" ? "Filter intensity" : `${appearanceTool} intensity`}
          />
          <span className="text-white text-xs font-bold w-8 text-right">
            {tab === "Filters" ? settings.filterIntensity : appearanceValue}
          </span>
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-white/10">
        {ENHANCE_TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              if (item === "Optimize") {
                onChange(optimizeEnhanceSettings());
                onTabChange("Appearance");
                return;
              }
              onTabChange(item);
            }}
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
        <button type="button" onClick={resetAll} className="ml-auto shrink-0 text-white/60 p-1" aria-label="Reset enhance">
          <RotateCcw className="w-5 h-5" />
        </button>
        <button type="button" onClick={onClose} className="shrink-0 text-xs font-bold text-white">
          Done
        </button>
      </div>

      <div className="px-3 py-3 overflow-x-auto scrollbar-hide">
        {tab === "Appearance" && (
          <div className="flex gap-4">
            {APPEARANCE_TOOLS.map((tool) => {
              const selected = appearanceTool === tool.id;
              const active = settings[tool.id] > 0;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    onAppearanceToolChange(tool.id);
                    // Tapping a tool must apply immediately — selecting alone left values at 0.
                    if (settings[tool.id] <= 0) {
                      onChange({ ...settings, [tool.id]: 50 });
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-16"
                >
                  <div
                    className={`w-14 h-14 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                      selected
                        ? "border-cyan-400 bg-white/15 text-cyan-300"
                        : active
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/15 bg-white/10 text-white"
                    }`}
                  >
                    {tool.label[0]}
                  </div>
                  <span className={`text-[11px] ${selected ? "text-cyan-300" : "text-white/80"}`}>{tool.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "Makeup" && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...settings, makeupId: null })}
              className="flex flex-col items-center gap-1 shrink-0 w-[4.5rem]"
            >
              <div
                className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${
                  !settings.makeupId ? "border-cyan-400 bg-white/10" : "border-white/20 bg-white/5"
                }`}
              >
                <Ban className="w-5 h-5 text-white/70" />
              </div>
              <span className="text-[10px] text-white/75">None</span>
            </button>
            {MAKEUP_PRESETS.map((look) => {
              const selected = settings.makeupId === look.id;
              return (
                <button
                  key={look.id}
                  type="button"
                  onClick={() => onChange({ ...settings, makeupId: selected ? null : look.id })}
                  className="flex flex-col items-center gap-1 shrink-0 w-[4.5rem]"
                >
                  <div
                    className={`w-14 h-14 rounded-full border-2 ${selected ? "border-cyan-400" : "border-white/20"}`}
                    style={{ background: look.preview }}
                  />
                  <span className={`text-[10px] text-center line-clamp-2 ${selected ? "text-cyan-300" : "text-white/75"}`}>
                    {look.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "Filters" && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...settings, filterId: null })}
              className="flex flex-col items-center gap-1 shrink-0 w-[4.5rem]"
            >
              <div
                className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${
                  !settings.filterId ? "border-cyan-400 bg-white/10" : "border-white/20 bg-white/5"
                }`}
              >
                <Ban className="w-5 h-5 text-white/70" />
              </div>
              <span className="text-[10px] text-white/75">None</span>
            </button>
            {FILTER_PRESETS.map((preset) => {
              const selected = settings.filterId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...settings,
                      filterId: selected ? null : preset.id,
                      filterIntensity: settings.filterIntensity || 80,
                    })
                  }
                  className="flex flex-col items-center gap-1 shrink-0 w-[4.5rem]"
                >
                  <div
                    className={`w-14 h-14 rounded-full border-2 ${selected ? "border-cyan-400" : "border-white/20"}`}
                    style={{ background: preset.preview }}
                  />
                  <span className={`text-[10px] ${selected ? "text-cyan-300" : "text-white/75"}`}>{preset.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "Optimize" && (
          <p className="text-center text-white/50 text-xs py-4">Tap Optimize above to apply a clear glow look.</p>
        )}
      </div>
    </div>
  );
}
