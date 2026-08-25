import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Ban, Loader2, RotateCcw } from "lucide-react";
import { EFFECT_CATEGORIES, EFFECT_ITEMS, getEffectFilter } from "@/lib/create-modes";
import {
  BeautySettings,
  DEFAULT_BEAUTY,
  MAKEUP_LOOKS,
  detectSnapshotLandmarks,
  renderBeautyThumbnail,
  type MakeupLookId,
} from "@/hooks/useBeautyEffects";

type Tab = "presets" | "beauty" | "makeup" | "filter";
type BeautyTool = "skinSmooth" | "complexion" | "contour" | "light3d";

const BEAUTY_TOOLS: { id: BeautyTool; label: string }[] = [
  { id: "skinSmooth", label: "Skin" },
  { id: "complexion", label: "Complexion" },
  { id: "contour", label: "Contour" },
  { id: "light3d", label: "3D Light" },
];

type Preset = { id: string; label: string; settings: Partial<BeautySettings> };

const PRESETS: Preset[] = [
  { id: "smartBeauty", label: "Smart Beauty", settings: { skinSmooth: 35, complexion: 15, light3d: 10 } },
  { id: "highBeauty", label: "High Beauty", settings: { skinSmooth: 60, complexion: 25, contour: 20, light3d: 20 } },
  { id: "clearGlow", label: "Clear Glow", settings: { skinSmooth: 25, complexion: 20, light3d: 35 } },
  { id: "warmTone", label: "Warm Tone", settings: { skinSmooth: 20, complexion: 15, colorFilter: getEffectFilter("warm"), filterIntensity: 55 } },
  { id: "sunKissed", label: "Sun-Kissed", settings: { skinSmooth: 15, complexion: 30, contour: 15, colorFilter: getEffectFilter("glow-up"), filterIntensity: 45 } },
];

interface Props {
  open: boolean;
  onClose: () => void;
  settings: BeautySettings;
  onChange: (settings: BeautySettings) => void;
  videoRef: RefObject<HTMLVideoElement>;
  loading?: boolean;
  error?: string | null;
  /** Whether the live pipeline currently has a face locked on — distinct from `loading`/
   *  `error`: the model can be running fine and simply not finding a face (backlighting,
   *  out of frame, extreme angle). Skin/Complexion/Contour/3D Light/Makeup need this; color
   *  filters don't. Without surfacing it, "no face found" looks identical to "broken." */
  faceDetected?: boolean;
  needsFaceTracking?: boolean;
}

