import { useEffect, useRef, useState, type ComponentType } from "react";
import type { RefObject } from "react";
import {
  Aperture,
  Ban,
  CircleDot,
  Contrast,
  Eraser,
  Focus,
  Heart,
  Loader2,
  Maximize2,
  Minus,
  Moon,
  MoveVertical,
  Paintbrush,
  RotateCcw,
  ScanFace,
  Smile,
  Sparkle,
  Sparkles,
  Square,
  SunMedium,
} from "lucide-react";
import { EFFECT_CATEGORIES, EFFECT_ITEMS, getEffectFilter } from "@/lib/create-modes";
import {
  BeautySettings,
  DEFAULT_BEAUTY,
  MAKEUP_LOOKS,
  detectSnapshotLandmarks,
  renderBeautyThumbnail,
  resetAllBeautyTools,
  type MakeupLookId,
} from "@/hooks/useBeautyEffects";

type Tab = "presets" | "beauty" | "makeup" | "filter";
type BeautySub = "skin" | "touchUp" | "face" | "eyes" | "nose" | "mouth";

type BeautyToolId =
  | "skinSmooth"
  | "complexion"
  | "contour"
  | "light3d"
  | "contrast"
  | "concealer"
  | "blemish"
  | "wrinkles"
  | "eyeBags"
  | "faceSlim"
  | "cheekbone"
  | "jawline"
  | "foreheadLift"
  | "eyeBrighten"
  | "eyeEnlarge"
  | "darkCircles"
  | "eyeSparkle"
  | "noseSlim"
  | "noseBridge"
  | "noseTip"
  | "lipPlump"
  | "lipColor"
  | "lipBrighten";

type MasterKey =
  | "skinMasterOn"
  | "touchUpMasterOn"
  | "faceMasterOn"
  | "eyesMasterOn"
  | "noseMasterOn"
  | "mouthMasterOn";

const BEAUTY_SUBS: { id: BeautySub; label: string; master: MasterKey; defaultTool: BeautyToolId }[] = [
  { id: "skin", label: "Skin", master: "skinMasterOn", defaultTool: "skinSmooth" },
  { id: "touchUp", label: "Touch Up", master: "touchUpMasterOn", defaultTool: "concealer" },
  { id: "face", label: "Face", master: "faceMasterOn", defaultTool: "faceSlim" },
  { id: "eyes", label: "Eyes", master: "eyesMasterOn", defaultTool: "eyeBrighten" },
  { id: "nose", label: "Nose", master: "noseMasterOn", defaultTool: "noseSlim" },
  { id: "mouth", label: "Mouth", master: "mouthMasterOn", defaultTool: "lipPlump" },
];

const TOOLS_BY_SUB: Record<
  BeautySub,
  { id: BeautyToolId; label: string; Icon: ComponentType<{ className?: string }> }[]
> = {
  skin: [
    { id: "skinSmooth", label: "Skin", Icon: Smile },
    { id: "complexion", label: "Complexion", Icon: ScanFace },
    { id: "contour", label: "Contour", Icon: Aperture },
    { id: "light3d", label: "3D Light", Icon: SunMedium },
    { id: "contrast", label: "Contrast", Icon: Contrast },
  ],
  touchUp: [
    { id: "concealer", label: "Concealer", Icon: Paintbrush },
    { id: "blemish", label: "Blemish", Icon: Eraser },
    { id: "wrinkles", label: "Wrinkles", Icon: Minus },
    { id: "eyeBags", label: "Eye Bags", Icon: Moon },
  ],
  face: [
    { id: "faceSlim", label: "Slim", Icon: Focus },
    { id: "cheekbone", label: "Cheek", Icon: ScanFace },
    { id: "jawline", label: "Jaw", Icon: Square },
    { id: "foreheadLift", label: "Forehead", Icon: MoveVertical },
  ],
  eyes: [
    { id: "eyeBrighten", label: "Brighten", Icon: SunMedium },
    { id: "eyeEnlarge", label: "Enlarge", Icon: Maximize2 },
    { id: "darkCircles", label: "Circles", Icon: Moon },
    { id: "eyeSparkle", label: "Sparkle", Icon: Sparkle },
  ],
  nose: [
    { id: "noseSlim", label: "Slim", Icon: Focus },
    { id: "noseBridge", label: "Bridge", Icon: MoveVertical },
    { id: "noseTip", label: "Tip", Icon: CircleDot },
  ],
  mouth: [
    { id: "lipPlump", label: "Plump", Icon: Maximize2 },
    { id: "lipColor", label: "Color", Icon: Heart },
    { id: "lipBrighten", label: "Shine", Icon: Sparkle },
  ],
};

