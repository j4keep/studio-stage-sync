import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ImagePlus,
  Loader2,
  Radio,
  Settings,
  Sparkles,
  SwitchCamera,
  UserRound,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { warmCameraStream, releaseCameraStream, streamHasLiveAudio } from "@/lib/create-camera";
import type { CreateMode } from "@/lib/create-modes";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { startCircleLive } from "@/lib/circle-live";

interface Props {
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  onClose: () => void;
  onOpenGallery?: () => void;
  initialStream?: MediaStream | null;
}

type LiveStyle = "virtual" | "multi" | "live";

const CAMERA_RETRY_ATTEMPTS = 6;
const CAMERA_RETRY_DELAY_MS = 400;

const LIVE_STYLES: { id: LiveStyle; label: string; icon: typeof Radio }[] = [
  { id: "virtual", label: "Virtual Live", icon: UserRound },
  { id: "multi", label: "Multi-guest LIVE", icon: Users },
  { id: "live", label: "LIVE", icon: Radio },
];

/**
 * Pre-live camera check. Keep this intentionally thin: the real broadcast room still owns
 * the live session, gifts/comments and the working live effects stack. This screen is only
 * the cleaner launch surface.
 */
export default function LiveCameraView({
  createMode,
  onModeChange,
  onClose,
  onOpenGallery,
  initialStream,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [liveStyle, setLiveStyle] = useState<LiveStyle>("live");

  const attachStream = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
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
      // iOS can briefly hold the camera when switching from the Post recorder.
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

  const handleGoLive = async () => {
    if (!ready || !streamHasLiveAudio(streamRef.current) || !user?.id || startingLive) return;
    setStartingLive(true);
    try {
      // Preserve the existing, working live-session path. The selected visual mode is a
      // presentation choice for now; we can wire mode-specific rooms in the next pass.
      const session = await startCircleLive(null, user.id);
      navigate(`/live/${session.id}`);
    } catch (e: any) {
      toast({ title: "Couldn't go live", description: e.message, variant: "destructive" });
      setStartingLive(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black flex flex-col touch-none text-white overflow-hidden">
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

      <div className="absolute inset-0 bg-gradient-to-b from-black/28 via-transparent to-black/62 pointer-events-none" />

      {denied && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-8 text-center bg-zinc-950">
          <p className="text-lg font-bold">Camera access needed</p>
          <p className="text-sm text-white/60">Allow camera access, or upload a photo or video.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => void startCamera()} className="px-5 py-3 rounded-full bg-white text-black font-bold text-sm">
              Try again
            </button>
            {onOpenGallery && (
              <button type="button" onClick={onOpenGallery} className="px-5 py-3 rounded-full bg-white/15 border border-white/20 text-white font-bold text-sm">
                Upload
              </button>
            )}
          </div>
        </div>
      )}

      {!ready && !denied && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
          <Loader2 className="h-8 w-8 animate-spin text-white/75" />
        </div>
      )}

      {/* Clean top chrome */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-black/30 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-lg"
          aria-label="Close"
        >
          <X className="w-7 h-7" />
        </button>
        <div className="w-11" aria-hidden />
      </div>

      {/* Bigo-inspired glass title card, but styled for YAJ. */}
      <div className="relative z-20 mx-4 mt-4 rounded-[1.55rem] border border-white/35 bg-black/22 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-lg font-black shadow-md">Y</div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-white/95">Add a title to chat</p>
            <p className="mt-0.5 text-xs text-white/55">Give people a reason to join</p>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/75" aria-label="More title options">
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
        <div className="border-t border-white/10 px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold whitespace-nowrap"># Chat</span>
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold whitespace-nowrap"># Trending</span>
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold whitespace-nowrap">Public</span>
        </div>
      </div>

      {/* Preview-only live layouts. Actual room behavior stays untouched until the button pass. */}
      {liveStyle === "multi" && (
        <div className="absolute inset-x-4 top-[31%] bottom-[31%] z-10 grid grid-cols-2 grid-rows-2 gap-px rounded-3xl overflow-hidden border border-white/25 bg-white/10 pointer-events-none">
          <div className="bg-transparent" />
          {[1, 2, 3].map((seat) => (
            <div key={seat} className="bg-black/22 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border border-white/25 bg-black/10 flex items-center justify-center text-white/35">
                <Users className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {liveStyle === "virtual" && (
        <div className="absolute inset-x-0 top-[29%] bottom-[30%] z-10 flex items-center justify-center pointer-events-none">
          <div className="w-44 h-56 rounded-[2.75rem] bg-gradient-to-b from-sky-200/85 via-violet-300/80 to-fuchsia-400/85 border border-white/35 shadow-2xl flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="w-24 h-24 rounded-full bg-white/85 flex items-center justify-center text-violet-500 shadow-lg">
              <UserRound className="w-14 h-14" />
            </div>
            <p className="mt-4 text-sm font-black text-white drop-shadow">Virtual Host</p>
          </div>
        </div>
      )}

      {/* Cleaner tool rail. Events + Creator Center intentionally omitted. Upload replaces camera tool. */}
      <div className="absolute right-3 top-[44%] -translate-y-1/2 z-20 flex flex-col items-center gap-4">
        <button type="button" onClick={flipCamera} disabled={!ready} className="flex flex-col items-center gap-1 text-white/90 disabled:opacity-35">
          <span className="w-10 h-10 rounded-full bg-black/28 border border-white/15 backdrop-blur-md flex items-center justify-center"><SwitchCamera className="w-5 h-5" /></span>
          <span className="text-[10px] font-semibold">Flip</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-1 text-white/90">
          <span className="w-10 h-10 rounded-full bg-black/28 border border-white/15 backdrop-blur-md flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
          <span className="text-[10px] font-semibold">Beauty</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-1 text-white/90">
          <span className="w-10 h-10 rounded-full bg-black/28 border border-white/15 backdrop-blur-md flex items-center justify-center"><Wand2 className="w-5 h-5" /></span>
          <span className="text-[10px] font-semibold">Magic</span>
        </button>
        <button type="button" onClick={onOpenGallery} className="flex flex-col items-center gap-1 text-white/90">
          <span className="w-10 h-10 rounded-full bg-black/28 border border-white/15 backdrop-blur-md flex items-center justify-center"><ImagePlus className="w-5 h-5" /></span>
          <span className="text-[10px] font-semibold">Upload</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-1 text-white/90">
          <span className="w-10 h-10 rounded-full bg-black/28 border border-white/15 backdrop-blur-md flex items-center justify-center"><Settings className="w-5 h-5" /></span>
          <span className="text-[10px] font-semibold">Settings</span>
        </button>
      </div>

      {/* Bottom actions: preserve 60-second Post flow and existing Go Live backend. */}
      <div className="relative z-20 mt-auto px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto flex w-full max-w-[28rem] items-center gap-3">
          <button
            type="button"
            onClick={() => onModeChange("post")}
            disabled={startingLive}
            className="h-14 flex-1 rounded-full border border-white/35 bg-black/30 backdrop-blur-xl text-sm font-black tracking-wide text-white shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            POST
          </button>
          <button
            type="button"
            onClick={() => void handleGoLive()}
            disabled={denied || !ready || startingLive}
            className="h-14 flex-[1.55] rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 text-base font-black text-slate-950 shadow-xl active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
            aria-label="Go live"
          >
            {startingLive ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {startingLive ? "Starting…" : "GO LIVE"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1 overflow-x-auto no-scrollbar pb-1">
          {LIVE_STYLES.map((mode) => {
            const Icon = mode.icon;
            const selected = liveStyle === mode.id;
            return (
              <button
                type="button"
                key={mode.id}
                onClick={() => setLiveStyle(mode.id)}
                className={`min-w-[6.5rem] rounded-full px-3 py-2 text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  selected ? "bg-white text-black shadow-lg" : "text-white/65"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Keep prop used while the shared CreatePostSheet still owns Post/Live state. */}
      <span className="sr-only">{createMode}</span>
    </div>
  );
}
