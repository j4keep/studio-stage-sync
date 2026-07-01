import { useEffect, useRef, useState, useCallback } from "react";
import { X, SwitchCamera, ImagePlus, Sparkles, Wand2 } from "lucide-react";
import {
  warmCameraStream,
  releaseCameraStream,
  createVideoRecorder,
  pickVideoRecorderMimeType,
  streamHasLiveAudio,
  fileExtensionForMime,
} from "@/lib/create-camera";
import type { CreateMode, EnhanceTab, ShortDuration } from "@/lib/create-modes";
import { SHORT_DURATIONS } from "@/lib/create-modes";
import CreateModeTabs from "./CreateModeTabs";
import RecordButton from "./RecordButton";
import EnhancePanel from "./EnhancePanel";
import EffectsPanel from "./EffectsPanel";

interface Props {
  onClose: () => void;
  onCapture: (file: File, mediaType: "image" | "video") => void;
  onOpenGallery: () => void;
  initialStream?: MediaStream | null;
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  durationSec: ShortDuration;
  onDurationChange: (d: ShortDuration) => void;
}

export default function CreateCameraView({
  onClose,
  onCapture,
  onOpenGallery,
  initialStream,
  createMode,
  onModeChange,
  durationSec,
  onDurationChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const holdingRef = useRef(false);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [denied, setDenied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [micMissing, setMicMissing] = useState(false);
  const [showEnhance, setShowEnhance] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [enhanceTab, setEnhanceTab] = useState<EnhanceTab>("Appearance");
  const [effectCategory, setEffectCategory] = useState("Trending");
  const [selectedEffect, setSelectedEffect] = useState("none");
  const [filterIntensity, setFilterIntensity] = useState(80);

  const stopStream = useCallback((forceRelease = false) => {
    if (ownsStreamRef.current || forceRelease) {
      releaseCameraStream(streamRef.current);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      try {
        videoRef.current.load();
      } catch {
        /* ignore */
      }
    }
    streamRef.current = null;
    setReady(false);
  }, []);

  const attachStream = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;

    const video = videoRef.current;
    if (video) {
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.srcObject = stream;
      await video.play();

      if (!video.videoWidth) {
        await new Promise<void>((resolve) => {
          video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        });
      }
    }

    setReady(true);
    setDenied(false);
    setMicMissing(!streamHasLiveAudio(stream));
  }, []);

  const startCamera = useCallback(async () => {
    stopStream(true);
    setStarting(true);
    setDenied(false);
    setReady(false);

    try {
      const stream = await warmCameraStream(facing);
      if (!stream) throw new Error("denied");
      ownsStreamRef.current = true;
      await attachStream(stream);
    } catch {
      setDenied(true);
    } finally {
      setStarting(false);
    }
  }, [facing, attachStream, stopStream]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (initialStream && !cancelled) {
        ownsStreamRef.current = true;
        await attachStream(initialStream);
        return;
      }

      if (!initialStream && !cancelled) {
        ownsStreamRef.current = true;
        await startCamera();
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const facingReady = useRef(false);

  useEffect(() => {
    if (!facingReady.current) {
      facingReady.current = true;
      return;
    }
    void startCamera();
  }, [facing, startCamera]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    };
  }, []);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const flipCamera = () => {
    if (recording) return;
    stopStream(true);
    setFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const finishRecording = useCallback(() => {
    clearProgressTimer();
    recordStartRef.current = null;
    holdingRef.current = false;
    setRecordProgress(0);

    const rec = recorderRef.current;
    if (rec?.state === "recording") {
      try {
        rec.requestData();
      } catch {
        /* ignore */
      }
      rec.stop();
    } else {
      setRecording(false);
    }
  }, []);

  const startRecording = async () => {
    let stream = streamRef.current;
    if (!stream || recording) return;

    if (!streamHasLiveAudio(stream)) {
      const fresh = await warmCameraStream(facing);
      if (fresh && streamHasLiveAudio(fresh)) {
        stopStream(true);
        ownsStreamRef.current = true;
        await attachStream(fresh);
        stream = fresh;
        setMicMissing(false);
      } else {
        setMicMissing(true);
        return;
      }
    }

    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

    chunksRef.current = [];

    try {
      const rec = createVideoRecorder(stream, pickVideoRecorderMimeType());
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const mime = rec.mimeType || pickVideoRecorderMimeType() || "video/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = fileExtensionForMime(mime);

        setRecording(false);
        stopStream(true);
        recorderRef.current = null;
        onCapture(
          new File([blob], `short-${Date.now()}.${ext}`, {
            type: blob.type,
          }),
          "video",
        );
      };

      rec.start(250);
      setRecording(true);
      recordStartRef.current = Date.now();
      setRecordProgress(0);

      progressTimerRef.current = window.setInterval(() => {
        if (!recordStartRef.current) return;
        const elapsed = (Date.now() - recordStartRef.current) / 1000;
        const progress = Math.min(1, elapsed / durationSec);
        setRecordProgress(progress);
        if (progress >= 1) {
          finishRecording();
        }
      }, 50);
    } catch {
      setRecording(false);
      clearProgressTimer();
    }
  };

  const handleRecordDown = (e: React.PointerEvent) => {
    if (denied || !ready || recording) return;
    e.preventDefault();
    holdingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    void startRecording();
  };

  const handleRecordUp = (e: React.PointerEvent) => {
    if (!holdingRef.current && !recording) return;
    e.preventDefault();
    holdingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (recording) finishRecording();
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

      {denied && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center z-10">
          <p className="text-white text-base font-semibold">Camera access needed</p>
          <p className="text-white/60 text-sm">
            Allow camera in Settings, or upload from your library.
          </p>
          <button
            type="button"
            onClick={onOpenGallery}
            className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm"
          >
            Open gallery
          </button>
        </div>
      )}

      {starting && !ready && !denied && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
          <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {micMissing && ready && !recording && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+3.5rem)] left-4 right-4 z-30 px-4 py-2 rounded-xl bg-amber-500/90 text-black text-xs font-semibold text-center">
          Microphone not detected — check browser permissions and try flipping the camera.
        </div>
      )}

      <div className="relative z-20 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center text-white drop-shadow-lg"
          aria-label="Close"
        >
          <X className="w-7 h-7" strokeWidth={2.5} />
        </button>

        <button
          type="button"
          className="px-4 py-1.5 rounded-full bg-black/40 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          Add sound
        </button>

        <button
          type="button"
          onClick={flipCamera}
          disabled={denied || !ready || recording}
          className="w-11 h-11 flex items-center justify-center text-white drop-shadow-lg disabled:opacity-30"
          aria-label="Flip camera"
        >
          <SwitchCamera className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>

      <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+4rem)] z-20 flex flex-col items-center gap-4">
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
      </div>

      <div className="relative z-20 mt-auto pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+2.75rem)]">
        <div className="flex justify-center gap-2 mb-4 px-4 overflow-x-auto scrollbar-hide">
          {SHORT_DURATIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={recording}
              onClick={() => onDurationChange(sec)}
              className={`shrink-0 text-xs font-black tracking-widest px-4 py-1.5 rounded-full transition-all disabled:opacity-40 ${
                durationSec === sec ? "bg-white text-black scale-105" : "text-white/60"
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>

        <div className="flex items-end justify-center gap-10 px-8">
          <button
            type="button"
            onClick={onOpenGallery}
            disabled={recording}
            className="w-12 h-12 rounded-xl border-2 border-white bg-zinc-900/60 flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-40 mb-4"
            aria-label="Gallery"
          >
            <ImagePlus className="w-6 h-6 text-white" />
          </button>

          <RecordButton
            recording={recording}
            progress={recordProgress}
            disabled={denied || !ready}
            label={`Hold · ${durationSec}s max`}
            onPointerDown={handleRecordDown}
            onPointerUp={handleRecordUp}
            onPointerLeave={handleRecordUp}
          />

          <div className="w-12 h-12 mb-4" aria-hidden />
        </div>

        {recording && (
          <p className="text-center text-red-400 text-sm font-bold mt-1 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {Math.ceil(durationSec * (1 - recordProgress))}s left
          </p>
        )}
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

      <CreateModeTabs value={createMode} onChange={onModeChange} disabled={recording} />
    </div>
  );
}
