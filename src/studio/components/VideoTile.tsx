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
  /** Optional external stream (e.g. remote peer). Overrides self-capture. */
  stream?: MediaStream | null;
}

export default function VideoTile({
  name, isSelf, cameraOn = true, micMuted, quality = "good", reconnecting, primary, stream,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Acquire local camera when isSelf && cameraOn (and no external stream provided).
  useEffect(() => {
    if (stream || !isSelf || !cameraOn) {
      setLocalStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
      return;
    }
    let cancelled = false;
    let acquired: MediaStream | null = null;
    setError(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        acquired = s;
        setLocalStream(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Camera blocked");
      });
    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
    };
  }, [isSelf, cameraOn, stream]);

  // Bind whichever stream we have to the always-rendered <video>.
  const active = stream ?? localStream;
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && v.srcObject !== active) {
      v.srcObject = active;
      v.play().catch(() => {});
    } else if (!active && v.srcObject) {
      v.srcObject = null;
    }
  }, [active]);

  const showVideo = !!active && cameraOn;

  const qColor =
    quality === "good" ? "text-[hsl(var(--studio-green))]"
    : quality === "ok" ? "text-[hsl(var(--studio-amber))]"
    : "text-[hsl(var(--studio-red))]";

  return (
    <div
      className={`studio-card-inset relative overflow-hidden aspect-video ${primary ? "ring-1 ring-[hsl(var(--studio-blue)/0.3)]" : ""}`}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover ${showVideo ? "" : "hidden"}`}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--studio-bg-2))] to-[hsl(var(--studio-bg))]">
          {cameraOn ? (
            <div className="text-center px-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-[hsl(var(--studio-card))] border border-[hsl(var(--studio-border))] flex items-center justify-center text-[hsl(var(--studio-text-dim))] text-lg font-semibold">
                {name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="text-xs text-[hsl(var(--studio-text-muted))] mt-2">
                {isSelf ? (error ?? "Requesting camera…") : "Waiting for remote video…"}
              </div>
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
