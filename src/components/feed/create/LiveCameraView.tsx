import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
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
import EnhancePanel from "./EnhancePanel";
import EffectsPanel from "./EffectsPanel";
import FaceFilterPanel from "./FaceFilterPanel";
import VirtualAvatarStage, {
  VIRTUAL_AVATARS,
  type VirtualAvatarId,
} from "./VirtualAvatarStage";

interface Props {
  createMode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  onClose: () => void;
  initialStream?: MediaStream | null;
  circleId?: string | null;
  hideModeTabs?: boolean;
  exclusiveLive?: boolean;
}

const CAMERA_RETRY_ATTEMPTS = 6;
const CAMERA_RETRY_DELAY_MS = 400;

type ViewMode = "live" | "multi" | "virtual";

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof Radio; helper: string }[] = [
  { id: "live", label: "Live", icon: Radio, helper: "Solo broadcast" },
  { id: "multi", label: "Multi", icon: Users, helper: "Bring guests on stage" },
  { id: "virtual", label: "Virtual", icon: UserRound, helper: "Face-tracked avatar" },
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
  const [showControls, setShowControls] = useState(false);
  const [exclusiveAudience, setExclusiveAudience] = useState<ExclusiveLiveAudience>("all");
  const [virtualAvatarId, setVirtualAvatarId] = useState<VirtualAvatarId>(() => {
    try {
      return (localStorage.getItem("yaj.virtual.avatar") as VirtualAvatarId) || "nova";
    } catch {
      return "nova";
    }
  });

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
  const isCircleScoped = Boolean(circleId);
  const canSwitchToPost = !hideModeTabs && !isCircleScoped;

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
    if (initialStream) void attachStream(initialStream);
    else void startCamera();
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
    if (mode === "virtual") setDualLayout("none");
  };

  const selectVirtualAvatar = (id: VirtualAvatarId) => {
    setVirtualAvatarId(id);
    try {
      localStorage.setItem("yaj.virtual.avatar", id);
    } catch {
      /* ignore */
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
    const result = await shareLiveInvite({ url: shareUrl, title: "Join my YAJ live", circleScoped: Boolean(circleId) });
    if (result === "copied") {
      toast({ title: "Link copied", description: "Share it by text or message so friends can join when you go live." });
    } else if (result === "failed") {
      toast({ title: "Couldn't open share", description: "Copy this link and send it: " + shareUrl, variant: "destructive" });
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
            virtualAvatarId,
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
          exclusiveLive ? `?exclusive=1${invite ? `&invite=${encodeURIComponent(invite)}` : ""}` : ""
        }`;
        if (exclusiveLive && invite) {
          const inviteUrl = liveWatchUrl({ circleId, exclusive: true, inviteToken: invite });
          void shareLiveInvite({ url: inviteUrl, title: "Join my Exclusive live on YAJ", circleScoped: true }).then((result) => {
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
            visibility: looksActive || viewMode === "virtual" ? "hidden" : "visible",
            transform: facing === "user" ? "scaleX(-1)" : undefined,
            filter: dualOn ? undefined : displayFilter,
          }}
        />
      )}

      {!denied && needsCanvas && !dualOn && viewMode !== "virtual" && (
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
        <VirtualAvatarStage
          videoTrack={rawVideoTrack}
          displayName={displayName}
          profileAvatarUrl={avatarUrl}
          selectedId={virtualAvatarId}
          onSelectedIdChange={selectVirtualAvatar}
          showPicker={false}
        />
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
          right: "1rem",
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
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
          aria-label="Close live setup"
        >
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

      <div
        className="relative z-20 mt-auto flex flex-col items-center px-5"
        style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom), 0.75rem) + 1rem)" }}
      >
        <button
          type="button"
          onClick={() => void handleGoLive()}
          disabled={denied || !ready || startingLive}
          className="flex h-[62px] w-full max-w-[22rem] items-center justify-center gap-2 rounded-full bg-red-600 text-[17px] font-black text-white shadow-2xl transition active:scale-[0.98] disabled:opacity-40"
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

        <button
          type="button"
          onClick={() => setShowControls((v) => !v)}
          className="mt-3 flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 text-[12px] font-bold text-white backdrop-blur-md"
          aria-expanded={showControls}
        >
          {showControls ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          {showControls ? "Hide controls" : "Controls"}
        </button>
      </div>

      {showControls && (
        <div className="absolute inset-x-0 bottom-0 z-[80] max-h-[72dvh] overflow-y-auto rounded-t-[30px] border-t border-white/15 bg-zinc-950/95 px-4 pb-[calc(max(env(safe-area-inset-bottom),1rem)+1rem)] pt-3 text-white shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[17px] font-black tracking-tight">Live controls</p>
              <p className="text-[11px] text-white/50">Choose a mode, avatar, or camera tool.</p>
            </div>
            <button type="button" onClick={() => setShowControls(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Close controls">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              const selected = mode.id === viewMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => selectViewMode(mode.id)}
                  className={`rounded-2xl border px-2 py-3 text-center ${selected ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white"}`}
                >
                  <Icon className="mx-auto h-5 w-5" />
                  <p className="mt-1 text-[12px] font-black">{mode.label}</p>
                  <p className={`mt-0.5 text-[9px] ${selected ? "text-black/55" : "text-white/45"}`}>{mode.helper}</p>
                </button>
              );
            })}
          </div>

          {viewMode === "virtual" && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-black">Choose avatar</p>
                <span className="text-[10px] text-white/45">Tap to switch</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {VIRTUAL_AVATARS.map((item) => {
                  const selected = item.id === virtualAvatarId;
                  const profileThumb = item.id === "profile" && avatarUrl;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectVirtualAvatar(item.id)}
                      className={`rounded-2xl border p-3 ${selected ? "border-white bg-white/15 ring-2 ring-white/60" : "border-white/10 bg-white/5"}`}
                    >
                      <div className={`mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${item.bg}`}>
                        {profileThumb ? (
                          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl" aria-hidden>{item.emoji}</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[11px] font-black">{item.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode !== "virtual" && (
            <div className="mt-4 grid grid-cols-3 gap-2">
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
                    onClick={() => {
                      onTool(tool.id);
                      if (tool.id === "flip" || tool.id === "share") setShowControls(false);
                    }}
                    className={`flex min-h-[72px] flex-col items-center justify-center rounded-2xl border ${selected ? "border-white bg-white text-black" : "border-white/10 bg-white/5 text-white"}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="mt-1 text-[10px] font-bold">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {exclusiveLive && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="mb-2 text-[12px] font-black">Exclusive audience</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setExclusiveAudience("all")} className={`rounded-xl px-3 py-2 text-[11px] font-bold ${exclusiveAudience === "all" ? "bg-white text-black" : "bg-white/10"}`}>
                  All Exclusive
                </button>
                <button type="button" onClick={() => setExclusiveAudience("invite")} className={`rounded-xl px-3 py-2 text-[11px] font-bold ${exclusiveAudience === "invite" ? "bg-white text-black" : "bg-white/10"}`}>
                  Invite only
                </button>
              </div>
            </div>
          )}

          {canSwitchToPost && (
            <button
              type="button"
              onClick={() => {
                setShowControls(false);
                onModeChange("post");
              }}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-[13px] font-black"
            >
              Switch to Post
            </button>
          )}
        </div>
      )}

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
    </div>
  );
}
