import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Radio,
  Settings,
  Share2,
  Smile,
  Sparkles,
  SwitchCamera,
  UserRound,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { warmCameraStream, releaseCameraStream, streamHasLiveAudio } from "@/lib/create-camera";
import type { AppearanceToolId, CreateMode, EnhanceSettings, EnhanceTab } from "@/lib/create-modes";
import {
  DEFAULT_ENHANCE,
  composeDisplayFilters,
  enhanceNeedsCanvas,
  getEffectFilter,
  getEnhanceDisplayFilter,
  isEnhanceActive,
} from "@/lib/create-modes";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { startCircleLive } from "@/lib/circle-live";
import { useFaceFilters, type FaceFilterId } from "@/hooks/useFaceFilters";
import {
  liveWatchUrl,
  openSecondaryCamera,
  releaseSecondaryCamera,
  shareLiveInvite,
} from "@/lib/dual-camera";
import type { DualCameraLayout } from "./DualCameraLayoutSheet";
import DualCameraLayoutSheet from "./DualCameraLayoutSheet";
import CreateModeTabs from "./CreateModeTabs";
import EnhancePanel from "./EnhancePanel";
import EffectsPanel from "./EffectsPanel";
import FaceFilterPanel from "./FaceFilterPanel";

interface Props {
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  onClose: () => void;
  initialStream?: MediaStream | null;
  /**
   * When set, this prep starts a Circle-scoped live (members only) and navigates to
   * `/circle/c/:id/live`. When omitted/null, Go Live creates a public feed live at
   * `/live/:sessionId` — same prep UI, deliberately different destinations.
   */
  circleId?: string | null;
  /** Hide POST / LIVE mode tabs when opened from My Circle (Circle-only prep). */
  hideModeTabs?: boolean;
}

const CAMERA_RETRY_ATTEMPTS = 6;
const CAMERA_RETRY_DELAY_MS = 400;

type ViewMode = "live" | "multi" | "virtual";

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof Radio }[] = [
  { id: "live", label: "Live", icon: Radio },
  { id: "multi", label: "Multi", icon: Users },
  { id: "virtual", label: "Virtual", icon: UserRound },
];

type PrepToolId = "flip" | "enhance" | "effects" | "face" | "share" | "settings";

/** Right-rail tools — Fill Light / Collapse removed; Settings opens dual-camera layout. */
const PREP_TOOLS: { id: PrepToolId; label: string; icon: typeof Sparkles }[] = [
  { id: "flip", label: "Flip", icon: SwitchCamera },
  { id: "enhance", label: "Enhance", icon: Sparkles },
  { id: "effects", label: "Effects", icon: Wand2 },
  { id: "face", label: "Face", icon: Smile },
  { id: "share", label: "Share", icon: Share2 },
  { id: "settings", label: "Settings", icon: Settings },
];

