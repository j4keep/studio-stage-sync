import { useEffect, useRef, useState, useCallback } from "react";
import { X, SwitchCamera, Sparkles, Wand2, Camera, Type, Music } from "lucide-react";
import {
  warmCameraStream,
  releaseCameraStream,
  createVideoRecorder,
  pickVideoRecorderMimeType,
  streamHasLiveAudio,
  streamHasLiveVideo,
  fileExtensionForMime,
  ensureStreamHasAudio,
  createMirroredVideoRecordStream,
  shouldMirrorRecordOutput,
  capturePhotoFromStream,
} from "@/lib/create-camera";
import type { CreateMode, EnhanceTab } from "@/lib/create-modes";
import { QUICK_MAX_RECORD_SEC, getEffectFilter } from "@/lib/create-modes";
import { boostMediaElementLoudness, createTrimmedMusicPlayer, CAMERA_ADDED_SOUND_MONITOR_VOLUME, type MusicTrim } from "@/lib/post-music-preview";
import { armFeedAudioPlayback, forceIosAudioSessionToPlayback, resetIosAudioSessionToPlayback } from "@/lib/feed-video-playback";
import CreateModeTabs from "./CreateModeTabs";
import RecordButton from "./RecordButton";
import EnhancePanel from "./EnhancePanel";
import EffectsPanel from "./EffectsPanel";
import { toast } from "sonner";

const MIN_RECORD_MS = 400;

interface Props {
  onClose: () => void;
  onCapture: (file: File, mediaType: "image" | "video", visualEffect?: string) => void;
  onOpenGallery: () => void;
  onTextPost: () => void;
  initialStream?: MediaStream | null;
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  onAddSound?: () => void;
  soundLabel?: string;
  musicPreviewUrl?: string | null;
  musicTrim?: MusicTrim;
  musicPaused?: boolean;
  onRegisterMusicPlay?: (play: (() => Promise<boolean>) | null) => void;
  /** "hold" (Reel) = press-and-hold with a max; "tap" (Post) = tap to start/stop. */
  recordMode?: "hold" | "tap";
  /** Max recording seconds. null = unlimited. */
  maxRecordSec?: number | null;
}

