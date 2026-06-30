import { useEffect, useRef, useState, useCallback } from "react";
import { X, SwitchCamera, ImagePlus } from "lucide-react";
import {
  warmCameraStream,
  releaseCameraStream,
  capturePhotoFromStream,
  createVideoRecorder,
  pickVideoRecorderMimeType,
  streamHasLiveAudio,
  fileExtensionForMime,
} from "@/lib/create-camera";


interface Props {
  mode: "photo" | "video";
  onModeChange: (mode: "photo" | "video") => void;
  onClose: () => void;
  onCapture: (file: File, mediaType: "image" | "video") => void;
  onOpenGallery: () => void;
  /** Pre-warmed from + button tap — opens camera instantly on iOS */
  initialStream?: MediaStream | null;
}

export default function CreateCameraView({
  mode,
  onModeChange,
  onClose,
  onCapture,
  onOpenGallery,
  initialStream,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [denied, setDenied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [micMissing, setMicMissing] = useState(false);

  const stopStream = useCallback((forceRelease = false) => {
    if (ownsStreamRef.current || forceRelease) {
      releaseCameraStream(streamRef.current);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      try { videoRef.current.load(); } catch { /* ignore */ }
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
        // Inherit ownership of the pre-warmed stream so we can stop it on unmount/capture
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

  const flipCamera = () => {
    stopStream(true);
    setFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || !ready) return;

    const blob = await capturePhotoFromStream(stream, video, {
      mirror: facing === "user",
    });
    if (!blob) return;

    stopStream(true);
    onCapture(
      new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }),
      "image",
    );
  };

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
          new File([blob], `video-${Date.now()}.${ext}`, {
            type: blob.type,
          }),
          "video",
        );
      };

      rec.start(250);
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec?.state === "recording") {
      try {
        rec.requestData();
      } catch {
        /* ignore */
      }
      rec.stop();
    }
  };

  const handleShutter = () => {
    if (mode === "photo") {
      void takePhoto();
    } else if (recording) {
      stopRecording();
    } else {
      void startRecording();
    }
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

        <div className="w-11 h-11" aria-hidden />

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

      <div className="relative z-20 mt-auto pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="flex justify-center gap-6 mb-5">
          {(["video", "photo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              disabled={recording}
              className={`text-xs font-black tracking-widest px-4 py-1.5 rounded-full transition-all disabled:opacity-40 ${
                mode === m ? "bg-white text-black scale-105" : "text-white/60"
              }`}
            >
              {m === "video" ? "VIDEO" : "PHOTO"}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-12 px-8">
          <button
            type="button"
            onClick={onOpenGallery}
            disabled={recording}
            className="w-12 h-12 rounded-xl border-2 border-white bg-zinc-900/60 flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-40"
            aria-label="Gallery"
          >
            <ImagePlus className="w-6 h-6 text-white" />
          </button>

          <button
            type="button"
            onClick={handleShutter}
            disabled={denied || !ready}
            className={`w-[5.25rem] h-[5.25rem] rounded-full border-[5px] flex items-center justify-center transition-all disabled:opacity-40 shadow-[0_0_24px_rgba(255,255,255,0.25)] ${
              recording
                ? "border-red-500 bg-red-500/20"
                : "border-white bg-white/10"
            }`}
            aria-label={
              mode === "photo"
                ? "Take photo"
                : recording
                  ? "Stop recording"
                  : "Record video"
            }
          >
            {recording ? (
              <div className="w-7 h-7 rounded-md bg-red-500" />
            ) : (
              <div className="w-[4.25rem] h-[4.25rem] rounded-full bg-white" />
            )}
          </button>

          <div className="w-12 h-12" aria-hidden />
        </div>

        {recording && (
          <p className="text-center text-red-400 text-sm font-bold mt-4 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording…
          </p>
        )}
      </div>
    </div>
  );
}
