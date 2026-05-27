import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, MicOff, Wifi } from "lucide-react";

export interface VideoTileProps {
  name: string;
  isSelf?: boolean;
  cameraOn?: boolean;
  micMuted?: boolean;
  quality?: "good" | "ok" | "poor";
  reconnecting?: boolean;
  primary?: boolean;
}

export default function VideoTile({
  name, isSelf, cameraOn = true, micMuted, quality = "good", reconnecting, primary,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    if (!isSelf || !cameraOn) {
      setHasStream(false);
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
          setHasStream(true);
        }
      })
      .catch(() => setHasStream(false));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [isSelf, cameraOn]);

  const qColor =
    quality === "good" ? "text-[hsl(var(--studio-green))]"
    : quality === "ok" ? "text-[hsl(var(--studio-amber))]"
    : "text-[hsl(var(--studio-red))]";

  return (
    <div
      className={`studio-card-inset relative overflow-hidden aspect-video ${primary ? "ring-1 ring-[hsl(var(--studio-blue)/0.3)]" : ""}`}
    >
      {isSelf && cameraOn && hasStream ? (
        <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--studio-bg-2))] to-[hsl(var(--studio-bg))]">
          {cameraOn ? (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-[hsl(var(--studio-card))] border border-[hsl(var(--studio-border))] flex items-center justify-center text-[hsl(var(--studio-text-dim))] text-lg font-semibold">
                {name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="text-xs text-[hsl(var(--studio-text-muted))] mt-2">Waiting for video…</div>
            </div>
          ) : (
            <CameraOff className="w-10 h-10 text-[hsl(var(--studio-text-muted))]" />
          )}
        </div>
      )}

      {reconnecting && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-sm text-[hsl(var(--studio-amber))] font-medium">
          Reconnecting…
        </div>
      )}

      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/55 text-xs font-medium flex items-center gap-1.5">
        <span>{name}</span>
        {isSelf && <span className="text-[hsl(var(--studio-text-muted))]">(you)</span>}
      </div>

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="px-1.5 py-1 rounded-md bg-black/55">
            {micMuted ? <MicOff className="w-3.5 h-3.5 text-[hsl(var(--studio-red))]" /> : <Mic className="w-3.5 h-3.5 text-[hsl(var(--studio-green))]" />}
          </div>
          <div className="px-1.5 py-1 rounded-md bg-black/55">
            {cameraOn ? <Camera className="w-3.5 h-3.5 text-[hsl(var(--studio-text-dim))]" /> : <CameraOff className="w-3.5 h-3.5 text-[hsl(var(--studio-red))]" />}
          </div>
        </div>
        <div className={`px-1.5 py-1 rounded-md bg-black/55 ${qColor}`}>
          <Wifi className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
