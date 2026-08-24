import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, SwitchCamera, X } from "lucide-react";
import { warmCameraStream, releaseCameraStream, streamHasLiveAudio } from "@/lib/create-camera";
import type { CreateMode } from "@/lib/create-modes";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { startCircleLive } from "@/lib/circle-live";
import CreateModeTabs from "./CreateModeTabs";

interface Props {
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  onClose: () => void;
  initialStream?: MediaStream | null;
}

const CAMERA_RETRY_ATTEMPTS = 6;
const CAMERA_RETRY_DELAY_MS = 400;

/** Pre-live camera check — flip camera, then go live. Enhance/Effects/Face filters live
 *  on the actual live room now (CircleLiveRoomPage), not here — they used to sit on this
 *  screen without doing anything, since nothing here ever fed into a real broadcast. */
export default function LiveCameraView({ createMode, onModeChange, onClose, initialStream }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [startingLive, setStartingLive] = useState(false);

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
      let stream: MediaStream | null = null;
      // Switching straight from Post mode's camera to here can race the previous
      // stream's hardware release, especially on iOS — a single retry wasn't enough in
      // practice, so this keeps trying for a couple seconds before actually giving up.
      for (let attempt = 0; attempt < CAMERA_RETRY_ATTEMPTS && !stream; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, CAMERA_RETRY_DELAY_MS));
        stream = await warmCameraStream(facing);
      }
      if (!stream) throw new Error("denied");
      await attachStream(stream);
    } catch {
      setDenied(true);
      setReady(false);
    }
  }, [facing, attachStream]);

  // A single effect for both "just mounted" and "facing flipped" — this used to be two
  // separate effects (one mount-only, one keyed on [facing, initialStream]), and BOTH
  // fire on the initial mount (React runs every effect on mount regardless of its deps;
  // deps only control whether it re-fires later). That meant two concurrent
  // getUserMedia-chains racing each other on every single open of this screen — not a
  // rare timing fluke, a guaranteed collision, and the actual reason the camera kept
  // coming back "denied" even with retries. CreateCameraView avoids the exact same trap
  // with a facingReady guard ref; merging into one effect here sidesteps it entirely.
  useEffect(() => {
    if (initialStream) {
      void attachStream(initialStream);
    } else {
      void startCamera();
    }
    return () => releaseCameraStream(streamRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, initialStream]);

  const flipCamera = () => setFacing((f) => (f === "user" ? "environment" : "user"));

  const handleGoLive = async () => {
    if (!ready || !streamHasLiveAudio(streamRef.current) || !user?.id || startingLive) {
      return;
    }
    setStartingLive(true);
    try {
      // Same live infrastructure as My Circle's Go Live (LiveKit room, gifts, comments,
      // face filters) — circleId: null makes this a public, feed-facing live instead of
      // Circle-gated: anyone can watch, not just approved Circle members.
      const session = await startCircleLive(null, user.id);
      navigate(`/live/${session.id}`);
    } catch (e: any) {
      toast({ title: "Couldn't go live", description: e.message, variant: "destructive" });
      setStartingLive(false);
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
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <p className="text-white text-base font-semibold">Camera access needed</p>
          <p className="text-white/60 text-sm">Allow camera in Settings, then try again.</p>
          <button
            type="button"
            onClick={() => void startCamera()}
            className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {!ready && !denied && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        </div>
      )}

      <div className="relative z-20 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center text-white">
          <X className="w-7 h-7" />
        </button>
        <span className="text-xs font-bold text-white/80 px-3 py-1 rounded-full bg-black/40">
          {startingLive ? "Starting…" : "Go Live"}
        </span>
        <button type="button" onClick={flipCamera} className="w-11 h-11 flex items-center justify-center text-white" aria-label="Flip camera">
          <SwitchCamera className="w-6 h-6" />
        </button>
      </div>

      <div className="relative z-20 mt-auto flex flex-col items-center pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+2.5rem)]">
        <button
          type="button"
          onClick={() => void handleGoLive()}
          disabled={denied || !ready || startingLive}
          className="flex h-16 w-full max-w-[20rem] items-center justify-center gap-2 rounded-full bg-red-600 text-base font-black text-white shadow-xl active:scale-[0.98] transition-transform disabled:opacity-40"
          aria-label="Go live"
        >
          {startingLive ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {startingLive ? "Starting your live…" : "Go Live"}
        </button>
      </div>

      <CreateModeTabs value={createMode} onChange={onModeChange} disabled={startingLive} />
    </div>
  );
}