export default function CreateCameraView({
  onClose,
  onCapture,
  onOpenGallery,
  onTextPost,
  initialStream,
  createMode,
  onModeChange,
  onAddSound,
  soundLabel,
  musicPreviewUrl,
  musicTrim,
  musicPaused = false,
  onRegisterMusicPlay,
  recordMode = "hold",
  maxRecordSec = QUICK_MAX_RECORD_SEC,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const recordPendingRef = useRef(false);
  const mirrorRecordStopRef = useRef<(() => void) | null>(null);
  const wantsRecordRef = useRef(false);
  const discardClipRef = useRef(false);
  const recordingRef = useRef(false);
  const finishRecordingRef = useRef<() => void>(() => {});
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const cameraMusicStopRef = useRef<(() => void) | null>(null);
  const cameraMusicPlayerRef = useRef<ReturnType<typeof createTrimmedMusicPlayer> | null>(null);
  const cameraMusicSessionRef = useRef<(() => void) | null>(null);
  const lipSyncModeRef = useRef(!!musicPreviewUrl);
  const recordStartedAtRef = useRef<number | null>(null);
  const isStoppingRecordingRef = useRef(false);
  const cameraStoppedForSoundPickerRef = useRef(false);

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
      const stream = await warmCameraStream(facing, { withAudio: true });
      if (!stream) throw new Error("denied");
      ownsStreamRef.current = true;
      await attachStream(stream);
    } catch {
      setDenied(true);
    } finally {
      setStarting(false);
    }
  }, [facing, attachStream, stopStream, musicPreviewUrl]);

  const ensureLiveCamera = useCallback(() => {
    if (streamHasLiveVideo(streamRef.current)) return;
    void startCamera();
  }, [startCamera]);

  useEffect(() => {
    const stopForGallery = () => {
      stopStream(true);
    };
    window.addEventListener("jhi-stop-create-camera", stopForGallery);
    return () => {
      window.removeEventListener("jhi-stop-create-camera", stopForGallery);
    };
  }, [stopStream]);

  useEffect(() => {
    let cancelled = false;


    (async () => {
      if (initialStream && streamHasLiveVideo(initialStream) && !cancelled) {
        ownsStreamRef.current = false;
        await attachStream(initialStream);
        return;
      }

      if (!cancelled) {
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
    recordingRef.current = recording;
  }, [recording]);

  /** Stop camera/mic while Add Sound is open so iOS does not duck speaker volume. */
  useEffect(() => {
    const stream = streamRef.current;
    const video = videoRef.current;

    if (musicPaused) {
      cameraStoppedForSoundPickerRef.current = true;
      stopStream(true);
      void resetIosAudioSessionToPlayback();
      return;
    }

    if (cameraStoppedForSoundPickerRef.current && !streamHasLiveVideo(stream)) {
      cameraStoppedForSoundPickerRef.current = false;
      void startCamera();
      return;
    }

    cameraStoppedForSoundPickerRef.current = false;

    if (!stream || !ready) return;

    for (const track of stream.getVideoTracks()) {
      track.enabled = true;
    }
    if (video?.paused) {
      void video.play().catch(() => {});
    }

    void ensureStreamHasAudio(stream).then((ok) => setMicMissing(!ok));
  }, [musicPaused, ready, startCamera, stopStream]);

  /** Keep track of added-sound mode without rebuilding the camera stream. */
  useEffect(() => {
    const lipSync = !!musicPreviewUrl;
    lipSyncModeRef.current = lipSync;
  }, [musicPreviewUrl]);

  const armCameraMusic = useCallback(
    (media: HTMLMediaElement) => {
      forceIosAudioSessionToPlayback();
      boostMediaElementLoudness(media, 1.9);
      cameraMusicSessionRef.current?.();
      cameraMusicSessionRef.current = armFeedAudioPlayback(
        media,
        { title: soundLabel || "Added sound" },
        CAMERA_ADDED_SOUND_MONITOR_VOLUME,
      );
    },
    [soundLabel],
  );

  const playCameraMusic = useCallback(async (): Promise<boolean> => {
    const player = cameraMusicPlayerRef.current;
    if (!player) return false;
    armCameraMusic(player.audio);
    return player.play();
  }, [armCameraMusic]);

  useEffect(() => {
    cameraMusicSessionRef.current?.();
    cameraMusicSessionRef.current = null;
    cameraMusicStopRef.current?.();
    cameraMusicStopRef.current = null;
    cameraMusicPlayerRef.current = null;
    onRegisterMusicPlay?.(null);

    if (!musicPreviewUrl || !ready || musicPaused) return;

    const player = createTrimmedMusicPlayer(musicPreviewUrl, {
      ...(musicTrim ?? {}),
      volume: CAMERA_ADDED_SOUND_MONITOR_VOLUME,
    });
    cameraMusicStopRef.current = player.stop;
    cameraMusicPlayerRef.current = player;
    onRegisterMusicPlay?.(() => playCameraMusic());

    return () => {
      cameraMusicSessionRef.current?.();
      cameraMusicSessionRef.current = null;
      player.stop();
      cameraMusicStopRef.current = null;
      cameraMusicPlayerRef.current = null;
      onRegisterMusicPlay?.(null);
    };
  }, [
    musicPreviewUrl,
    ready,
    musicTrim?.trimStart,
    musicTrim?.trimEnd,
    musicTrim?.sourceDurationSec,
    onRegisterMusicPlay,
    musicPaused,
    playCameraMusic,
  ]);

  useEffect(() => {
    return () => {
      cameraMusicSessionRef.current?.();
      cameraMusicSessionRef.current = null;
      cameraMusicStopRef.current?.();
      cameraMusicStopRef.current = null;
    };
  }, []);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const detachPointerEndListeners = useCallback(() => {
    pointerCleanupRef.current?.();
    pointerCleanupRef.current = null;
  }, []);

  const attachPointerEndListeners = useCallback(() => {
    detachPointerEndListeners();
    const onEnd = () => {
      wantsRecordRef.current = false;
      detachPointerEndListeners();
      if (recordingRef.current && !isStoppingRecordingRef.current) {
        finishRecordingRef.current();
      } else {
        recordPendingRef.current = false;
      }
    };
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
    pointerCleanupRef.current = () => {
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
    };
  }, [detachPointerEndListeners]);

  useEffect(() => {
    return () => {
      clearProgressTimer();
      detachPointerEndListeners();
      mirrorRecordStopRef.current?.();
      mirrorRecordStopRef.current = null;
    };
  }, [detachPointerEndListeners]);

  const flipCamera = () => {
    if (recording || capturingPhoto) return;
    stopStream(true);
    setFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const resetRecordingUi = () => {
    clearProgressTimer();
    recordStartRef.current = null;
    recordStartedAtRef.current = null;
    recordPendingRef.current = false;
    setRecordProgress(0);
    setRecording(false);
  };

  const finishRecording = useCallback(() => {
    wantsRecordRef.current = false;
    detachPointerEndListeners();
    clearProgressTimer();

    if (isStoppingRecordingRef.current) return;

    const rec = recorderRef.current;
    if (rec?.state === "recording") {
      isStoppingRecordingRef.current = true;
      try {
        rec.requestData();
      } catch {
        /* ignore */
      }
      rec.stop();
      return;
    }

    // Never stop the mirror stream here — onstop owns teardown. Stopping early
    // truncates max-length clips to a single frame when auto-stop races pointer-up.
    if (!recorderRef.current) {
      resetRecordingUi();
    }
  }, [detachPointerEndListeners]);

  useEffect(() => {
    finishRecordingRef.current = finishRecording;
  }, [finishRecording]);

  const startRecording = async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || recordingRef.current || !wantsRecordRef.current) return;

    recordPendingRef.current = true;
    const lipSyncMode = !!musicPreviewUrl;

    if (!streamHasLiveAudio(stream)) {
      const ok = await ensureStreamHasAudio(stream);
      setMicMissing(!ok);
    }

    if (!wantsRecordRef.current) {
      recordPendingRef.current = false;
      return;
    }

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
        const elapsedMs = recordStartedAtRef.current
          ? Date.now() - recordStartedAtRef.current
          : 0;
        const shouldDiscard = discardClipRef.current;

        mirrorRecordStopRef.current?.();
        mirrorRecordStopRef.current = null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        discardClipRef.current = false;
        recorderRef.current = null;
        isStoppingRecordingRef.current = false;
        recordStartedAtRef.current = null;
        resetRecordingUi();

        if (shouldDiscard) {
          ensureLiveCamera();
          return;
        }

        if (elapsedMs < MIN_RECORD_MS || blob.size < 800) {
          toast.message("Hold the button to record a short");
          ensureLiveCamera();
          return;
        }

        const capturedFile = new File([blob], `short-${Date.now()}.${ext}`, {
          type: blob.type || mime,
        });

        void resetIosAudioSessionToPlayback().finally(() => {
          onCapture(capturedFile, "video", selectedEffect);
        });
      };

      rec.onerror = () => {
        toast.error("Recording failed — try again");
        discardClipRef.current = true;
        finishRecordingRef.current();
      };

      if (lipSyncMode && cameraMusicPlayerRef.current) {
        const audio = cameraMusicPlayerRef.current.audio;
        try {
          audio.pause();
          audio.currentTime = musicTrim?.trimStart ?? 0;
        } catch {
          /* ignore */
        }

        armCameraMusic(audio);
        await cameraMusicPlayerRef.current.play();
      }

      rec.start(100);

      recordPendingRef.current = false;
      setRecording(true);
      const startedAt = Date.now();
      recordStartedAtRef.current = startedAt;
      recordStartRef.current = startedAt;
      setRecordProgress(0);

      progressTimerRef.current = window.setInterval(() => {
        if (!recordStartedAtRef.current) return;
        const elapsed = (Date.now() - recordStartedAtRef.current) / 1000;
        if (maxRecordSec == null) {
          // Unlimited (Post/Create mode) — just advance the readout.
          setRecordProgress((elapsed % 60) / 60);
          return;
        }
        const progress = Math.min(1, elapsed / maxRecordSec);
        setRecordProgress(progress);
        if (progress >= 1) {
          setRecordProgress(1);
          wantsRecordRef.current = false;
          finishRecordingRef.current();
        }
      }, 50);
    } catch {
      mirrorRecordStopRef.current?.();
      mirrorRecordStopRef.current = null;
      recordPendingRef.current = false;
      setRecording(false);
      clearProgressTimer();
      toast.error("Couldn't start recording");
    }
  };

  const cancelRecording = () => {
    if (!recording && !recordPendingRef.current) return;
    discardClipRef.current = true;
    wantsRecordRef.current = false;
    recordPendingRef.current = false;
    detachPointerEndListeners();

    if (recorderRef.current?.state === "recording") {
      finishRecordingRef.current();
      return;
    }

    resetRecordingUi();
    ensureLiveCamera();
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || !ready || capturingPhoto || recording) return;

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
        selectedEffect,
      );
      stopStream(true);
    } catch {
      toast.error("Photo capture failed");
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleRecordDown = (e: React.PointerEvent) => {
    if (denied || !ready || capturingPhoto) return;

    // Tap-to-toggle mode (Post): first press starts, next press stops.
    if (recordMode === "tap") {
      e.preventDefault();
      e.stopPropagation();
      if (recording || recordPendingRef.current) {
        wantsRecordRef.current = false;
        if (recordingRef.current && !isStoppingRecordingRef.current) {
          finishRecordingRef.current();
        }
        return;
      }
      wantsRecordRef.current = true;
      discardClipRef.current = false;
      void startRecording();
      return;
    }

    if (recording || recordPendingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    wantsRecordRef.current = true;
    discardClipRef.current = false;
    attachPointerEndListeners();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    void startRecording();
  };

  const handleRecordUp = (e: React.PointerEvent) => {
    if (recordMode === "tap") return; // ignore release in tap-toggle mode
    wantsRecordRef.current = false;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (recordingRef.current && !isStoppingRecordingRef.current) {
      finishRecordingRef.current();
    } else {
      recordPendingRef.current = false;
    }
    detachPointerEndListeners();
  };

  const recordDisabled = denied || !ready || capturingPhoto;
  const liveFilter = getEffectFilter(selectedEffect);


  return (
    <div className="absolute inset-0 bg-black flex flex-col touch-none">
      {!denied && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          style={{
            transform: facing === "user" ? "scaleX(-1)" : undefined,
            filter: liveFilter,
          }}
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

      {micMissing && ready && !recording && !musicPreviewUrl && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+3.5rem)] left-4 right-4 z-30 px-4 py-2 rounded-xl bg-amber-500/90 text-black text-xs font-semibold text-center">
          Microphone not detected — video will record without sound.
        </div>
      )}

      <div className="relative z-20 px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-1">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-white drop-shadow-lg"
            aria-label="Close and discard"
          >
            <X className="w-6 h-6" strokeWidth={2.5} />
          </button>

          <button
            type="button"
            onClick={flipCamera}
            disabled={denied || !ready || recording || capturingPhoto}
            className="w-10 h-10 flex items-center justify-center text-white drop-shadow-lg disabled:opacity-30"
            aria-label="Flip camera"
          >
            <SwitchCamera className="w-6 h-6" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={onAddSound}
            disabled={!onAddSound || recording}
            className="max-w-[min(72vw,16rem)] px-4 py-1.5 rounded-full bg-black/40 border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Music className="w-3.5 h-3.5 shrink-0 text-primary" />
            <span className="truncate">{soundLabel || "Add sound"}</span>
          </button>
          {recording && (
            <div className="min-w-[3rem] px-2.5 py-1 rounded-lg bg-red-500 text-white text-sm font-bold tabular-nums text-center shadow-lg">
              {(() => {
                const totalSec =
                  maxRecordSec == null
                    ? Math.floor(((recordStartedAtRef.current ? Date.now() - recordStartedAtRef.current : 0) / 1000))
                    : Math.floor(maxRecordSec * recordProgress);
                return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setShowEffects(false);
            setShowEnhance((v) => !v);
          }}
          className={`flex flex-col items-center gap-0.5 ${showEnhance ? "text-white" : "text-white/80"}`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[9px] font-semibold">Enhance</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setShowEnhance(false);
            setShowEffects((v) => !v);
          }}
          className={`flex flex-col items-center gap-0.5 ${showEffects ? "text-white" : "text-white/80"}`}
        >
          <Wand2 className="w-5 h-5" />
          <span className="text-[9px] font-semibold">Effects</span>
        </button>
      </div>

      <div className="relative z-20 mt-auto pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+2rem)]">
        <div className="relative z-10 flex items-end justify-center gap-7 px-5">
          {recording ? (
            <button
              type="button"
              onClick={cancelRecording}
              className="mb-[2.35rem] px-4 py-2 rounded-full bg-black/45 border border-white/20 text-white text-sm font-semibold active:scale-95 transition-transform"
            >
              Undo
            </button>
          ) : (
            <button
              type="button"
              disabled={recordDisabled}
              onClick={() => void takePhoto()}
              className="flex flex-col items-center gap-1.5 w-[3.25rem] mb-3 disabled:opacity-40 active:scale-95 transition-transform"
            >
              <span className="w-11 h-11 rounded-full border-2 border-white/80 bg-black/30 flex items-center justify-center">
                <Camera className="w-[1.2rem] h-[1.2rem] text-white" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold text-white/70">Photo</span>
            </button>
          )}

          <div className="flex flex-col items-center">
            <RecordButton
              recording={recording}
              progress={recordProgress}
              disabled={recordDisabled}
              onPointerDown={handleRecordDown}
              onPointerUp={handleRecordUp}
            />
            {!recording && (
              <span className="mt-1.5 text-[10px] font-medium text-white/40">
                {recordMode === "tap" ? "Tap · unlimited" : "Hold · 60s max"}
              </span>
            )}
          </div>

          {!recording ? (
            <button
              type="button"
              disabled={capturingPhoto}
              onClick={onTextPost}
              className="flex flex-col items-center gap-1.5 w-[3.25rem] mb-3 disabled:opacity-40 active:scale-95 transition-transform"
            >
              <span className="w-11 h-11 rounded-full border-2 border-white/80 bg-black/30 flex items-center justify-center">
                <Type className="w-[1.2rem] h-[1.2rem] text-white" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-semibold text-white/70">Text</span>
            </button>
          ) : (
            <span className="w-[3.25rem] mb-3" aria-hidden />
          )}
        </div>
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
