import { useEffect, useRef, useState, useCallback } from "react";
import { X, SwitchCamera, ImagePlus, Music } from "lucide-react";

interface Props {
  mode: "photo" | "video";
  onClose: () => void;
  onCapture: (file: File, mediaType: "image" | "video") => void;
  onOpenGallery: () => void;
  onAddSound: () => void;
  soundLabel?: string;
}

export default function CreateCameraView({
  mode,
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

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setReady(false);
    setDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: mode === "video",
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      setDenied(true);
    }
  }, [facing, mode, stopStream]);

  useEffect(() => {
    void startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  const flipCamera = () => setFacing((f) => (f === "user" ? "environment" : "user"));

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }), "image");
    }, "image/jpeg", 0.92);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || recording) return;
    chunksRef.current = [];
    try {
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm" });
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const ext = rec.mimeType.includes("mp4") ? "mp4" : "webm";
        onCapture(new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type }), "video");
        setRecording(false);
      };
      rec.start();
      setRecording(true);
    } catch {
      toastFallback();
    }
  };

  const stopRecording = () => recorderRef.current?.stop();

  const toastFallback = () => {
    /* parent handles via onOpenGallery */
  };

  const handleShutter = () => {
    if (mode === "photo") void takePhoto();
    else if (recording) stopRecording();
    else startRecording();
  };

  return (
    <div className="absolute inset-0 bg-black flex flex-col">
      {!denied ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-white/80 text-sm">Camera access denied. Upload from your library instead.</p>
          <button
            onClick={onOpenGallery}
            className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm"
          >
            Open gallery
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-white" aria-label="Close">
          <X className="w-7 h-7" />
        </button>
        <button
          onClick={onAddSound}
          className="flex items-center gap-1.5 max-w-[50%] rounded-full bg-black/45 backdrop-blur-md border border-white/20 px-3 py-1.5 text-white"
        >
          <Music className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-semibold truncate">{soundLabel || "Add sound"}</span>
        </button>
        <button
          onClick={flipCamera}
          disabled={denied}
          className="w-10 h-10 flex items-center justify-center text-white disabled:opacity-30"
          aria-label="Flip camera"
        >
          <SwitchCamera className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="relative z-20 mt-auto pb-[calc(env(safe-area-inset-bottom)+1rem)] px-6">
        <div className="flex items-center justify-center gap-10">
          <button
            onClick={onOpenGallery}
            className="w-11 h-11 rounded-lg border-2 border-white/80 bg-zinc-800/80 flex items-center justify-center"
            aria-label="Gallery"
          >
            <ImagePlus className="w-5 h-5 text-white" />
          </button>

          <button
            onClick={handleShutter}
            disabled={denied || !ready}
            className={`w-[4.5rem] h-[4.5rem] rounded-full border-[5px] flex items-center justify-center transition-all disabled:opacity-40 ${
              recording ? "border-red-500 bg-red-500/30" : "border-white bg-white/20"
            }`}
            aria-label={mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Record video"}
          >
            <div className={`rounded-full bg-white ${recording ? "w-6 h-6" : "w-14 h-14"}`} />
          </button>

          <div className="w-11 h-11" />
        </div>
        {recording && <p className="text-center text-red-400 text-xs font-semibold mt-3 animate-pulse">Recording…</p>}
      </div>
    </div>
  );
}