/** Pre-live camera check — flip, Enhance/Effects/Face, dual-camera Settings, then go live. */
export default function LiveCameraView({
  createMode,
  onModeChange,
  onClose,
  initialStream,
  circleId = null,
  hideModeTabs = false,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pipStreamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("live");

  const [showEnhance, setShowEnhance] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showFaceFilters, setShowFaceFilters] = useState(false);
  const [showDualSheet, setShowDualSheet] = useState(false);
  const [dualLayout, setDualLayout] = useState<DualCameraLayout>("none");
  const [pipReady, setPipReady] = useState(false);
  const [enhanceTab, setEnhanceTab] = useState<EnhanceTab>("Appearance");
  const [appearanceTool, setAppearanceTool] = useState<AppearanceToolId>("smooth");
  const [enhance, setEnhance] = useState<EnhanceSettings>(DEFAULT_ENHANCE);
  const [effectCategory, setEffectCategory] = useState("Trending");
  const [selectedEffect, setSelectedEffect] = useState("none");
  const [faceFilter, setFaceFilter] = useState<FaceFilterId>("none");
  const [rawVideoTrack, setRawVideoTrack] = useState<MediaStreamTrack | null>(null);

  const displayFilter = composeDisplayFilters(getEffectFilter(selectedEffect), getEnhanceDisplayFilter(enhance));
  const needsCanvas = faceFilter !== "none" || enhanceNeedsCanvas(enhance);
  const faceFilters = useFaceFilters(rawVideoTrack, faceFilter, needsCanvas, undefined, enhance);

  const dualOn = dualLayout !== "none" && pipReady;
  const pipFacing: "user" | "environment" = facing === "user" ? "environment" : "user";

  const closeEffectSheets = () => {
    setShowEnhance(false);
    setShowEffects(false);
    setShowFaceFilters(false);
  };

  const attachStream = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => {});
    }
    setReady(true);
    setDenied(false);
    setRawVideoTrack(stream.getVideoTracks()[0] ?? null);
  }, []);

  const startCamera = useCallback(async () => {
    releaseCameraStream(streamRef.current);
    streamRef.current = null;
    try {
      let stream: MediaStream | null = null;
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
    } else {
      void startCamera();
    }
    return () => {
      releaseCameraStream(streamRef.current);
      releaseSecondaryCamera(pipStreamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, initialStream]);

  const stopPip = useCallback(() => {
    releaseSecondaryCamera(pipStreamRef.current);
    pipStreamRef.current = null;
    if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
    setPipReady(false);
  }, []);

  const startPip = useCallback(async () => {
    stopPip();
    const stream = await openSecondaryCamera(pipFacing);
    if (!stream) {
      toast({
        title: "Dual camera unavailable",
        description: "This device couldn’t open front and back cameras together.",
        variant: "destructive",
      });
      setDualLayout("none");
      return false;
    }
    pipStreamRef.current = stream;
    const video = pipVideoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => {});
    }
    setPipReady(true);
    return true;
  }, [pipFacing, stopPip]);

  useEffect(() => {
    if (dualLayout === "none") {
      stopPip();
      return;
    }
    void startPip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dualLayout, facing]);

  const flipCamera = () => setFacing((f) => (f === "user" ? "environment" : "user"));

  /** Tap PiP → swap which camera is full-screen vs inset. */
  const swapDualCameras = () => {
    if (!dualOn) return;
    setFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const handleShare = async () => {
    // Before go-live we don't have a session yet — share a deep link that lands on the
    // Circle live room / public live once they're broadcasting.
    const url = liveWatchUrl({
      circleId: circleId ?? null,
      sessionId: null,
    });
    // For public lives without a session id yet, point people at the host profile live gate.
    const shareUrl =
      circleId
        ? url
        : user?.id
          ? `${window.location.origin}/#/live/u/${user.id}`
          : `${window.location.origin}/#/`;
    const result = await shareLiveInvite({
      url: shareUrl,
      title: "Join my YAJ live",
      circleScoped: Boolean(circleId),
    });
    if (result === "copied") {
      toast({ title: "Link copied", description: "Share it by text or message so friends can join when you go live." });
    } else if (result === "failed") {
      toast({
        title: "Couldn't open share",
        description: "Copy this link and send it: " + shareUrl,
        variant: "destructive",
      });
    }
    // "shared" / "cancelled" — no error toast
  };

  const handleGoLive = async () => {
    if (!ready || !streamHasLiveAudio(streamRef.current) || !user?.id || startingLive) {
      return;
    }
    setStartingLive(true);
    try {
      try {
        sessionStorage.setItem(
          "yaj_live_prep_looks",
          JSON.stringify({
            faceFilter,
            selectedEffect,
            enhance,
            facing,
            dualLayout,
            viewMode,
            circleId: circleId ?? null,
            at: Date.now(),
          }),
        );
      } catch {
        /* ignore */
      }

      const session = await startCircleLive(circleId ?? null, user.id, viewMode);
      if (circleId) {
        navigate(`/circle/c/${circleId}/live`);
      } else {
        navigate(`/live/${session.id}`);
      }
    } catch (e: any) {
      toast({ title: "Couldn't go live", description: e.message, variant: "destructive" });
      setStartingLive(false);
    }
  };

  const isCircleScoped = Boolean(circleId);
  const looksActive = needsCanvas && faceFilters.active && !dualOn;

  const onTool = (id: PrepToolId) => {
    if (id === "flip") {
      flipCamera();
      return;
    }
    if (id === "enhance") {
      setShowEffects(false);
      setShowFaceFilters(false);
      setShowDualSheet(false);
      setShowEnhance((v) => !v);
      return;
    }
    if (id === "effects") {
      setShowEnhance(false);
      setShowFaceFilters(false);
      setShowDualSheet(false);
      setShowEffects((v) => !v);
      return;
    }
    if (id === "face") {
      setShowEnhance(false);
      setShowEffects(false);
      setShowDualSheet(false);
      setShowFaceFilters((v) => !v);
      return;
    }
    if (id === "share") {
      closeEffectSheets();
      setShowDualSheet(false);
      void handleShare();
      return;
    }
    if (id === "settings") {
      closeEffectSheets();
      setShowDualSheet(true);
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
          style={{
            visibility: looksActive ? "hidden" : "visible",
            transform: facing === "user" ? "scaleX(-1)" : undefined,
            filter: dualOn ? undefined : displayFilter,
          }}
        />
      )}

      {!denied && needsCanvas && !dualOn && (
        <canvas
          ref={faceFilters.canvasRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            visibility: faceFilters.active ? "visible" : "hidden",
            transform: facing === "user" ? "scaleX(-1)" : undefined,
            filter: displayFilter,
          }}
        />
      )}

      {/* Secondary (PiP) camera — tappable to swap wide */}
      <video
        ref={pipVideoRef}
        playsInline
        muted
        autoPlay
        className={`absolute z-10 object-cover border-2 border-white/80 shadow-lg ${
          dualOn ? "opacity-100" : "pointer-events-none opacity-0"
        } ${
          dualLayout === "circle" ? "rounded-full" : "rounded-2xl"
        }`}
        style={{
          top: "max(calc(env(safe-area-inset-top) + 4.5rem), 5.5rem)",
          right: "4.75rem",
          width: dualLayout === "circle" ? "6.5rem" : "7.25rem",
          height: dualLayout === "circle" ? "6.5rem" : "9.5rem",
          transform: pipFacing === "user" ? "scaleX(-1)" : undefined,
        }}
        onClick={swapDualCameras}
      />

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
          {startingLive ? "Starting…" : isCircleScoped ? "Circle Live" : "Go Live"}
        </span>
        <div className="w-11" />
      </div>

      {/* Right-side tool rail */}
      <div className="absolute right-2 z-20 flex flex-col items-center gap-3 top-[max(calc(env(safe-area-inset-top)+3.25rem),4rem)]">
        {PREP_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const selected =
            tool.id === "enhance"
              ? showEnhance || isEnhanceActive(enhance)
              : tool.id === "effects"
                ? showEffects || selectedEffect !== "none"
                : tool.id === "face"
                  ? showFaceFilters || faceFilter !== "none"
                  : tool.id === "settings"
                    ? showDualSheet || dualLayout !== "none"
                    : false;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onTool(tool.id)}
              className="flex flex-col items-center gap-0.5"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md ${
                  selected ? "border-white bg-white text-black" : "border-white/15 bg-black/40 text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-center text-[9px] font-semibold leading-tight text-white/85 drop-shadow">
                {tool.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative z-20 mt-auto flex flex-col items-center gap-4 px-4 pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+2.5rem)] pr-16">
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1 backdrop-blur-md">
          {VIEW_MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                  selected ? "bg-white text-black" : "text-white/70"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>

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

      <EnhancePanel
        open={showEnhance}
        tab={enhanceTab}
        onTabChange={setEnhanceTab}
        onClose={() => setShowEnhance(false)}
        settings={enhance}
        onChange={setEnhance}
        appearanceTool={appearanceTool}
        onAppearanceToolChange={setAppearanceTool}
      />

      <EffectsPanel
        open={showEffects}
        category={effectCategory}
        onCategoryChange={setEffectCategory}
        onClose={() => setShowEffects(false)}
        selectedId={selectedEffect}
        onSelect={setSelectedEffect}
      />

      <FaceFilterPanel
        open={showFaceFilters}
        onClose={() => setShowFaceFilters(false)}
        selectedId={faceFilter}
        onSelect={setFaceFilter}
        loading={faceFilters.loading}
        error={faceFilters.error}
      />

      <DualCameraLayoutSheet
        open={showDualSheet}
        layout={dualLayout}
        onLayoutChange={(layout) => {
          setDualLayout(layout);
          if (layout === "none") setShowDualSheet(false);
        }}
        onClose={() => setShowDualSheet(false)}
      />

      {!hideModeTabs && !isCircleScoped && (
        <CreateModeTabs value={createMode} onChange={onModeChange} disabled={startingLive} />
      )}
    </div>
  );
}
