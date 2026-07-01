import { useCallback, useEffect, useRef, useState } from "react";
import { X, SwitchCamera, Sparkles, Wand2, Timer, LayoutGrid, ChevronDown } from "lucide-react";
import { warmCameraStream, releaseCameraStream, streamHasLiveAudio } from "@/lib/create-camera";
import type { CreateMode, EnhanceTab } from "@/lib/create-modes";
import CreateModeTabs from "./CreateModeTabs";
import EnhancePanel from "./EnhancePanel";
import EffectsPanel from "./EffectsPanel";

interface Props {
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  onClose: () => void;
  initialStream?: MediaStream | null;
}

export default function LiveCameraView({
  createMode,
  onModeChange,
  onClose,
  initialStream,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [showEnhance, setShowEnhance] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [enhanceTab, setEnhanceTab] = useState<EnhanceTab>("Appearance");
  const [effectCategory, setEffectCategory] = useState("Trending");
  const [selectedEffect, setSelectedEffect] = useState("none");
  const [filterIntensity, setFilterIntensity] = useState(80);
  const [liveActive, setLiveActive] = useState(false);

  const attachStream = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play();
    }
    setReady(true);
    setDenied(false);
  }, []);

  const startCamera = useCallback(async () => {
    releaseCameraStream(streamRef.current);
    streamRef.current = null;
    try {
      const stream = await warmCameraStream(facing);
      if (!stream) throw new Error("denied");
      await attachStream(stream);
    } catch {
      setDenied(true);
      setReady(false);
    }
  }, [facing, attachStream]);

  useEffect(() => {
    if (initialStream) {
      void attachStream(initialStream);
      return () => releaseCameraStream(streamRef.current);
    }
    void startCamera();
    return () => releaseCameraStream(streamRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialStream) return;
    void startCamera();
  }, [facing, initialStream, startCamera]);

  const flipCamera = () => setFacing((f) => (f === "user" ? "environment" : "user"));

  const handleGoLive = () => {
    if (!ready || !streamHasLiveAudio(streamRef.current)) {
      return;
    }
    setLiveActive((v) => !v);
  };

  return (
    <div className="absolute inset-0 bg-black flex flex-col touch-none">
      {!denied && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
        />
      )}

      <div className="relative z-20 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center text-white">
          <X className="w-7 h-7" />
        </button>
        <span className="text-xs font-bold text-white/80 px-3 py-1 rounded-full bg-black/40">
          {liveActive ? "● LIVE" : "Go Live"}
        </span>
        <div className="w-11" />
      </div>

      <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+4rem)] z-20 flex flex-col items-center gap-4">
        <button type="button" onClick={flipCamera} className="flex flex-col items-center gap-1 text-white">
          <SwitchCamera className="w-7 h-7" />
        </button>
        <button type="button" className="flex flex-col items-center gap-1 text-white/80">
          <Timer className="w-6 h-6" />
        </button>
        <button type="button" className="flex flex-col items-center gap-1 text-white/80">
          <LayoutGrid className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowEffects(false);
            setShowEnhance((v) => !v);
          }}
          className={`flex flex-col items-center gap-1 ${showEnhance ? "text-white" : "text-white/80"}`}
        >
          <Sparkles className="w-6 h-6" />
          <span className="text-[9px] font-semibold">Enhance</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setShowEnhance(false);
            setShowEffects((v) => !v);
          }}
          className={`flex flex-col items-center gap-1 ${showEffects ? "text-white" : "text-white/80"}`}
        >
          <Wand2 className="w-6 h-6" />
          <span className="text-[9px] font-semibold">Effects</span>
        </button>
        <ChevronDown className="w-5 h-5 text-white/50 mt-1" />
      </div>

      <div className="relative z-20 mt-auto flex flex-col items-center pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+2.5rem)]">
        <button
          type="button"
          onClick={handleGoLive}
          disabled={denied || !ready}
          className={`w-[4.75rem] h-[4.75rem] rounded-full border-[5px] flex items-center justify-center transition-all disabled:opacity-40 ${
            liveActive ? "border-red-400 bg-red-500/30" : "border-white bg-white/10"
          }`}
          aria-label={liveActive ? "End live" : "Go live"}
        >
          <div className={`rounded-full ${liveActive ? "w-7 h-7 bg-red-500" : "w-[3.5rem] h-[3.5rem] bg-red-500"}`} />
        </button>
        <p className="mt-3 text-xs font-bold text-white/70">
          {liveActive ? "Tap to end live" : "Round Go Live"}
        </p>
      </div>

      <EnhancePanel
        open={showEnhance}
        tab={enhanceTab}
        onTabChange={setEnhanceTab}
        onClose={() => setShowEnhance(false)}
        filterIntensity={filterIntensity}
        onFilterIntensityChange={setFilterIntensity}
      />

      <EffectsPanel
        open={showEffects}
        category={effectCategory}
        onCategoryChange={setEffectCategory}
        onClose={() => setShowEffects(false)}
        selectedId={selectedEffect}
        onSelect={setSelectedEffect}
      />

      <CreateModeTabs value={createMode} onChange={onModeChange} disabled={liveActive} />
    </div>
  );
}
