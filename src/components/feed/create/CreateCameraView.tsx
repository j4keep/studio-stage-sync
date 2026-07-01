import { useEffect, useRef, useState, useCallback } from "react";
import { X, SwitchCamera, Sparkles, Wand2 } from "lucide-react";
import {
  warmCameraStream,
  releaseCameraStream,
  createVideoRecorder,
  pickVideoRecorderMimeType,
  streamHasLiveAudio,
  fileExtensionForMime,
  ensureStreamHasAudio,
  createMirroredVideoRecordStream,
  shouldMirrorRecordOutput,
  capturePhotoFromStream,
} from "@/lib/create-camera";
import type { CreateMode, EnhanceTab, QuickCaptureKind } from "@/lib/create-modes";
import { QUICK_CAPTURE_OPTIONS, isVideoCaptureKind } from "@/lib/create-modes";
import CreateModeTabs from "./CreateModeTabs";
import RecordButton from "./RecordButton";
import EnhancePanel from "./EnhancePanel";
import EffectsPanel from "./EffectsPanel";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  onCapture: (file: File, mediaType: "image" | "video") => void;
  onOpenGallery: () => void;
  onTextPost: () => void;
  initialStream?: MediaStream | null;
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  durationSec: number;
  onDurationChange: (d: 15 | 30 | 60) => void;
}

const RING_RADIUS = 96;

