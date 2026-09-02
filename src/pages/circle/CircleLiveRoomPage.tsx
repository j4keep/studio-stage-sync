import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, Gift, Hand, Heart, Loader2, LogOut, Mic, MicOff, Send, Settings, Share2, Smile, Sparkles, UserCheck, UserPlus, Users, Video, VideoOff, Wand2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Circle, CircleMember, getCircle, getMyMembership } from "@/lib/circles";
import {
  CircleLiveComment,
  CircleLiveGift,
  CircleLiveSession,
  endCircleLive,
  getActiveLiveSession,
  getLiveSession,
  GIFT_CATALOG,
  LIKE_GIFT,
  listCircleLiveComments,
  sendCircleLiveComment,
  sendCircleLiveGift,
  type CircleLiveLayoutMode,
  type GiftType,
} from "@/lib/circle-live";
import {
  LIVE_MOTOR_MAX_ON_STAGE,
  stageParticipantsFromRoom,
  usePodcastLiveRoom,
  type RoomParticipant,
} from "@/pages/podcast/usePodcastLiveRoom";
import { useFaceFilters, type FaceFilterId } from "@/hooks/useFaceFilters";
import FaceFilterPanel from "@/components/feed/create/FaceFilterPanel";
import EnhancePanel from "@/components/feed/create/EnhancePanel";
import EffectsPanel from "@/components/feed/create/EffectsPanel";
import DualCameraLayoutSheet, { type DualCameraLayout } from "@/components/feed/create/DualCameraLayoutSheet";
import LiveMotorGrid from "@/components/live/LiveMotorGrid";
import { useLiveStageDoor } from "@/hooks/useLiveStageDoor";
import {
  liveWatchUrl,
  openSecondaryCamera,
  releaseSecondaryCamera,
  shareLiveInvite,
  startDualComposite,
} from "@/lib/dual-camera";
import {
  DEFAULT_ENHANCE,
  composeDisplayFilters,
  enhanceNeedsCanvas,
  getEffectFilter,
  getEnhanceDisplayFilter,
  isEnhanceActive,
  type AppearanceToolId,
  type EnhanceSettings,
  type EnhanceTab,
} from "@/lib/create-modes";

const sb = supabase as any;
const ALL_GIFTS = [...GIFT_CATALOG, LIKE_GIFT];
const GIFT_EMOJI: Record<GiftType, string> = Object.fromEntries(ALL_GIFTS.map((g) => [g.type, g.emoji])) as Record<GiftType, string>;

/** Debounced host leave → end session (avoids React Strict Mode remount ending a brand-new live). */
const pendingHostEndTimers = new Map<string, number>();

function cancelPendingHostEnd(sessionId: string) {
  const t = pendingHostEndTimers.get(sessionId);
  if (t) {
    window.clearTimeout(t);
    pendingHostEndTimers.delete(sessionId);
  }
}

function scheduleHostEnd(sessionId: string, delayMs = 600) {
  cancelPendingHostEnd(sessionId);
  const t = window.setTimeout(() => {
    pendingHostEndTimers.delete(sessionId);
    void endCircleLive(sessionId).catch(() => {});
  }, delayMs);
  pendingHostEndTimers.set(sessionId, t);
}

/** A Circle's live broadcast room — reuses the same LiveKit connection hook the Podcast
 *  rooms run on (usePodcastLiveRoom), just with the host publishing and everyone else
 *  watching (publish: false), instead of every participant publishing like a podcast. */
