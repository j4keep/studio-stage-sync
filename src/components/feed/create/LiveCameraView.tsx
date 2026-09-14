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
import { startCircleLive, type ExclusiveLiveAudience } from "@/lib/circle-live";
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
  /** Start from the Exclusive area — gated to supporters / members per Circle setting. */
  exclusiveLive?: boolean;
}

const CAMERA_RETRY_ATTEMPTS = 6;
const CAMERA_RETRY_DELAY_MS = 400;

type ViewMode = "live" | "multi" | "virtual";

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof Radio; helper: string }[] = [
  { id: "live", label: "Live", icon: Radio, helper: "Solo broadcast" },
  { id: "multi", label: "Multi", icon: Users, helper: "Bring guests on stage" },
  { id: "virtual", label: "Virtual", icon: UserRound, helper: "Avatar-style live" },
];

type PrepToolId = "flip" | "enhance" | "effects" | "face" | "share" | "settings";

const PREP_TOOLS: { id: PrepToolId; label: string; icon: typeof Sparkles }[] = [
  { id: "flip", label: "Flip", icon: SwitchCamera },
  { id: "enhance", label: "Enhance", icon: Sparkles },
  { id: "effects", label: "Effects", icon: Wand2 },
  { id: "face", label: "Face", icon: Smile },
  { id: "share", label: "Share", icon: Share2 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function LiveCameraView({
  createMode,
  onModeChange,
  onClose,
  initialStream,
  circleId = null,
  hideModeTabs = false,
  exclusiveLive = false,
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
  const [exclusiveAudience, setExclusiveAudience] = useState<ExclusiveLiveAudience>("all");

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
  const activeMode = VIEW_MODES.find((mode) => mode.id === viewMode) ?? VIEW_MODES[0];
  const displayName =
    (user?.user_metadata as any)?.display_name || user?.email?.split("@")[0] || "YAJ Creator";
  const avatarUrl = (user?.user_metadata as any)?.avatar_url as string | undefined;

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

  const swapDualCameras = () => {
    if (!dualOn) return;
    setFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const selectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    closeEffectSheets();
    setShowDualSheet(false);
    if (mode === "virtual") {
      setDualLayout("none");
    }
  };

  const handleShare = async () => {
    const url = liveWatchUrl({ circleId: circleId ?? null, sessionId: null });
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
  };

  const handleGoLive = async () => {
    if (!ready || !streamHasLiveAudio(streamRef.current) || !user?.id || startingLive) return;

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

      const session = await startCircleLive(circleId ?? null, user.id, viewMode, {
        isExclusive: exclusiveLive,
        exclusiveAudience: exclusiveLive ? exclusiveAudience : undefined,
      });
      if (circleId) {
        const invite = exclusiveLive && exclusiveAudience === "invite" ? session.invite_token : null;
        const path = `/circle/c/${circleId}/live${
          exclusiveLive
            ? `?exclusive=1${invite ? `&invite=${encodeURIComponent(invite)}` : ""}`
            : ""
        }`;
        if (exclusiveLive && invite) {
          const inviteUrl = liveWatchUrl({ circleId, exclusive: true, inviteToken: invite });
          void shareLiveInvite({
            url: inviteUrl,
            title: "Join my Exclusive live on YAJ",
            circleScoped: true,
          }).then((result) => {
            if (result === "copied") {
              toast({ title: "Invite link copied", description: "Send it only to people you want in this Exclusive live." });
            }
          });
        }
        navigate(path);
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
    <div className="absolute inset-0 flex touch-none flex-col overflow-hidden bg-black">
      {!denied && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
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

      {viewMode === "virtual" && (
        <div className="absolute inset-0 z-[8] flex items-center justify-center bg-gradient-to-b from-violet-950/80 via-black/65 to-black/90 backdrop-blur-[2px]">
          <div className="flex flex-col items-center px-8 text-center text-white">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white/10 shadow-2xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl font-black">{displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <p className="mt-4 text-lg font-black">{displayName}</p>
            <p className="mt-1 max-w-[18rem] text-[12px] font-medium leading-relaxed text-white/70">
              Virtual mode keeps the focus on your voice and YAJ identity.
            </p>
          </div>
        </div>
      )}

      <video
        ref={pipVideoRef}
        playsInline
        muted
        autoPlay
        className={`absolute z-10 object-cover border-2 border-white/80 shadow-lg ${
          dualOn ? "opacity-100" : "pointer-events-none opacity-0"
        } ${dualLayout === "circle" ? "rounded-full" : "rounded-2xl"}`}
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
          <p className="text-base font-semibold text-white">Camera access needed</p>
          <p className="text-sm text-white/60">Allow camera in Settings, then try again.</p>
          <button type="button" onClick={() => void startCamera()} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black">
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
        <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm" aria-label="Close live setup">
          <X className="h-6 w-6" />
        </button>
        <span className="rounded-full border border-white/10 bg-black/45 px-3.5 py-1.5 text-[12px] font-bold text-white/90 backdrop-blur-md">
          {startingLive
            ? "Starting…"
            : exclusiveLive
              ? "Exclusive Live"
              : isCircleScoped
                ? "Circle Live"
                : activeMode.label}
        </span>
        <div className="w-11" />
      </div>

      <div className="absolute right-2 z-20 flex flex-col items-center gap-3 top-[max(calc(env(safe-area-inset-top)+3.5rem),4.25rem)]">
        {PREP_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const cameraTool = tool.id === "flip" || tool.id === "enhance" || tool.id === "effects" || tool.id === "face" || tool.id === "settings";
          const disabled = startingLive || (viewMode === "virtual" && cameraTool);
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
            <button key={tool.id} type="button" disabled={disabled} onClick={() => onTool(tool.id)} className="flex flex-col items-center gap-1 disabled:opacity-35">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition ${
                  selected ? "border-white bg-white text-black" : "border-white/15 bg-black/45 text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-center text-[9.5px] font-semibold leading-tight text-white/90 drop-shadow">{tool.label}</span>
            </button>
          );
        })}
      </div>

      <div className="relative z-20 mt-auto flex flex-col items-center gap-3 px-4 pb-[calc(max(env(safe-area-inset-bottom),0.5rem)+2.75rem)] pr-16">
        {exclusiveLive && (
          <div className="w-full max-w-[20rem] space-y-2 rounded-2xl border border-white/15 bg-black/55 p-3 backdrop-blur-md">
            <p className="text-center text-[11px] font-bold uppercase tracking-wide text-white/70">Who can watch this Exclusive live</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setExclusiveAudience("all")} className={`rounded-xl px-2.5 py-2 text-left ${exclusiveAudience === "all" ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                <p className="text-[12px] font-black">All Exclusive</p>
                <p className="mt-0.5 text-[10px] opacity-70">Everyone with Exclusive access</p>
              </button>
              <button type="button" onClick={() => setExclusiveAudience("invite")} className={`rounded-xl px-2.5 py-2 text-left ${exclusiveAudience === "invite" ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                <p className="text-[12px] font-black">Invite link</p>
                <p className="mt-0.5 text-[10px] opacity-70">Only people you send the link</p>
              </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-[20rem] rounded-[22px] border border-white/15 bg-black/50 p-1.5 shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-3 gap-1">
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              const selected = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => selectViewMode(mode.id)}
                  disabled={startingLive}
                  className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-[16px] px-2 py-1.5 transition active:scale-[0.98] ${selected ? "bg-white text-black" : "text-white/75"}`}
                >
                  <span className="flex items-center gap-1.5 text-[12px] font-black">
                    <Icon className="h-3.5 w-3.5" />
                    {mode.label}
                  </span>
                  <span className={`mt-0.5 text-[8.5px] font-semibold ${selected ? "text-black/55" : "text-white/45"}`}>
                    {mode.helper}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full max-w-[20rem] rounded-xl bg-black/40 px-3 py-2 text-center backdrop-blur-sm">
          <p className="text-[11px] font-semibold text-white/85">{activeMode.helper}</p>
          <p className="mt-0.5 text-[9.5px] text-white/55">
            {viewMode === "multi"
              ? "Guests can request a stage seat after you start."
              : viewMode === "virtual"
                ? "Camera tools are hidden while Virtual mode is selected."
                : "You control the broadcast and viewers watch live."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleGoLive()}
          disabled={denied || !ready || startingLive}
          className="flex h-[60px] w-full max-w-[20rem] items-center justify-center gap-2 rounded-full bg-red-600 text-[16px] font-black text-white shadow-2xl transition active:scale-[0.98] disabled:opacity-40"
          aria-label="Go live"
        >
          {startingLive ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {startingLive
            ? "Starting your live…"
            : exclusiveLive && exclusiveAudience === "invite"
              ? "Go Live · Invite only"
              : exclusiveLive
                ? "Go Live · Exclusive"
                : viewMode === "multi"
                  ? "Start Multi Live"
                  : viewMode === "virtual"
                    ? "Start Virtual Live"
                    : "Go Live"}
        </button>
      </div>

      <EnhancePanel open={showEnhance} tab={enhanceTab} onTabChange={setEnhanceTab} onClose={() => setShowEnhance(false)} settings={enhance} onChange={setEnhance} appearanceTool={appearanceTool} onAppearanceToolChange={setAppearanceTool} />
      <EffectsPanel open={showEffects} category={effectCategory} onCategoryChange={setEffectCategory} onClose={() => setShowEffects(false)} selectedId={selectedEffect} onSelect={setSelectedEffect} />
      <FaceFilterPanel open={showFaceFilters} onClose={() => setShowFaceFilters(false)} selectedId={faceFilter} onSelect={setFaceFilter} loading={faceFilters.loading} error={faceFilters.error} />
      <DualCameraLayoutSheet
        open={showDualSheet}
        layout={dualLayout}
        onLayoutChange={(layout) => {
          setDualLayout(layout);
          if (layout === "none") setShowDualSheet(false);
        }}
        onClose={() => setShowDualSheet(false)}
      />

      {!hideModeTabs && !isCircleScoped && <CreateModeTabs value={createMode} onChange={onModeChange} disabled={startingLive} />}
    </div>
  );
}