type Preset = { id: string; label: string; settings: Partial<BeautySettings> };

const PRESETS: Preset[] = [
  {
    id: "smartBeauty",
    label: "Smart Beauty",
    settings: {
      skinSmooth: 35,
      complexion: 15,
      light3d: 10,
      concealer: 20,
      eyeBrighten: 15,
      darkCircles: 18,
    },
  },
  {
    id: "highBeauty",
    label: "High Beauty",
    settings: {
      skinSmooth: 55,
      complexion: 22,
      contour: 18,
      light3d: 18,
      faceSlim: 25,
      eyeEnlarge: 20,
      eyeBrighten: 22,
      noseSlim: 18,
      lipPlump: 15,
      concealer: 25,
    },
  },
  {
    id: "clearGlow",
    label: "Clear Glow",
    settings: { skinSmooth: 25, complexion: 20, light3d: 35, eyeSparkle: 20, lipBrighten: 18 },
  },
  {
    id: "warmTone",
    label: "Warm Tone",
    settings: {
      skinSmooth: 20,
      complexion: 15,
      colorFilter: getEffectFilter("warm"),
      filterIntensity: 55,
    },
  },
  {
    id: "sunKissed",
    label: "Sun-Kissed",
    settings: {
      skinSmooth: 15,
      complexion: 30,
      contour: 15,
      cheekbone: 20,
      colorFilter: getEffectFilter("glow-up"),
      filterIntensity: 45,
    },
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  settings: BeautySettings;
  onChange: (settings: BeautySettings) => void;
  videoRef: RefObject<HTMLVideoElement>;
  loading?: boolean;
  error?: string | null;
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
  const [tab, setTab] = useState<Tab>("beauty");
  const [beautySub, setBeautySub] = useState<BeautySub>("skin");
  const [beautyTool, setBeautyTool] = useState<BeautyToolId>("skinSmooth");
  const [filterCategory, setFilterCategory] = useState<(typeof EFFECT_CATEGORIES)[number]>("Trending");
  const [thumbTick, setThumbTick] = useState(0);
  const landmarksRef = useRef<Awaited<ReturnType<typeof detectSnapshotLandmarks>>>(null);

  const subMeta = BEAUTY_SUBS.find((s) => s.id === beautySub)!;
  const tools = TOOLS_BY_SUB[beautySub];
  const masterOn = settings[subMeta.master];
  const toolValue = settings[beautyTool] as number;

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

  const selectSub = (sub: BeautySub) => {
    setBeautySub(sub);
    const meta = BEAUTY_SUBS.find((s) => s.id === sub)!;
    setBeautyTool(meta.defaultTool);
  };

  const setToolValue = (value: number) => {
    onChange({ ...settings, [subMeta.master]: true, [beautyTool]: value });
  };

  const setFilter = (effectId: string) => {
    onChange({ ...settings, colorFilter: effectId === "none" ? "none" : getEffectFilter(effectId) });
  };

  const filterItems = EFFECT_ITEMS.filter((e) => e.id === "none" || e.category === filterCategory);

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex max-h-[70dvh] flex-col pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      {tab === "beauty" && (
        <div className="px-8 pb-3">
          <input
            type="range"
            min={0}
            max={100}
            value={masterOn ? toolValue : 0}
            disabled={!masterOn}
            onChange={(e) => setToolValue(Number(e.target.value))}
            className="w-full accent-white disabled:opacity-40"
            aria-label={`${tools.find((t) => t.id === beautyTool)?.label || "Beauty"} intensity`}
          />
        </div>
      )}

      <div className="flex max-h-[64dvh] flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-black/92 backdrop-blur-xl">
        <div className="flex items-center gap-4 overflow-x-auto border-b border-white/10 px-4 py-2.5 no-scrollbar">
          {(["presets", "beauty", "makeup", "filter"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 text-sm font-bold capitalize transition-colors ${
                tab === t ? "text-white" : "text-white/45"
              }`}
            >
              {t === "presets" ? (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Presets
                </span>
              ) : (
                t
              )}
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
            Can't find your face — face the camera in good light so Beauty tools and Makeup can apply. Color Filters
            still work without a face.
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
            <div className="flex items-center gap-4 overflow-x-auto border-b border-white/10 px-4 pt-2 no-scrollbar">
              <button
                type="button"
                onClick={() => onChange(resetAllBeautyTools(settings))}
                className="flex shrink-0 items-center gap-1.5 pb-2 text-[12px] font-semibold text-white/70"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset all
              </button>
              {BEAUTY_SUBS.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => selectSub(sub.id)}
                  className={`shrink-0 border-b-2 pb-2 text-[12px] font-semibold whitespace-nowrap ${
                    beautySub === sub.id ? "border-white text-white" : "border-transparent text-white/45"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 overflow-x-auto px-3 py-3 no-scrollbar">
              <button
                type="button"
                role="switch"
                aria-checked={masterOn}
                aria-label={`${subMeta.label} effects on`}
                onClick={() => onChange({ ...settings, [subMeta.master]: !masterOn })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  masterOn ? "bg-white" : "bg-white/25"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full shadow transition-all ${
                    masterOn ? "left-[1.35rem] bg-neutral-900" : "left-0.5 bg-white"
                  }`}
                />
              </button>
              <span className="h-10 w-px shrink-0 bg-white/15" />

              {tools.map(({ id, label, Icon }) => {
                const selected = beautyTool === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBeautyTool(id)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                  >
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-xl border ${
                        selected
                          ? "border-cyan-400 bg-white/10 text-cyan-300"
                          : "border-white/15 bg-white/5 text-white/75"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className={`text-[10.5px] font-semibold ${selected ? "text-cyan-300" : "text-white/70"}`}>
                      {label}
                    </span>
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
                  <span className={`h-20 w-20 overflow-hidden rounded-2xl border ${selected ? "border-cyan-400" : "border-white/15"} bg-white/5`}>
                    {thumbTick >= 0 && <img src={thumb({ makeupId: look.id })} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className={`w-20 text-center text-[11px] font-semibold leading-tight ${selected ? "text-cyan-300" : "text-white/80"}`}>
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
            <div className="flex items-center gap-3 overflow-x-auto px-4 pb-1 pt-2 no-scrollbar">
              {EFFECT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`shrink-0 whitespace-nowrap border-b-2 pb-1 text-xs font-semibold ${
                    filterCategory === cat ? "border-white text-white" : "border-transparent text-white/45"
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
                      <span className={`h-20 w-20 overflow-hidden rounded-2xl border ${selected ? "border-cyan-400" : "border-white/15"} bg-white/5`}>
                        {thumbTick >= 0 && <img src={thumb({ colorFilter: item.filter, filterIntensity: 100 })} alt="" className="h-full w-full object-cover" />}
                      </span>
                    )}
                    <span className={`w-20 text-center text-[11px] font-semibold leading-tight ${selected ? "text-cyan-300" : "text-white/80"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