export default function CircleLiveRoomPage() {
  // /circle/c/:id/live (Circle-gated) sets `id`; /live/:sessionId (public, feed-facing —
  // anyone can watch, same room/gifts/comments/filters underneath) sets `sessionId`. One
  // shared page and data model for both, deliberately — see circle-live.ts.
  const { id, sessionId } = useParams<{ id?: string; sessionId?: string }>();
  const isPublicRoute = !!sessionId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [circle, setCircle] = useState<Circle | null | undefined>(undefined);
  const [membership, setMembership] = useState<CircleMember | null>(null);
  const [session, setSession] = useState<CircleLiveSession | null | undefined>(undefined);
  const [ending, setEnding] = useState(false);
  const [hostProfile, setHostProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [faceFilterSheetOpen, setFaceFilterSheetOpen] = useState(false);
  const [faceFilter, setFaceFilter] = useState<FaceFilterId>("none");
  const [showEnhance, setShowEnhance] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [enhanceTab, setEnhanceTab] = useState<EnhanceTab>("Appearance");
  const [appearanceTool, setAppearanceTool] = useState<AppearanceToolId>("smooth");
  const [enhance, setEnhance] = useState<EnhanceSettings>(DEFAULT_ENHANCE);
  const [effectCategory, setEffectCategory] = useState("Trending");
  const [selectedEffect, setSelectedEffect] = useState("none");
  const [dualLayout, setDualLayout] = useState<DualCameraLayout>("none");
  const [showDualSheet, setShowDualSheet] = useState(false);
  const [pipReady, setPipReady] = useState(false);
  const [mainFacing, setMainFacing] = useState<"user" | "environment">("user");
  const [prepLayoutMode, setPrepLayoutMode] = useState<CircleLiveLayoutMode | null>(null);
  const [focusedStageId, setFocusedStageId] = useState<string | null>(null);
  const [joiningStage, setJoiningStage] = useState(false);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const dualMainVideoRef = useRef<HTMLVideoElement>(null);
  const pipStreamRef = useRef<MediaStream | null>(null);
  const dualCompositeStopRef = useRef<(() => void) | null>(null);

  // Restore Enhance / Effects / Face / dual layout / Multi mode chosen on the get-ready camera
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("yaj_live_prep_looks");
      if (!raw) return;
      const looks = JSON.parse(raw) as {
        faceFilter?: FaceFilterId;
        selectedEffect?: string;
        enhance?: EnhanceSettings;
        dualLayout?: DualCameraLayout;
        facing?: "user" | "environment";
        viewMode?: CircleLiveLayoutMode;
        circleId?: string | null;
        at?: number;
      };
      if (looks.at && Date.now() - looks.at > 10 * 60 * 1000) return;
      const prepWasCircle = Boolean(looks.circleId);
      if (prepWasCircle !== !isPublicRoute) return;
      if (prepWasCircle && looks.circleId && id && looks.circleId !== id) return;
      if (looks.faceFilter) setFaceFilter(looks.faceFilter);
      if (looks.selectedEffect) setSelectedEffect(looks.selectedEffect);
      if (looks.enhance) setEnhance({ ...DEFAULT_ENHANCE, ...looks.enhance });
      if (looks.dualLayout) setDualLayout(looks.dualLayout);
      if (looks.facing) setMainFacing(looks.facing);
      if (looks.viewMode === "multi" || looks.viewMode === "virtual" || looks.viewMode === "live") {
        setPrepLayoutMode(looks.viewMode);
      }
      sessionStorage.removeItem("yaj_live_prep_looks");
    } catch {
      /* ignore */
    }
  }, [isPublicRoute, id]);

  // Captured once — the host's ORIGINAL camera track, before any face-filter swap. Needed
  // to revert cleanly back to "none": once a filtered canvas track is published, the
  // room's own "current local video track" IS that canvas, so it can no longer serve as
  // the filter engine's input (that would feed the canvas its own output).
  const rawHostTrackRef = useRef<MediaStreamTrack | null>(null);
  const [floatingGifts, setFloatingGifts] = useState<{ id: string; emoji: string }[]>([]);
  const [giftTicker, setGiftTicker] = useState<{ id: string; text: string }[]>([]);
  const [comments, setComments] = useState<CircleLiveComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const nameCache = useRef<Map<string, string>>(new Map());
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPublicRoute) {
      if (!sessionId) return;
      setCircle(null);
      void getLiveSession(sessionId).then(setSession).catch(() => setSession(null));
      return;
    }
    if (!id) return;
    void getCircle(id).then(setCircle).catch(() => setCircle(null));
    if (user?.id) void getMyMembership(id, user.id).then(setMembership).catch(() => setMembership(null));
    void getActiveLiveSession(id).then(setSession).catch(() => setSession(null));
  }, [isPublicRoute, id, sessionId, user?.id]);

  const isOwner = !isPublicRoute && !!circle && user?.id === circle.owner_id;
  const isApprovedMember = isPublicRoute ? !!user?.id : isOwner || membership?.status === "approved";
  const isHost = !!session && session.host_user_id === user?.id;
  const displayName = (user?.user_metadata as any)?.display_name || user?.email?.split("@")[0] || "Guest";
  const backPath = isPublicRoute ? "/feed" : `/circle/c/${id}`;

  // Public route only — who's live, and can the viewer follow them.
  useEffect(() => {
    if (!isPublicRoute || !session) return;
    void sb.from("profiles").select("display_name, avatar_url").eq("user_id", session.host_user_id).maybeSingle()
      .then(({ data }: any) => setHostProfile(data ?? null));
    if (user?.id && user.id !== session.host_user_id) {
      void sb.from("follows").select("follower_id").eq("follower_id", user.id).eq("following_id", session.host_user_id).maybeSingle()
        .then(({ data }: any) => setIsFollowing(!!data));
    }
  }, [isPublicRoute, session?.host_user_id, user?.id]);

  const toggleFollow = async () => {
    if (!user?.id || !session) return;
    try {
      if (isFollowing) {
        await sb.from("follows").delete().eq("follower_id", user.id).eq("following_id", session.host_user_id);
        setIsFollowing(false);
      } else {
        await sb.from("follows").insert({ follower_id: user.id, following_id: session.host_user_id });
        setIsFollowing(true);
      }
    } catch (e: any) {
      toast({ title: "Couldn't update follow", description: e.message, variant: "destructive" });
    }
  };

  const layoutMode: CircleLiveLayoutMode =
    session?.layout_mode || prepLayoutMode || "live";
  const isMultiMotor = layoutMode === "multi";
  // Guests may request a stage seat on Multi lives (and once anyone is on stage, grid shows).
  const stageJoinEnabled = isMultiMotor;

  const room = usePodcastLiveRoom({
    roomName: session?.room ?? "",
    displayName,
    hostIdentity: session?.host_user_id,
    enabled: !!session && isApprovedMember,
    // Host always publishes. Multi guests get publish permission but only go live after host accepts.
    publish: isHost,
    canPublish: isHost || stageJoinEnabled,
    maxParticipants: stageJoinEnabled ? 40 : 6,
  });

  const stageDoor = useLiveStageDoor({
    sessionId: session?.id,
    enabled: !!session && isApprovedMember && stageJoinEnabled,
    isHost,
    userId: user?.id,
    displayName,
  });

  // Capture the raw camera track exactly once, before any filter is ever applied —
  // afterwards room.local?.videoTrack reflects whatever is CURRENTLY published (the
  // filtered canvas, once one's active), so it can't be relied on as a stable source.
  useEffect(() => {
    if (isHost && room.local?.videoTrack && !rawHostTrackRef.current) {
      rawHostTrackRef.current = room.local.videoTrack;
    }
  }, [isHost, room.local?.videoTrack]);

  const colorFilter = composeDisplayFilters(getEffectFilter(selectedEffect), getEnhanceDisplayFilter(enhance));
  const hasAnyVideoEffect =
    faceFilter !== "none" || colorFilter !== "none" || enhanceNeedsCanvas(enhance);
  const faceFilters = useFaceFilters(
    rawHostTrackRef.current,
    faceFilter,
    isHost && hasAnyVideoEffect,
    colorFilter !== "none" ? colorFilter : undefined,
    enhance,
  );

  useEffect(() => {
    if (!isHost) return;
    // Dual composite takes over the published track when enabled.
    if (dualLayout !== "none") return;
    const target = !hasAnyVideoEffect ? rawHostTrackRef.current : faceFilters.outputTrack;
    if (!target) return;
    room.replaceVideoTrack(target).catch((e: any) => {
      toast({ title: "Couldn't update your live video", description: e?.message, variant: "destructive" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, hasAnyVideoEffect, faceFilters.outputTrack, dualLayout]);

  // Host dual camera: open secondary facing stream + composite for viewers.
  useEffect(() => {
    if (!isHost || dualLayout === "none") {
      dualCompositeStopRef.current?.();
      dualCompositeStopRef.current = null;
      releaseSecondaryCamera(pipStreamRef.current);
      pipStreamRef.current = null;
      setPipReady(false);
      return;
    }

    let cancelled = false;
    const pipFacing: "user" | "environment" = mainFacing === "user" ? "environment" : "user";

    (async () => {
      dualCompositeStopRef.current?.();
      dualCompositeStopRef.current = null;
      releaseSecondaryCamera(pipStreamRef.current);
      pipStreamRef.current = null;

      const pip = await openSecondaryCamera(pipFacing);
      if (cancelled) {
        releaseSecondaryCamera(pip);
        return;
      }
      if (!pip) {
        toast({
          title: "Dual camera unavailable",
          description: "This device couldn’t open front and back together.",
          variant: "destructive",
        });
        setDualLayout("none");
        return;
      }
      pipStreamRef.current = pip;
      if (pipVideoRef.current) {
        pipVideoRef.current.srcObject = pip;
        await pipVideoRef.current.play().catch(() => {});
      }
      setPipReady(true);

      // Wait for raw host track + attach to hidden main video for compositing
      const raw = rawHostTrackRef.current;
      if (!raw || !dualMainVideoRef.current || !pipVideoRef.current) return;
      dualMainVideoRef.current.srcObject = new MediaStream([raw]);
      await dualMainVideoRef.current.play().catch(() => {});

      const shape = dualLayout === "circle" ? "circle" : "rectangle";
      const composite = startDualComposite(dualMainVideoRef.current, pipVideoRef.current, {
        pipShape: shape,
        mainMirrored: mainFacing === "user",
        pipMirrored: pipFacing === "user",
      });
      dualCompositeStopRef.current = composite.stop;
      await room.replaceVideoTrack(composite.track).catch((e: any) => {
        toast({ title: "Couldn't publish dual camera", description: e?.message, variant: "destructive" });
      });
    })();

    return () => {
      cancelled = true;
      dualCompositeStopRef.current?.();
      dualCompositeStopRef.current = null;
      releaseSecondaryCamera(pipStreamRef.current);
      pipStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, dualLayout, mainFacing, room.local?.videoTrack]);

  const handleShareLive = async () => {
    if (!session) return;
    const url = liveWatchUrl({
      circleId: session.circle_id,
      sessionId: session.circle_id ? null : session.id,
    });
    const result = await shareLiveInvite({
      url,
      title: "Join my live on YAJ",
      circleScoped: Boolean(session.circle_id),
    });
    if (result === "copied") {
      toast({ title: "Live link copied", description: "Send it by text or message so friends can join." });
    } else if (result === "failed") {
      toast({
        title: "Couldn't open share",
        description: "Copy this link and send it: " + url,
        variant: "destructive",
      });
    }
  };

  const swapDualCameras = () => {
    if (dualLayout === "none" || !pipReady) return;
    setMainFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const resolveName = async (userId: string): Promise<string> => {
    const cached = nameCache.current.get(userId);
    if (cached) return cached;
    const { data } = await sb.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
    const name = data?.display_name || "Someone";
    nameCache.current.set(userId, name);
    return name;
  };

  const spawnFloatingGift = (emoji: string) => {
    const floatId = `${Date.now()}-${Math.random()}`;
    setFloatingGifts((prev) => [...prev.slice(-11), { id: floatId, emoji }]);
    window.setTimeout(() => setFloatingGifts((prev) => prev.filter((g) => g.id !== floatId)), 4600);
  };

  const pushTicker = (text: string) => {
    const tickerId = `${Date.now()}-${Math.random()}`;
    setGiftTicker((prev) => [...prev.slice(-2), { id: tickerId, text }]);
    window.setTimeout(() => setGiftTicker((prev) => prev.filter((g) => g.id !== tickerId)), 4000);
  };

  // Realtime gift + comment feeds — every viewer (and the host) subscribes to the same
  // session. Gifts the *other* person sends arrive here; a gift YOU send is animated
  // instantly at tap-time in handleSendGift, so this skips your own sends to avoid a
  // double animation (see the sender_id check below).
  useEffect(() => {
    if (!session) return;
    void listCircleLiveComments(session.id).then(setComments).catch(() => setComments([]));

    const channel = supabase
      .channel(`circle-live-${session.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "circle_live_gifts", filter: `session_id=eq.${session.id}` },
        (payload: { new: CircleLiveGift }) => {
          if (payload.new.sender_id === user?.id) return; // already animated optimistically
          void (async () => {
            spawnFloatingGift(GIFT_EMOJI[payload.new.gift_type]);
            const entry = ALL_GIFTS.find((g) => g.type === payload.new.gift_type);
            const senderName = await resolveName(payload.new.sender_id);
            pushTicker(`${senderName} sent ${entry?.emoji ?? "🎁"} ${entry?.label ?? "a gift"}!`);
          })();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "circle_live_comments", filter: `session_id=eq.${session.id}` },
        (payload: { new: CircleLiveComment }) => setComments((prev) => [...prev.slice(-49), payload.new]),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.id, user?.id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ block: "end" });
  }, [comments.length]);

  const handleSendGift = async (giftType: GiftType) => {
    if (!session || !user?.id) return;
    const entry = ALL_GIFTS.find((g) => g.type === giftType);
    spawnFloatingGift(entry?.emoji ?? "🎁");
    pushTicker(`You sent ${entry?.emoji ?? "🎁"} ${entry?.label ?? "a gift"}!`);
    setGiftSheetOpen(false);
    try {
      await sendCircleLiveGift(session.id, session.circle_id, user.id, giftType);
    } catch (e: any) {
      toast({ title: "Couldn't send that gift", description: e.message, variant: "destructive" });
    }
  };

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || !session || !user?.id) return;
    setCommentText("");
    setSendingComment(true);
    try {
      await sendCircleLiveComment(session.id, session.circle_id, user.id, text);
    } catch (e: any) {
      toast({ title: "Couldn't send that", description: e.message, variant: "destructive" });
    } finally {
      setSendingComment(false);
    }
  };

  // —— Motor / stage derived state MUST stay above early returns (Rules of Hooks). ——
  const host = room.participants.find((p) => p.isHost);
  const stagePeople = useMemo(() => {
    if (isMultiMotor) return stageParticipantsFromRoom(room.participants);
    const h = room.participants.find((p) => p.isHost);
    return h ? [h] : [];
  }, [isMultiMotor, room.participants]);
  const onStage =
    !!room.local && (room.local.isHost || room.local.camOn || room.local.micOn || !!room.local.videoTrack);
  const seatsLeft = Math.max(0, LIVE_MOTOR_MAX_ON_STAGE - stagePeople.length);
  const viewerCount = Math.max(room.participants.length - 1, 0);
  const canvasIsLive = !!faceFilters.outputTrack && host?.videoTrack === faceFilters.outputTrack;
  const stageIdsKey = stagePeople.map((p) => p.id).join(",");

  useEffect(() => {
    if (focusedStageId && !stagePeople.some((p) => p.id === focusedStageId)) {
      setFocusedStageId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedStageId, stageIdsKey]);

  const hostEndedRef = useRef(false);

  const endHostSessionNow = useCallback(async () => {
    if (!session || !isHost || hostEndedRef.current) return;
    hostEndedRef.current = true;
    cancelPendingHostEnd(session.id);
    try {
      await endCircleLive(session.id);
    } catch {
      /* ignore — still leave the room */
    }
    try {
      room.disconnect();
    } catch {
      /* ignore */
    }
  }, [session, isHost, room]);

  // Cancel any pending end while this room stays mounted (Strict Mode remount-safe).
  useEffect(() => {
    if (!session?.id || !isHost) return;
    cancelPendingHostEnd(session.id);
    hostEndedRef.current = false;
    return () => {
      // Leaving the live screen as host must kill the session so it doesn't stay on Home.
      scheduleHostEnd(session.id, 700);
      try {
        room.disconnect();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, isHost]);

  // Tab close / iOS swipe-away — end immediately.
  useEffect(() => {
    if (!session?.id || !isHost) return;
    const kill = () => {
      hostEndedRef.current = true;
      cancelPendingHostEnd(session.id);
      void endCircleLive(session.id).catch(() => {});
    };
    window.addEventListener("pagehide", kill);
    window.addEventListener("beforeunload", kill);
    return () => {
      window.removeEventListener("pagehide", kill);
      window.removeEventListener("beforeunload", kill);
    };
  }, [session?.id, isHost]);

  const handleJoinStage = async () => {
    if (!stageJoinEnabled || isHost || joiningStage) return;
    // Host already gated Accept when full; guests who were accepted should still publish.
    if (seatsLeft <= 0 && !onStage && stageDoor.status !== "accepted") {
      toast({
        title: "Stage is full",
        description: `No space available — up to ${LIVE_MOTOR_MAX_ON_STAGE} people can be on stage.`,
      });
      return;
    }
    setJoiningStage(true);
    try {
      await room.startPublishing();
      toast({ title: "You're on stage", description: "Tap any person to see them full screen." });
    } catch (e: any) {
      toast({ title: "Couldn't join stage", description: e?.message, variant: "destructive" });
      stageDoor.resetToIdle();
    } finally {
      setJoiningStage(false);
    }
  };

  // Host accepted → guest publishes onto the motor stage.
  useEffect(() => {
    if (isHost || !stageJoinEnabled) return;
    if (stageDoor.status !== "accepted") return;
    if (onStage || joiningStage) return;
    void handleJoinStage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageDoor.status, isHost, stageJoinEnabled, onStage]);

  useEffect(() => {
    if (stageDoor.status === "declined" && stageDoor.declineReason) {
      toast({ title: "Request declined", description: stageDoor.declineReason, variant: "destructive" });
    }
    if (stageDoor.status === "full") {
      toast({
        title: "Stage is full",
        description: stageDoor.declineReason || "No space available to join right now.",
        variant: "destructive",
      });
    }
  }, [stageDoor.status, stageDoor.declineReason]);

  const handleRequestJoin = () => {
    if (!stageJoinEnabled || isHost || onStage) return;
    if (seatsLeft <= 0) {
      toast({
        title: "Stage is full",
        description: `No space available — up to ${LIVE_MOTOR_MAX_ON_STAGE} people can be on stage.`,
      });
      return;
    }
    if (stageDoor.status === "requesting") {
      stageDoor.cancelRequest();
      return;
    }
    stageDoor.requestJoin();
    toast({ title: "Request sent", description: "Waiting for the host to accept…" });
  };

  const handleAcceptRequest = (reqId: string) => {
    if (seatsLeft <= 0) {
      stageDoor.notifyFull(reqId);
      toast({
        title: "Stage is full",
        description: `No space available — up to ${LIVE_MOTOR_MAX_ON_STAGE} people on stage.`,
      });
      return;
    }
    stageDoor.accept(reqId);
    toast({ title: "Accepted", description: "They’re joining the stage." });
  };

  const handleLeaveStage = async () => {
    if (isHost) return;
    try {
      await room.stopPublishing();
      setFocusedStageId(null);
      stageDoor.resetToIdle();
      toast({ title: "Left the stage" });
    } catch (e: any) {
      toast({ title: "Couldn't leave stage", description: e?.message, variant: "destructive" });
    }
  };

  const handleLeave = () => {
    // Viewers just leave; hosts ending via X must kill the session.
    if (isHost) {
      setEnding(true);
      void endHostSessionNow().finally(() => {
        navigate(backPath, { replace: true });
      });
      return;
    }
    room.disconnect();
    navigate(backPath, { replace: true });
  };

  const handleEndLive = async () => {
    if (!session) return;
    setEnding(true);
    try {
      await endHostSessionNow();
      navigate(backPath, { replace: true });
    } catch (e: any) {
      toast({ title: "Couldn't end the live", description: e.message, variant: "destructive" });
      setEnding(false);
    }
  };

  if (session === undefined || (!isPublicRoute && circle === undefined)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white/70">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isPublicRoute && !circle) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p className="font-bold">This Circle isn't available.</p>
        <button type="button" onClick={() => navigate(backPath)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-black">
          Back to Circle
        </button>
      </div>
    );
  }

  if (!isApprovedMember) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p className="font-bold">You don't have access to this live.</p>
        <button type="button" onClick={() => navigate(backPath)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-black">
          Back to Circle
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <p className="font-bold">This live has ended.</p>
        <button type="button" onClick={() => navigate(backPath)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-black">
          Back to Circle
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white">
      {/* min-h-0 is load-bearing here — without it a flex child can't shrink below its
          content size, and the whole fixed page would grow and start scrolling instead
          of the video area just clipping its own overflow. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isMultiMotor ? (
          stagePeople.length > 0 || seatsLeft > 0 ? (
            <LiveMotorGrid
              participants={stagePeople}
              hostCssFilter={!canvasIsLive ? colorFilter : undefined}
              canvasIsLive={canvasIsLive}
              focusedId={focusedStageId}
              onFocusChange={setFocusedStageId}
              emptySeatCount={seatsLeft > 0 ? 1 : 0}
              emptySeatLabel={
                isHost ? "Invite" : seatsLeft <= 0 ? "Full" : "Ask to join"
              }
              onEmptySeatTap={
                isHost
                  ? () => void handleShareLive()
                  : onStage
                    ? undefined
                    : seatsLeft <= 0
                      ? () =>
                          toast({
                            title: "Stage is full",
                            description: "No space available to join right now.",
                          })
                      : handleRequestJoin
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-[13px] font-semibold">
                {room.connState === "connecting" ? "Connecting…" : "Waiting for people on stage…"}
              </p>
            </div>
          )
        ) : isHost ? (
          host && (
            <ParticipantVideo
              participant={host}
              mirrored
              cssFilter={!canvasIsLive ? colorFilter : undefined}
            />
          )
        ) : host?.videoTrack && host.camOn ? (
          <ParticipantVideo participant={host} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-[13px] font-semibold">
              {room.connState === "connecting" ? "Connecting…" : "Waiting for the host's video…"}
            </p>
          </div>
        )}

        <div className="absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
          </span>
          {isMultiMotor && (
            <span className="rounded-full bg-fuchsia-600/90 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide">
              Multi · {stagePeople.length}/{LIVE_MOTOR_MAX_ON_STAGE}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
            <Users className="h-3 w-3" /> {viewerCount}
          </span>
          {isHost && (
            <button
              type="button"
              onClick={() => setControlsOpen((v) => !v)}
              aria-label="Mic and camera controls"
              className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 backdrop-blur-sm"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${controlsOpen ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {isPublicRoute && !isHost && (
          <div className="absolute left-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+2.25rem)] flex items-center gap-2 rounded-full bg-black/50 py-1 pl-1 pr-2 backdrop-blur-sm">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white/20">
              {hostProfile?.avatar_url && <img src={hostProfile.avatar_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <span className="max-w-[7rem] truncate text-[12px] font-bold">{hostProfile?.display_name || "Host"}</span>
            <button
              type="button"
              onClick={toggleFollow}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${isFollowing ? "bg-white/15" : "bg-primary text-primary-foreground"}`}
            >
              {isFollowing ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        )}

        {isHost && controlsOpen && (
          <div className="absolute left-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+2.25rem)] flex gap-2 rounded-2xl bg-black/70 p-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => room.setMic(!room.local?.micOn)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${room.local?.micOn ? "bg-white/15" : "bg-white text-black"}`}
              aria-label="Toggle microphone"
            >
              {room.local?.micOn ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
            </button>
            <button
              type="button"
              onClick={() => room.setCam(!room.local?.camOn)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${room.local?.camOn ? "bg-white/15" : "bg-white text-black"}`}
              aria-label="Toggle camera"
            >
              {room.local?.camOn ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
            </button>
            <button
              type="button"
              onClick={() => setFaceFilterSheetOpen(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${faceFilter !== "none" ? "bg-white text-black" : "bg-white/15"}`}
              aria-label="Face filters"
            >
              <Smile className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEffects(false);
                setShowEnhance((v) => !v);
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${showEnhance || isEnhanceActive(enhance) ? "bg-white text-black" : "bg-white/15"}`}
              aria-label="Enhance"
            >
              <Sparkles className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEnhance(false);
                setShowEffects((v) => !v);
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${selectedEffect !== "none" ? "bg-white text-black" : "bg-white/15"}`}
              aria-label="Effects"
            >
              <Wand2 className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowDualSheet(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${dualLayout !== "none" ? "bg-white text-black" : "bg-white/15"}`}
              aria-label="Dual camera settings"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {/* Guest on motor stage — mic / cam only */}
        {isMultiMotor && onStage && !isHost && (
          <div className="absolute left-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+2.25rem)] flex gap-2 rounded-2xl bg-black/70 p-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => room.setMic(!room.local?.micOn)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${room.local?.micOn ? "bg-white/15" : "bg-white text-black"}`}
              aria-label="Toggle microphone"
            >
              {room.local?.micOn ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
            </button>
            <button
              type="button"
              onClick={() => room.setCam(!room.local?.camOn)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${room.local?.camOn ? "bg-white/15" : "bg-white text-black"}`}
              aria-label="Toggle camera"
            >
              {room.local?.camOn ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
            </button>
          </div>
        )}

        <div className="absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleShareLive()}
            aria-label="Share live link"
            className="rounded-full bg-black/50 p-2 backdrop-blur-sm"
          >
            <Share2 className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            disabled={ending}
            onClick={() => void (isHost ? handleEndLive() : handleLeave())}
            aria-label={isHost ? "End live" : "Leave"}
            className="rounded-full bg-black/50 p-2 backdrop-blur-sm disabled:opacity-60"
          >
            {ending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <X className="h-4.5 w-4.5" />}
          </button>
        </div>

        {isHost && (
          <button
            type="button"
            onClick={swapDualCameras}
            disabled={dualLayout === "none" || !pipReady}
            aria-label="Swap cameras"
            className={`absolute z-20 overflow-hidden border-2 border-white/80 shadow-lg transition-opacity ${
              dualLayout === "circle" ? "rounded-full" : "rounded-2xl"
            } ${dualLayout !== "none" && pipReady ? "opacity-100" : "pointer-events-none opacity-0"}`}
            style={{
              top: "max(calc(env(safe-area-inset-top) + 4.5rem), 5.5rem)",
              right: "0.75rem",
              width: dualLayout === "circle" ? "6.5rem" : "7.25rem",
              height: dualLayout === "circle" ? "6.5rem" : "9.5rem",
            }}
          >
            <video
              ref={pipVideoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
              style={{
                transform: (mainFacing === "user" ? "environment" : "user") === "user" ? "scaleX(-1)" : undefined,
              }}
            />
          </button>
        )}

        {/* Hidden main source for dual composite publish */}
        {isHost && (
          <video ref={dualMainVideoRef} playsInline muted autoPlay className="pointer-events-none invisible absolute h-px w-px" />
        )}

        {/* Floating gift animations */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 flex justify-end pr-4">
          <div className="relative h-full w-16">
            {floatingGifts.map((g) => (
              <FloatingGift key={g.id} emoji={g.emoji} />
            ))}
          </div>
        </div>

        {/* Gift ticker */}
        <div className="pointer-events-none absolute bottom-52 left-3 flex max-w-[65%] flex-col gap-1">
          {giftTicker.map((g) => (
            <p key={g.id} className="w-fit animate-in fade-in rounded-full bg-black/50 px-3 py-1 text-[12px] font-bold backdrop-blur-sm duration-300">
              {g.text}
            </p>
          ))}
        </div>

        {/* Host: pending join requests */}
        {stageJoinEnabled && isHost && stageDoor.pending.length > 0 && (
          <div className="absolute right-3 top-[calc(max(env(safe-area-inset-top),0.75rem)+3rem)] z-30 flex w-[min(100%-1.5rem,18rem)] flex-col gap-2">
            {stageDoor.pending.map((req) => (
              <div
                key={req.reqId}
                className="rounded-2xl border border-white/15 bg-black/75 p-3 shadow-lg backdrop-blur-md"
              >
                <p className="text-[12px] font-bold text-white">
                  <span className="text-teal-300">{req.name}</span> wants to join
                </p>
                <p className="mt-0.5 text-[10px] text-white/55">
                  {seatsLeft > 0
                    ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left`
                    : "Stage is full"}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAcceptRequest(req.reqId)}
                    disabled={seatsLeft <= 0}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-teal-500 py-1.5 text-[11px] font-black text-white disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {seatsLeft <= 0 ? "Full" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => stageDoor.decline(req.reqId)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/15 py-1.5 text-[11px] font-black text-white"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Multi join banner — request to join (host must accept) */}
        {stageJoinEnabled && !isHost && !onStage && (
          <div className="absolute bottom-[13.5rem] left-3 right-3 z-20 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/65 px-3 py-2.5 backdrop-blur-md">
            <p className="min-w-0 text-[12px] font-semibold leading-snug text-white/90">
              {seatsLeft <= 0
                ? "Stage is full — no space available to join"
                : stageDoor.status === "requesting"
                  ? "Waiting for the host to accept your request…"
                  : stageDoor.status === "declined"
                    ? "Request declined — you can ask again"
                    : "Ask to join the stage — host will accept or decline"}
            </p>
            {seatsLeft <= 0 ? (
              <span className="shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-[12px] font-black text-white/70">
                Full
              </span>
            ) : (
              <button
                type="button"
                disabled={joiningStage || stageDoor.status === "accepted"}
                onClick={handleRequestJoin}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-black text-white disabled:opacity-50 ${
                  stageDoor.status === "requesting" ? "bg-white/20" : "bg-teal-500"
                }`}
              >
                {stageDoor.status === "requesting" ? "Cancel" : "Request"}
              </button>
            )}
          </div>
        )}

        {/* Comment feed — holds the last 7 on screen before the oldest scrolls out. */}
        <div className="pointer-events-none absolute bottom-0 left-0 flex max-h-48 w-[70%] flex-col justify-end gap-1 overflow-hidden px-3 pb-2">
          {comments.slice(-7).map((c) => (
            <CommentLine key={c.id} comment={c} nameCache={nameCache} resolveName={resolveName} isMe={c.sender_id === user?.id} />
          ))}
          <div ref={commentsEndRef} />
        </div>

        {giftSheetOpen && (
          <div className="absolute inset-0 z-20 flex items-end bg-black/60" onClick={() => setGiftSheetOpen(false)}>
            <div
              className="w-full rounded-t-3xl bg-neutral-900 px-4 pb-6 pt-4"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-3 text-center text-[12px] font-bold text-white/60">
                Gifts are free during testing — real payments are coming soon.
              </p>
              <div className="grid grid-cols-5 gap-2">
                {GIFT_CATALOG.map((g) => (
                  <button
                    key={g.type}
                    type="button"
                    onClick={() => handleSendGift(g.type)}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 py-3 active:scale-95"
                  >
                    <span className="text-2xl">{g.emoji}</span>
                    <span className="text-[10.5px] font-bold">{g.label}</span>
                    <span className="text-[9.5px] text-white/50">{g.value}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isHost && (
          <>
            <FaceFilterPanel
              open={faceFilterSheetOpen}
              onClose={() => setFaceFilterSheetOpen(false)}
              selectedId={faceFilter}
              onSelect={setFaceFilter}
              loading={faceFilters.loading}
              error={faceFilters.error}
            />
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
            <DualCameraLayoutSheet
              open={showDualSheet}
              layout={dualLayout}
              onLayoutChange={(layout) => {
                setDualLayout(layout);
                if (layout === "none") setShowDualSheet(false);
              }}
              onClose={() => setShowDualSheet(false)}
            />
            {/* Never shown directly — useFaceFilters draws into this canvas, then
                captureStream() turns it into the track that gets published. Uses
                `invisible` (visibility:hidden), not `hidden` (display:none) — the same
                fix already learned for the Podcast background-replacement canvas:
                display:none skips layout entirely and the canvas never gets a real
                backing store, so the hook waits ~2s and gives up with "Canvas not
                ready", which is exactly what was happening here before. */}
            <canvas ref={faceFilters.canvasRef} className="invisible absolute inset-0 h-px w-px" />
          </>
        )}
      </div>

      {/* One fixed-height bottom row — comment input plus (viewer) Like/Gift / Join stage */}
      <div
        className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-black/90 px-3 py-2"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
          placeholder="Say something…"
          maxLength={200}
          className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-[13px] outline-none placeholder:text-white/40"
        />
        <button
          type="button"
          disabled={!commentText.trim() || sendingComment}
          onClick={handleSendComment}
          aria-label="Send comment"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
        {stageJoinEnabled && !isHost && (
          onStage ? (
            <button
              type="button"
              onClick={() => void handleLeaveStage()}
              className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-[12px] font-black"
            >
              <LogOut className="h-3.5 w-3.5" /> Leave
            </button>
          ) : seatsLeft <= 0 ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-2 text-[12px] font-black text-white/60">
              Full
            </span>
          ) : (
            <button
              type="button"
              disabled={joiningStage || stageDoor.status === "accepted"}
              onClick={handleRequestJoin}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[12px] font-black text-white disabled:opacity-40 ${
                stageDoor.status === "requesting" ? "bg-white/20" : "bg-teal-500"
              }`}
            >
              {joiningStage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Hand className="h-3.5 w-3.5" />
              )}
              {stageDoor.status === "requesting" ? "Cancel" : "Ask"}
            </button>
          )
        )}
        {!isHost && (
          <>
            <button
              type="button"
              onClick={() => handleSendGift(LIKE_GIFT.type)}
              aria-label="Like"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-90"
            >
              <Heart className="h-4 w-4 text-red-500" fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={() => setGiftSheetOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 px-3.5 py-2 text-[12.5px] font-black text-white active:scale-95"
            >
              <Gift className="h-4 w-4" /> Gift
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CommentLine({
  comment,
  nameCache,
  resolveName,
  isMe,
}: {
  comment: CircleLiveComment;
  nameCache: { current: Map<string, string> };
  resolveName: (userId: string) => Promise<string>;
  isMe: boolean;
}) {
  const [name, setName] = useState(nameCache.current.get(comment.sender_id) ?? (isMe ? "You" : "…"));

  useEffect(() => {
    if (isMe || nameCache.current.has(comment.sender_id)) return;
    void resolveName(comment.sender_id).then(setName);
  }, [comment.sender_id, isMe]);

  return (
    <p className="w-fit max-w-full rounded-xl bg-black/40 px-2.5 py-1 text-[12.5px] leading-snug backdrop-blur-sm">
      <span className="font-black">{isMe ? "You" : name}</span> <span className="text-white/90">{comment.text}</span>
    </p>
  );
}

function FloatingGift({ emoji }: { emoji: string }) {
  const [offsetX] = useState(() => Math.round((Math.random() - 0.5) * 120));
  return (
    // left/margin (not transform) position it horizontally, so it doesn't fight the
    // emoji-float keyframe's own `transform` for the rise-and-fade motion.
    <span className="absolute bottom-0 animate-emoji-float text-4xl" style={{ left: `calc(50% + ${offsetX}px)`, marginLeft: "-1rem" }}>
      {emoji}
    </span>
  );
}

function ParticipantVideo({
  participant,
  mirrored,
  cssFilter,
}: {
  participant: RoomParticipant;
  mirrored?: boolean;
  /** Instant local preview only — the canvas pipeline (once it catches up) bakes the
   *  same look into the actual published pixels; this just closes the gap so the host
   *  isn't staring at an unfiltered picture for the second or two that takes. */
  cssFilter?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // A remote participant's video+audio go on the SAME <video> element (one MediaStream
  // with both tracks) — splitting audio into a separate <audio autoPlay> element, as
  // this used to do, is much more likely to get silently blocked by iOS/Safari's
  // autoplay-with-sound policy since that element never had its own play() call tied to
  // anything. Local (your own) preview stays muted either way, to avoid echoing your mic
  // back at yourself.
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const tracks = [participant.videoTrack, participant.audioTrack].filter(Boolean) as MediaStreamTrack[];
    el.srcObject = tracks.length ? new MediaStream(tracks) : null;
    if (tracks.length) {
      el.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    }
  }, [participant.videoTrack, participant.audioTrack]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
        className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
        style={cssFilter && cssFilter !== "none" ? { filter: cssFilter } : undefined}
      />
      {needsTap && !participant.isLocal && (
        <button
          type="button"
          onClick={() => {
            videoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {});
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white"
        >
          <span className="text-3xl">🔊</span>
          <span className="text-[13px] font-bold">Tap for sound</span>
        </button>
      )}
    </>
  );
}