export default function BeautyPanel({
  open,
  onClose,
  settings,
  onChange,
  videoRef,
  loading,
  error,
  faceDetected,
  needsFaceTracking,
}: Props) {
  const [tab, setTab] = useState<Tab>("presets");
  const [beautyTool, setBeautyTool] = useState<BeautyTool>("skinSmooth");
  const [filterCategory, setFilterCategory] = useState<(typeof EFFECT_CATEGORIES)[number]>("Trending");
  const [thumbTick, setThumbTick] = useState(0);
  const landmarksRef = useRef<Awaited<ReturnType<typeof detectSnapshotLandmarks>>>(null);

  // Refresh the shared face snapshot every few seconds while the panel is open — one
  // detection pass feeds every thumbnail redraw below, not one detection per thumbnail.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const refresh = async () => {
      const video = videoRef.current;
      if (!video) return;
      const lm = await detectSnapshotLandmarks(video);
      if (!cancelled) {
        landmarksRef.current = lm;
        setThumbTick((t) => t + 1);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 3500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open, videoRef]);

  if (!open) return null;

  const thumb = (previewSettings: Partial<BeautySettings>): string => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return "";
    return renderBeautyThumbnail(video, landmarksRef.current, { ...DEFAULT_BEAUTY, ...previewSettings });
  };

  const applyPreset = (preset: Preset) => {
    onChange({ ...DEFAULT_BEAUTY, ...preset.settings });
  };

  const toggleMakeup = (id: MakeupLookId) => {
    onChange({ ...settings, makeupId: settings.makeupId === id ? null : id });
  };

  const setToolValue = (value: number) => {
    onChange({ ...settings, [beautyTool]: value });
  };

  const setFilter = (effectId: string) => {
    onChange({ ...settings, colorFilter: effectId === "none" ? "none" : getEffectFilter(effectId) });
  };

  const filterItems = EFFECT_ITEMS.filter((e) => e.id === "none" || e.category === filterCategory);

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 max-h-[64dvh] rounded-t-2xl bg-black/92 backdrop-blur-xl border-t border-white/10 flex flex-col pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-white/10 overflow-x-auto no-scrollbar">
        {(["presets", "beauty", "makeup", "filter"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 text-sm font-bold capitalize transition-colors ${tab === t ? "text-white" : "text-white/45"}`}
          >
            {t === "presets" ? "✨ Presets" : t}
          </button>
        ))}
        <button type="button" onClick={onClose} className="ml-auto shrink-0 text-xs font-bold text-white">
          Done
        </button>
      </div>

      {loading && (
        <p className="flex items-center gap-1.5 px-4 pt-2 text-[11px] text-white/50">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading beauty preview…
        </p>
      )}
      {error && <p className="px-4 pt-2 text-[11px] text-red-400">{error}</p>}
      {!loading && !error && needsFaceTracking && !faceDetected && (
        <p className="px-4 pt-2 text-[11px] text-amber-400">
          Can't find your face — face the camera in good light so Skin, Complexion, Contour, 3D Light and Makeup can
          apply. Color Filters don't need a detected face and still work either way.
        </p>
      )}

      {tab === "presets" && (
        <div className="flex gap-3 overflow-x-auto px-4 py-3 no-scrollbar">
          <button type="button" onClick={() => onChange(DEFAULT_BEAUTY)} className="flex shrink-0 flex-col items-center gap-1.5">
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/60">
              <Ban className="h-6 w-6" />
            </span>
            <span className="text-[11px] font-semibold text-white/80">None</span>
          </button>
          {PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="flex shrink-0 flex-col items-center gap-1.5">
              <span className="h-20 w-20 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                {thumbTick >= 0 && <img src={thumb(preset.settings)} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="w-20 text-center text-[11px] font-semibold leading-tight text-white/80">{preset.label}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "beauty" && (
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-4 pt-3">
            <input
              type="range"
              min={0}
              max={100}
              value={settings[beautyTool]}
              onChange={(e) => setToolValue(Number(e.target.value))}
              className="flex-1 accent-white"
            />
            <span className="w-8 shrink-0 text-right text-xs font-bold text-white">{settings[beautyTool]}</span>
          </div>
          <div className="flex items-center gap-4 px-4 pb-1 pt-3 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => onChange({ ...settings, skinSmooth: 0, complexion: 0, contour: 0, light3d: 0 })}
              className="flex shrink-0 flex-col items-center gap-1 text-white/70"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-[10px] font-semibold">Reset</span>
            </button>
            {BEAUTY_TOOLS.map((toolDef) => {
              const on = settings[toolDef.id] > 0;
              const selected = beautyTool === toolDef.id;
              return (
                <button key={toolDef.id} type="button" onClick={() => setBeautyTool(toolDef.id)} className="flex shrink-0 flex-col items-center gap-1.5">
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-[10px] font-bold ${
                      selected ? "border-white bg-white/15 text-white" : "border-white/15 bg-white/5 text-white/60"
                    }`}
                  >
                    {on ? settings[toolDef.id] : "—"}
                  </span>
                  <span className={`text-[10.5px] font-semibold ${selected ? "text-white" : "text-white/70"}`}>{toolDef.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "makeup" && (
        <div className="flex gap-3 overflow-x-auto px-4 py-3 no-scrollbar">
          <button
            type="button"
            onClick={() => onChange({ ...settings, makeupId: null })}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/60">
              <Ban className="h-6 w-6" />
            </span>
            <span className="text-[11px] font-semibold text-white/80">None</span>
          </button>
          {MAKEUP_LOOKS.map((look) => {
            const selected = settings.makeupId === look.id;
            return (
              <button key={look.id} type="button" onClick={() => toggleMakeup(look.id)} className="flex shrink-0 flex-col items-center gap-1.5">
                <span className={`h-20 w-20 overflow-hidden rounded-2xl border ${selected ? "border-primary" : "border-white/15"} bg-white/5`}>
                  {thumbTick >= 0 && <img src={thumb({ makeupId: look.id })} alt="" className="h-full w-full object-cover" />}
                </span>
                <span className={`w-20 text-center text-[11px] font-semibold leading-tight ${selected ? "text-primary" : "text-white/80"}`}>
                  {look.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tab === "filter" && (
        <div className="flex flex-col">
          <div className="flex items-center gap-3 px-4 pt-3">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.filterIntensity}
              onChange={(e) => onChange({ ...settings, filterIntensity: Number(e.target.value) })}
              className="flex-1 accent-white"
            />
            <span className="w-8 shrink-0 text-right text-xs font-bold text-white">{settings.filterIntensity}</span>
          </div>
          <div className="flex items-center gap-3 px-4 pb-1 pt-2 overflow-x-auto no-scrollbar">
            {EFFECT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`shrink-0 text-xs font-semibold pb-1 border-b-2 whitespace-nowrap ${
                  filterCategory === cat ? "text-white border-white" : "text-white/45 border-transparent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 py-3 no-scrollbar">
            {filterItems.map((item) => {
              const selected = item.id === "none" ? settings.colorFilter === "none" : settings.colorFilter === item.filter;
              return (
                <button key={item.id} type="button" onClick={() => setFilter(item.id)} className="flex shrink-0 flex-col items-center gap-1.5">
                  {item.id === "none" ? (
                    <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/60">
                      <Ban className="h-6 w-6" />
                    </span>
                  ) : (
                    <span className={`h-20 w-20 overflow-hidden rounded-2xl border ${selected ? "border-primary" : "border-white/15"} bg-white/5`}>
                      {thumbTick >= 0 && <img src={thumb({ colorFilter: item.filter, filterIntensity: 100 })} alt="" className="h-full w-full object-cover" />}
                    </span>
                  )}
                  <span className={`w-20 text-center text-[11px] font-semibold leading-tight ${selected ? "text-primary" : "text-white/80"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