export default function CreateCameraView({
  onClose,
  onCapture,
  onOpenGallery,
  onTextPost,
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
  const pointerDownRef = useRef(false);
  const recordPendingRef = useRef(false);
  const mirrorRecordStopRef = useRef<(() => void) | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [denied, setDenied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
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
  const [captureKind, setCaptureKind] = useState<QuickCaptureKind>(durationSec as QuickCaptureKind);

  const activeDuration = isVideoCaptureKind(captureKind) ? captureKind : durationSec;

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
      mirrorRecordStopRef.current?.();
      mirrorRecordStopRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isVideoCaptureKind(captureKind)) {
      onDurationChange(captureKind);
    }
  }, [captureKind, onDurationChange]);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const flipCamera = () => {
    if (recording || capturingPhoto) return;
    stopStream(true);
    setFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const finishRecording = useCallback(() => {
    clearProgressTimer();
    recordStartRef.current = null;
    pointerDownRef.current = false;
    recordPendingRef.current = false;
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
      mirrorRecordStopRef.current?.();
      mirrorRecordStopRef.current = null;
      setRecording(false);
    }
  }, []);

  const startRecording = async () => {
    const video = videoRef.current;
    let stream = streamRef.current;
    if (!video || !stream || recording || !isVideoCaptureKind(captureKind)) return;

    recordPendingRef.current = true;

    const hasAudio = await ensureStreamHasAudio(stream);
    if (!hasAudio) {
      recordPendingRef.current = false;
      setMicMissing(true);
      return;
    }
    setMicMissing(false);

    if (!pointerDownRef.current) {
      recordPendingRef.current = false;
      return;
    }

    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

    chunksRef.current = [];
    mirrorRecordStopRef.current?.();
    mirrorRecordStopRef.current = null;

    const { stream: recordStream, stop: stopMirror } = createMirroredVideoRecordStream(
      stream,
      video,
      shouldMirrorRecordOutput(facing),
    );
    mirrorRecordStopRef.current = stopMirror;

    try {
      const rec = createVideoRecorder(recordStream, pickVideoRecorderMimeType());
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const mime = rec.mimeType || pickVideoRecorderMimeType() || "video/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = fileExtensionForMime(mime);

        mirrorRecordStopRef.current?.();
        mirrorRecordStopRef.current = null;
        setRecording(false);
        recordPendingRef.current = false;
        recorderRef.current = null;

        onCapture(
          new File([blob], `short-${Date.now()}.${ext}`, {
            type: blob.type,
          }),
          "video",
        );
        stopStream(true);
      };

      rec.start(250);
      recordPendingRef.current = false;
      setRecording(true);
      recordStartRef.current = Date.now();
      setRecordProgress(0);

      progressTimerRef.current = window.setInterval(() => {
        if (!recordStartRef.current) return;
        const elapsed = (Date.now() - recordStartRef.current) / 1000;
        const progress = Math.min(1, elapsed / activeDuration);
        setRecordProgress(progress);
        if (progress >= 1) {
          finishRecording();
        }
      }, 50);

      if (!pointerDownRef.current) {
        finishRecording();
      }
    } catch {
      mirrorRecordStopRef.current?.();
      mirrorRecordStopRef.current = null;
      recordPendingRef.current = false;
      setRecording(false);
      clearProgressTimer();
    }
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || !ready || capturingPhoto) return;

    setCapturingPhoto(true);
    try {
      const blob = await capturePhotoFromStream(stream, video, {
        mirror: facing === "user",
      });
      if (!blob) {
        toast.error("Couldn't capture photo — try again");
        return;
      }
      onCapture(
        new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }),
        "image",
      );
      stopStream(true);
    } catch {
      toast.error("Photo capture failed");
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleCenterTap = () => {
    if (captureKind === "text") {
      onTextPost();
      return;
    }
    if (captureKind === "photo") {
      void takePhoto();
    }
  };

  const handleRecordDown = (e: React.PointerEvent) => {
    if (denied || !ready || recording || recordPendingRef.current || !isVideoCaptureKind(captureKind)) return;
    e.preventDefault();
    pointerDownRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    void startRecording();
  };

  const handleRecordUp = (e: React.PointerEvent) => {
    pointerDownRef.current = false;
    if (recordPendingRef.current) return;

    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (recording) finishRecording();
  };

  const recordMode =
    captureKind === "photo" ? "tap-photo" : captureKind === "text" ? "tap-text" : "hold";

  const recordLabel =
    captureKind === "photo"
      ? "Tap to snap"
      : captureKind === "text"
        ? "Tap to write"
        : `Hold · ${activeDuration}s max`;

  const centerDisabled = denied || !ready || recording || capturingPhoto;

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

      {capturingPhoto && (
        <div className="absolute inset-0 z-20 bg-white/20 pointer-events-none animate-pulse" aria-hidden />
      )}

      {micMissing && ready && !recording && isVideoCaptureKind(captureKind) && (
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
          disabled={denied || !ready || recording || capturingPhoto || captureKind === "text"}
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
          disabled={captureKind === "text"}
          className={`flex flex-col items-center gap-1 disabled:opacity-30 ${showEnhance ? "text-white" : "text-white/80"}`}
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
          disabled={captureKind === "text"}
          className={`flex flex-col items-center gap-1 disabled:opacity-30 ${showEffects ? "text-white" : "text-white/80"}`}
        >
          <Wand2 className="w-6 h-6" />
          <span className="text-[9px] font-semibold">Effects</span>
        </button>
      </div>

      <div className="relative z-20 mt-auto pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+2.75rem)]">
        {captureKind === "text" && (
          <div className="absolute inset-0 -top-[50vh] bg-gradient-to-b from-black/80 via-black/60 to-transparent pointer-events-none z-10" />
        )}

        <div className="relative mx-auto mb-2 z-20" style={{ width: 280, height: 280 }}>
          {QUICK_CAPTURE_OPTIONS.map((opt, i) => {
            const angleDeg = -90 + i * (360 / QUICK_CAPTURE_OPTIONS.length);
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = Math.cos(angleRad) * RING_RADIUS;
            const y = Math.sin(angleRad) * RING_RADIUS;
            const selected = captureKind === opt.id;
            return (
              <button
                key={String(opt.id)}
                type="button"
                disabled={recording || capturingPhoto}
                onClick={() => setCaptureKind(opt.id)}
                className={`absolute left-1/2 top-1/2 text-[11px] font-black tracking-wide px-3 py-1.5 rounded-full transition-all disabled:opacity-40 whitespace-nowrap ${
                  selected
                    ? "bg-white text-black scale-110 shadow-[0_0_12px_rgba(255,255,255,0.35)]"
                    : "text-white/60 bg-black/40 border border-white/15"
                }`}
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
              >
                {opt.label}
              </button>
            );
          })}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <RecordButton
              recording={recording}
              progress={recordProgress}
              disabled={captureKind === "text" ? false : centerDisabled}
              mode={recordMode}
              label={recordLabel}
              onPointerDown={handleRecordDown}
              onPointerUp={handleRecordUp}
              onTap={handleCenterTap}
            />
          </div>
        </div>

        {recording && (
          <p className="text-center text-red-400 text-sm font-bold mt-1 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {Math.ceil(activeDuration * (1 - recordProgress))}s left
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

      <CreateModeTabs
        value={createMode}
        onChange={onModeChange}
        disabled={recording || capturingPhoto}
        onOpenGallery={onOpenGallery}
      />
    </div>
  );
}
