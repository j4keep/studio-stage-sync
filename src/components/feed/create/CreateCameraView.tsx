import { useEffect, useRef, useState, useCallback } from "react";
import { X, SwitchCamera, ImagePlus, Music } from "lucide-react";

const isIOS =
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/.test(navigator.userAgent);

interface Props {
  mode: "photo" | "video";
  onModeChange: (mode: "photo" | "video") => void;
  onClose: () => void;
  onCapture: (file: File, mediaType: "image" | "video") => void;
  onOpenGallery: () => void;
  onAddSound: () => void;
  soundLabel?: string;
}

export default function CreateCameraView({
  mode,
  onModeChange,
  onClose,
  onCapture,
  onOpenGallery,
  onAddSound,
  soundLabel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [denied, setDenied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [needsTap, setNeedsTap] = useState(isIOS);
  const [starting, setStarting] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setStarting(true);
    setDenied(false);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.srcObject = stream;
        await video.play();
      }
      setReady(true);
      setNeedsTap(false);
    } catch {
      setDenied(true);
      setNeedsTap(false);
    } finally {
      setStarting(false);
    }
  }, [facing, stopStream]);

  useEffect(() => {
    if (!needsTap) void startCamera();
    return () => stopStream();
  }, [startCamera, stopStream, needsTap]);

  const flipCamera = () => setFacing((f) => (f === "user" ? "environment" : "user"));

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 1280;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }), "image");
      },
      "image/jpeg",
      0.92,
    );
  };

  const pickRecorderMime = () => {
    const types = ["video/mp4", "video/webm;codecs=vp9", "video/webm", "video/quicktime"];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || recording) return;
    chunksRef.current = [];
    try {
      const mime = pickRecorderMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/mp4" });
        const ext = rec.mimeType.includes("mp4") || rec.mimeType.includes("quicktime") ? "mp4" : "webm";
        stopStream();
        onCapture(new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type || "video/mp4" }), "video");
        setRecording(false);
      };
      rec.start(250);
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const stopRecording = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  const handleShutter = () => {
    if (mode === "photo") void takePhoto();
    else if (recording) stopRecording();
    else startRecording();
  };

  return (
    <div className="absolute inset-0 bg-black flex flex-col touch-none">
      {!denied && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover mirror-front"
          playsInline
          muted
          autoPlay
          style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
        />
      )}

      {denied && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center z-10">
          <p className="text-white text-base font-semibold">Camera access needed</p>
          <p className="text-white/60 text-sm">Allow camera in Settings, or upload from your library.</p>
          <button
            type="button"
            onClick={onOpenGallery}
            className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm"
          >
            Open gallery
          </button>
        </div>
      )}

      {needsTap && !denied && (
        <button
          type="button"
          onClick={() => void startCamera()}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80"
        >
          <div className="w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/20" />
          </div>
          <p className="text-white font-bold text-lg">Tap to open camera</p>
          <p className="text-white/50 text-xs">Front camera · Photo &amp; video</p>
        </button>
      )}

      {starting && !needsTap && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center text-white drop-shadow-lg" aria-label="Close">
          <X className="w-7 h-7" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onAddSound}
          className="flex items-center gap-1.5 max-w-[52%] rounded-full bg-black/50 backdrop-blur-md border border-white/25 px-4 py-2 text-white shadow-lg"
        >
          <Music className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold truncate">{soundLabel || "Add sound"}</span>
        </button>
        <button
          type="button"
          onClick={flipCamera}
          disabled={denied || !ready}
          className="w-11 h-11 flex items-center justify-center text-white drop-shadow-lg disabled:opacity-30"
          aria-label="Flip camera"
        >
          <SwitchCamera className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="relative z-20 mt-auto pb-[max(env(safe-area-inset-bottom),1rem)]">
        {/* Photo / Video mode toggle */}
        <div className="flex justify-center gap-6 mb-5">
          {(["video", "photo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`text-xs font-black tracking-widest px-4 py-1.5 rounded-full transition-all ${
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
            className="w-12 h-12 rounded-xl border-2 border-white bg-zinc-900/60 flex items-center justify-center shadow-lg active:scale-95"
            aria-label="Gallery"
          >
            <ImagePlus className="w-6 h-6 text-white" />
          </button>

          <button
            type="button"
            onClick={handleShutter}
            disabled={denied || !ready || needsTap}
            className={`w-[5.25rem] h-[5.25rem] rounded-full border-[5px] flex items-center justify-center transition-all disabled:opacity-40 shadow-[0_0_24px_rgba(255,255,255,0.25)] ${
              recording ? "border-red-500 bg-red-500/20" : "border-white bg-white/10"
            }`}
            aria-label={mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Record video"}
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
          <p className="text-center text-red-400 text-sm font-bold mt-4 animate-pulse flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Recording…
          </p>
        )}
      </div>
    </div>
  );
}
