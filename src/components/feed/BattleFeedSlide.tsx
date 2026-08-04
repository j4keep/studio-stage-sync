import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Forward,
  HandHeart,
  Heart,
  MessageCircle,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import BattleNeonVoteBar from "@/components/battle/BattleNeonVoteBar";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
import BattleWinnerCheckBadge from "@/components/battle/BattleWinnerCheckBadge";
import BattleLiveStage, {
  BATTLE_FEED_TILE,
  BATTLE_FEED_TILE_EXPANDED,
} from "@/components/battle/BattleLiveStage";
import { MOBILE_COMMENTS_VIDEO_HEIGHT } from "@/components/feed/PostCommentsSheet";
import {
  canUserVoteForSide,
  firstName,
  formatClockMmSs,
  formatCompact,
  formatCountdown,
  getBattleExpiresAt,
  getBattleUiStatus,
  getBattleWinnerSide,
  isBattleVotingOpen,
  tallyBattleVotes,
} from "@/lib/battle-ui";
import { ensureBattleWinRecorded } from "@/lib/finalize-battle-wins";
import {
  getBattleReplayMediaUrl,
  getBattleScheduledStartAt,
  getLiveBattleEndsAt,
  getLiveBattlePhase,
} from "@/lib/battle-live";
import { incrementBattleViews } from "@/hooks/use-likes";
import { readMediaDuration, resolveMediaDuration } from "@/lib/media-duration";
import {
  applyFeedVideoAudio,
  armFeedAudioPlayback,
  forceIosAudioSessionToPlayback,
  hardStopFeedMedia,
  unlockFeedAudioSession,
  waitForVideoCanPlay,
} from "@/lib/feed-video-playback";

type Props = {
  battle: any;
  currentUserId?: string;
  isActive?: boolean;
  onScrollLockChange?: (locked: boolean) => void;
};

const EMOJIS = ["🔥", "💀", "🎤", "👑", "💪", "😤", "🏆", "⚡"];

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/**
 * Fullscreen battle feed slide — same bottom chrome language as regular posts.
 * Tap a side to play/pause that side; tracks auto-advance when one finishes.
 */
export default function BattleFeedSlide({
  battle,
  currentUserId,
  isActive = false,
  onScrollLockChange,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const uid = currentUserId || user?.id;

  const mediaType = (battle?.media_type || "audio").toLowerCase();
  const initialSide: "left" | "right" = battle?.challenger_media_url
    ? "left"
    : battle?.opponent_media_url
      ? "right"
      : "left";

  const [liked, setLiked] = useState(Boolean(battle?.isLiked));
  const [likesCount, setLikesCount] = useState(battle?.likes_count || 0);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  // Start on the side that has media so the <video> is mounted on first paint
  // (waiting for setState+rAF before play() was killing the user-gesture → silent/frozen).
  const [activeSide, setActiveSide] = useState<"left" | "right">(initialSide);
  const [expandedSide, setExpandedSide] = useState<"left" | "right" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [silentLocked, setSilentLocked] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  /** One decoder at a time — same contract as FeedPostCard (dual videos froze iOS). */
  const activeMediaRef = useRef<HTMLMediaElement | null>(null);
  const liveReplayRef = useRef<HTMLVideoElement | null>(null);
  const seekTrackRef = useRef<HTMLDivElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const viewedRef = useRef(false);
  const activeSideRef = useRef<"left" | "right">(initialSide);
  const autoStartedRef = useRef<string | null>(null);
  const userPausedRef = useRef(false);
  const silentLockedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const mediaSessionCleanupRef = useRef<(() => void) | null>(null);
  const playSideRef = useRef<
    (side: "left" | "right", opts?: { fromStart?: boolean }) => Promise<boolean>
  >(async () => false);
  const lastTapRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchHandledRef = useRef(false);
  isActiveRef.current = isActive;
  silentLockedRef.current = silentLocked;
  const liveReplayUrl = mediaType === "live" ? getBattleReplayMediaUrl(battle || {}) : null;
  const livePhase = mediaType === "live" ? getLiveBattlePhase(battle || {}, now) : null;
  // Bottom seek like regular posts — only once the live debate has a replay / ended.
  const showLiveSeek = mediaType === "live" && (livePhase === "ended" || !!liveReplayUrl);

  useEffect(() => {
    activeSideRef.current = activeSide;
  }, [activeSide]);

  // Only reset playback state when the battle identity changes — feed refetches
  // update likes_count and were restarting autoplay + fighting the snap scroller.
  useEffect(() => {
    setLiked(Boolean(battle?.isLiked));
    setLikesCount(battle?.likes_count || 0);
    setShowComments(false);
    setSaved(false);
    setExpandedSide(null);
    onScrollLockChange?.(false);
    autoStartedRef.current = null;
    silentLockedRef.current = false;
    setSilentLocked(false);
    const nextSide: "left" | "right" = battle?.challenger_media_url
      ? "left"
      : battle?.opponent_media_url
        ? "right"
        : "left";
    setActiveSide(nextSide);
    activeSideRef.current = nextSide;
  }, [battle?.id, battle?.challenger_media_url, battle?.opponent_media_url, onScrollLockChange]);

  useEffect(() => {
    setLiked(Boolean(battle?.isLiked));
    setLikesCount(battle?.likes_count || 0);
  }, [battle?.isLiked, battle?.likes_count]);

  useEffect(() => {
    if (!showComments) return;
    const stage = rootRef.current?.closest(".snap-start") as HTMLElement | null;
    const scroller = stage?.parentElement;
    if (!scroller) return;
    const prevOverflow = scroller.style.overflowY;
    const prevTouch = scroller.style.touchAction;
    const prevSnap = scroller.style.scrollSnapType;
    scroller.style.overflowY = "hidden";
    scroller.style.touchAction = "none";
    scroller.style.scrollSnapType = "none";
    return () => {
      scroller.style.overflowY = prevOverflow;
      scroller.style.touchAction = prevTouch;
      scroller.style.scrollSnapType = prevSnap;
    };
  }, [showComments]);

  useEffect(() => {
    if (!isActive || !battle?.id || viewedRef.current) return;
    viewedRef.current = true;
    incrementBattleViews(battle.id);
  }, [isActive, battle?.id]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), mediaType === "live" ? 250 : 1000);
    return () => window.clearInterval(t);
  }, [mediaType]);

  const mediaEl = useCallback(() => {
    if (mediaType === "live") return liveReplayRef.current;
    return activeMediaRef.current;
  }, [mediaType]);

  const hardStopMedia = useCallback(() => {
    mediaSessionCleanupRef.current?.();
    mediaSessionCleanupRef.current = null;
    hardStopFeedMedia(activeMediaRef.current);
    hardStopFeedMedia(liveReplayRef.current);
    setPlaying(false);
    silentLockedRef.current = false;
    setSilentLocked(false);
  }, []);

  // Live replay progress — throttled (not every animation frame) to cut feed jank.
  useEffect(() => {
    if (!isActive || mediaType !== "live") return;
    let timer = 0;
    let probing = false;
    const tick = () => {
      const el = liveReplayRef.current;
      if (el && !isScrubbing) {
        let d = readMediaDuration(el);
        // Only probe while fully paused and still at the start — never while
        // autoplay is spinning up (seeking froze battles at 0 like posts used to).
        if (
          d <= 0 &&
          !probing &&
          el.readyState >= 1 &&
          el.paused &&
          (el.currentTime || 0) < 0.02
        ) {
          probing = true;
          void resolveMediaDuration(el).then((resolved) => {
            if (resolved > 0) {
              setDuration(resolved);
              const t = el.currentTime || 0;
              setCurrentTime(t);
              setProgress((t / resolved) * 100);
            }
            probing = false;
          });
        }
        const t = el.currentTime || 0;
        if (d > 0) setDuration(d);
        setCurrentTime(t);
        setProgress(d > 0 ? (t / d) * 100 : 0);
        setPlaying(!el.paused);
      }
      timer = window.setTimeout(tick, 125);
    };
    timer = window.setTimeout(tick, 125);
    return () => window.clearTimeout(timer);
  }, [isActive, mediaType, isScrubbing, liveReplayUrl]);

  // Resume live replay after leaving the app / locking the phone.
  useEffect(() => {
    if (!isActive || mediaType !== "live") return;
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      if (userPausedRef.current) return;
      const el = liveReplayRef.current;
      if (!el) return;
      forceIosAudioSessionToPlayback();
      mediaSessionCleanupRef.current?.();
      mediaSessionCleanupRef.current = armFeedAudioPlayback(el, {
        title: battle?.title || "YAJ Battle",
      });
      if (el.paused) void el.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [isActive, mediaType, liveReplayUrl, battle?.title]);

  const scrubToClientX = useCallback(
    (clientX: number) => {
      const track = seekTrackRef.current;
      const el = mediaEl();
      if (!track || !el) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)));
      const d = readMediaDuration(el);
      if (d <= 0) {
        void resolveMediaDuration(el).then((resolved) => {
          if (resolved <= 0) return;
          el.currentTime = pct * resolved;
          setProgress(pct * 100);
          setCurrentTime(pct * resolved);
          setDuration(resolved);
        });
        return;
      }
      el.currentTime = pct * d;
      setProgress(pct * 100);
      setCurrentTime(pct * d);
      setDuration(d);
    },
    [mediaEl],
  );

  const handleScrubStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsScrubbing(true);
      const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
      if (typeof clientX === "number") scrubToClientX(clientX);

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const x = "touches" in ev ? ev.touches[0]?.clientX : ev.clientX;
        if (typeof x === "number") scrubToClientX(x);
      };
      const onEnd = () => {
        setIsScrubbing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
        const el = mediaEl();
        // Resume only if the post was playing before scrub — don't force play when paused.
        if (el && el.paused && playing && !userPausedRef.current) {
          void playSideRef.current(activeSideRef.current, { fromStart: false });
        }
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
    },
    [mediaEl, scrubToClientX, playing],
  );

  const armAudibleEl = useCallback(
    (el: HTMLMediaElement) => {
      forceIosAudioSessionToPlayback();
      unlockFeedAudioSession();
      mediaSessionCleanupRef.current?.();
      mediaSessionCleanupRef.current = armFeedAudioPlayback(el, {
        title: battle?.title || "YAJ Battle",
      });
      silentLockedRef.current = false;
      setSilentLocked(false);
    },
    [battle?.title],
  );

  /**
   * Play one side using the same ready-gate / mute-kick path as FeedPostCard.
   * Only one media element is mounted (active side), so iOS isn't fighting two decoders.
   */
  const playSide = useCallback(
    async (side: "left" | "right", opts?: { fromStart?: boolean }): Promise<boolean> => {
      userPausedRef.current = false;
      const sideChanged = activeSideRef.current !== side;
      if (sideChanged) {
        setActiveSide(side);
        activeSideRef.current = side;
        // Only wait for mount when switching sides — first paint already has initialSide media.
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        });
      }

      if (!isActiveRef.current || userPausedRef.current) return false;

      const el = mediaType === "live" ? liveReplayRef.current : activeMediaRef.current;
      if (!el) {
        setPlaying(false);
        return false;
      }

      el.loop = false;
      el.removeAttribute("loop");
      el.preload = "auto";
      // Promote the video onto its own compositor layer so iOS actually paints frames
      // (progress was advancing while the picture stayed frozen under overlays).
      if (el instanceof HTMLVideoElement) {
        el.style.transform = "translateZ(0)";
        el.style.webkitTransform = "translateZ(0)";
        el.style.zIndex = "1";
      }

      // Seek once when switching sides / starting — never on soft retries near 0.
      if (opts?.fromStart) {
        try {
          if ((el.currentTime || 0) > 0.25) el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }

      const ready = await waitForVideoCanPlay(el, 3500);
      if (!ready || !isActiveRef.current || userPausedRef.current) {
        setPlaying(false);
        return false;
      }

      const playSilently = async () => {
        if (el instanceof HTMLVideoElement) applyFeedVideoAudio(el, { muted: true });
        else {
          el.muted = true;
          el.volume = 0;
        }
        try {
          await el.play();
          setPlaying(true);
          silentLockedRef.current = true;
          setSilentLocked(true);
          return true;
        } catch {
          setPlaying(false);
          return false;
        }
      };

      // Already playing — upgrade silent → audible if needed.
      if (!el.paused && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (el.muted || el.volume === 0 || silentLockedRef.current) {
          armAudibleEl(el);
        } else {
          armAudibleEl(el);
        }
        setPlaying(true);
        return true;
      }

      // Always try audible first (Posts do this after unlock). Fall back to muted.
      forceIosAudioSessionToPlayback();
      armAudibleEl(el);

      try {
        await el.play();
        setPlaying(true);
        silentLockedRef.current = false;
        setSilentLocked(false);
        // Nudge a paint if the decoder stalled on frame 0.
        if (el instanceof HTMLVideoElement && el.videoWidth > 0 && el.currentTime < 0.05) {
          try {
            const t = el.currentTime;
            el.currentTime = t + 0.001;
            el.currentTime = t;
          } catch {
            /* ignore */
          }
        }
        return true;
      } catch {
        mediaSessionCleanupRef.current?.();
        mediaSessionCleanupRef.current = null;
        return playSilently();
      }
    },
    [mediaType, armAudibleEl],
  );
  playSideRef.current = playSide;

  const toggleSide = useCallback(
    (side: "left" | "right") => {
      const el = mediaType === "live" ? liveReplayRef.current : activeMediaRef.current;
      // Tap while muted-autoplaying must UNMUTE, not pause — that felt like a total glitch.
      if (
        activeSideRef.current === side &&
        playing &&
        el &&
        (el.muted || el.volume === 0 || silentLockedRef.current)
      ) {
        void playSide(side, { fromStart: false });
        return;
      }
      if (activeSideRef.current === side && playing) {
        userPausedRef.current = true;
        hardStopMedia();
        silentLockedRef.current = false;
        setSilentLocked(false);
        return;
      }
      void playSide(side, { fromStart: activeSideRef.current !== side });
    },
    [hardStopMedia, playSide, playing, mediaType],
  );

  // Upgrade silent autoplay → audible on the next feed gesture (same as FeedPostCard).
  useEffect(() => {
    if (!isActive) return;
    const upgrade = () => {
      if (!silentLockedRef.current || userPausedRef.current) return;
      const el = mediaType === "live" ? liveReplayRef.current : activeMediaRef.current;
      if (!el || el.paused) return;
      armAudibleEl(el);
      void el.play().catch(() => undefined);
    };
    window.addEventListener("feed-audio-unlocked", upgrade);
    const root = rootRef.current;
    root?.addEventListener("pointerdown", upgrade, { capture: true });
    return () => {
      window.removeEventListener("feed-audio-unlocked", upgrade);
      root?.removeEventListener("pointerdown", upgrade, { capture: true } as EventListenerOptions);
    };
  }, [isActive, mediaType, armAudibleEl]);

  /** Single tap = play/pause that side. Double tap = expand / minimize that card. */
  const handleArtistTap = useCallback(
    (side: "left" | "right") => {
      const nowTs = Date.now();
      const isDoubleTap =
        lastTapSideRef.current === side && nowTs - lastTapRef.current < 320;

      lastTapRef.current = nowTs;
      lastTapSideRef.current = side;

      if (isDoubleTap) {
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        setExpandedSide((prev) => (prev === side ? null : side));
        return;
      }

      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        toggleSide(side);
      }, 280);
    },
    [toggleSide],
  );

  const handleArtistTouchEnd = useCallback(
    (e: React.TouchEvent, side: "left" | "right") => {
      e.stopPropagation();
      e.preventDefault();
      touchHandledRef.current = true;
      handleArtistTap(side);
    },
    [handleArtistTap],
  );

  const handleArtistClick = useCallback(
    (e: React.MouseEvent, side: "left" | "right") => {
      e.stopPropagation();
      if (touchHandledRef.current) {
        touchHandledRef.current = false;
        return;
      }
      handleArtistTap(side);
    },
    [handleArtistTap],
  );

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  // Autoplay when the slide becomes active — same timing/retry contract as FeedPostCard.
  useEffect(() => {
    if (mediaType === "live") {
      if (!isActive) {
        hardStopMedia();
        autoStartedRef.current = null;
        userPausedRef.current = false;
        return;
      }
      if (userPausedRef.current) return;
      let cancelled = false;
      const start = async () => {
        if (cancelled || userPausedRef.current) return;
        const ok = await playSideRef.current("left", { fromStart: true });
        if (!cancelled && ok) autoStartedRef.current = battle?.id ?? null;
      };
      const t1 = window.setTimeout(() => {
        void start();
      }, 120);
      const t2 = window.setTimeout(() => {
        if (autoStartedRef.current === battle?.id) return;
        void playSideRef.current("left", { fromStart: false });
      }, 450);
      return () => {
        cancelled = true;
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }

    if (!isActive || !battle?.id) {
      if (!isActive) {
        hardStopMedia();
        setExpandedSide(null);
        autoStartedRef.current = null;
        userPausedRef.current = false;
      }
      return;
    }

    const startSide: "left" | "right" = battle.challenger_media_url
      ? "left"
      : battle.opponent_media_url
        ? "right"
        : "left";
    if (!battle.challenger_media_url && !battle.opponent_media_url) return;

    let cancelled = false;
    userPausedRef.current = false;
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);

    const attempt = async (fromStart: boolean) => {
      if (cancelled || userPausedRef.current) return;
      const ok = await playSideRef.current(startSide, { fromStart });
      if (!cancelled && ok) autoStartedRef.current = battle.id;
    };

    void attempt(true);
    // Soft retry if the first play raced the decoder — do NOT re-seek.
    const retryId = window.setTimeout(() => {
      if (cancelled || userPausedRef.current) return;
      const el = activeMediaRef.current;
      if (el && !el.paused) return;
      void attempt(false);
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(retryId);
    };
  }, [
    isActive,
    battle?.id,
    battle?.challenger_media_url,
    battle?.opponent_media_url,
    mediaType,
    hardStopMedia,
  ]);

  // Play the other side when a track ends. Do NOT auto-advance the feed.
  useEffect(() => {
    if (!isActive || mediaType === "live") return;
    const el = activeMediaRef.current;
    if (!el) return;

    const onEnded = () => {
      const finished = activeSideRef.current;
      const other: "left" | "right" = finished === "left" ? "right" : "left";
      const otherUrl =
        other === "left" ? battle?.challenger_media_url : battle?.opponent_media_url;
      if (otherUrl) {
        window.requestAnimationFrame(() => {
          void playSideRef.current(other, { fromStart: true });
        });
        return;
      }
      setPlaying(false);
    };

    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [
    isActive,
    mediaType,
    activeSide,
    battle?.challenger_media_url,
    battle?.opponent_media_url,
    battle?.id,
  ]);

  // Progress for the active side (throttled — rAF setState was janking phones).
  useEffect(() => {
    if (!isActive || mediaType === "live") return;
    let timer = 0;
    const tick = () => {
      const el = mediaEl();
      if (el) {
        const d = readMediaDuration(el) || el.duration || 0;
        const t = el.currentTime || 0;
        setDuration(d);
        setCurrentTime(t);
        setProgress(d > 0 ? (t / d) * 100 : 0);
      }
      timer = window.setTimeout(tick, 125);
    };
    timer = window.setTimeout(tick, 125);
    return () => window.clearTimeout(timer);
  }, [isActive, mediaEl, activeSide, playing, mediaType]);

  useEffect(() => {
    return () => {
      hardStopMedia();
    };
  }, [hardStopMedia]);

  const openComments = useCallback(() => {
    onScrollLockChange?.(true);
    setExpandedSide(null);
    setShowComments(true);
  }, [onScrollLockChange]);

  const closeComments = useCallback(() => {
    setShowComments(false);
    onScrollLockChange?.(false);
  }, [onScrollLockChange]);

  const profileIds = useMemo(
    () => [battle?.challenger_id, battle?.opponent_id].filter(Boolean) as string[],
    [battle?.challenger_id, battle?.opponent_id],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["battle-feed-profiles", battle?.id, profileIds.join(",")],
    queryFn: async () => {
      if (!profileIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", profileIds);
      return data || [];
    },
    enabled: !!battle?.id && profileIds.length > 0,
  });
  const profileMap = new Map((profiles as any[]).map((p) => [p.user_id, p]));
  const leftProfile = profileMap.get(battle?.challenger_id) || {};
  const rightProfile = profileMap.get(battle?.opponent_id) || {};
  const leftName = leftProfile.display_name || "Artist A";
  const rightName = rightProfile.display_name || "Artist B";

  const { data: votes = [] } = useQuery({
    queryKey: ["battle-votes", battle?.id],
    queryFn: async () => {
      const { data } = await supabase.from("battle_votes").select("*").eq("battle_id", battle.id);
      return data || [];
    },
    enabled: !!battle?.id,
    refetchInterval: isActive ? 5000 : false,
  });

  const { data: battleComments = [] } = useQuery({
    queryKey: ["battle-comments", battle?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("battle_comments")
        .select("*")
        .eq("battle_id", battle.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!battle?.id,
  });

  const commentUserIds = useMemo(
    () => [...new Set((battleComments as any[]).map((c) => c.user_id))],
    [battleComments],
  );
  const { data: commentProfiles = [] } = useQuery({
    queryKey: ["battle-comment-profiles", commentUserIds.join(",")],
    queryFn: async () => {
      if (!commentUserIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", commentUserIds);
      return data || [];
    },
    enabled: commentUserIds.length > 0,
  });
  const commentProfileMap = new Map((commentProfiles as any[]).map((p) => [p.user_id, p]));

  useEffect(() => {
    if (showComments) commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleComments.length, showComments]);

  const uiStatus = getBattleUiStatus(battle || {});
  // "ended" for UI chrome = voting window closed (not live-debate call end).
  const ended = uiStatus === "ended";
  // Feed clock = 24h voting window (live debate length is shown inside BattleLiveStage).
  const msLeft = getBattleExpiresAt(battle || {}).getTime() - now;
  const votingOpen = isBattleVotingOpen(battle || {});
  const tally = tallyBattleVotes(votes as any[], battle?.challenger_id, battle?.opponent_id);
  const winnerSide = getBattleWinnerSide(battle || {}, tally, votingOpen);

  // When the vote clock ends, persist a permanent battle_wins row for Winning Street.
  useEffect(() => {
    if (!battle?.id || votingOpen) return;
    let cancelled = false;
    void (async () => {
      const recorded = await ensureBattleWinRecorded(battle, {
        votes: votes as any[],
        userId: uid,
      });
      if (cancelled || !recorded) return;
      void qc.invalidateQueries({ queryKey: ["battle-arena-record"] });
      void qc.invalidateQueries({ queryKey: ["battle-arena-record-preview"] });
      void qc.invalidateQueries({ queryKey: ["battles"] });
      void qc.invalidateQueries({ queryKey: ["feed-posts"] });
    })();
    return () => {
      cancelled = true;
    };
  }, [battle, votingOpen, votes, uid, qc]);

  // Gate votes only on the 24h window — debate call ending must not lock the bar.
  const leftVoteGate = canUserVoteForSide(uid, battle?.challenger_id, {
    ended: !votingOpen,
    votingOpen,
  });
  const rightVoteGate = canUserVoteForSide(uid, battle?.opponent_id, {
    ended: !votingOpen,
    votingOpen,
  });
  const voteMutation = useMutation({
    mutationFn: async (side: "left" | "right") => {
      if (!uid || !battle) return;
      if (!isBattleVotingOpen(battle)) {
        toast.error("Voting closed — time expired");
        return;
      }
      const targetId = side === "left" ? battle.challenger_id : battle.opponent_id;
      const gate = canUserVoteForSide(uid, targetId, { ended: false, votingOpen: true });
      if (!gate.allowed) {
        toast.error(gate.reason || "Can't vote");
        return;
      }
      const existing = (votes as any[]).find((v) => v.user_id === uid);
      let error;
      if (existing) {
        ({ error } = await supabase.from("battle_votes").update({ voted_for: targetId }).eq("id", existing.id));
      } else {
        ({ error } = await supabase
          .from("battle_votes")
          .insert({ battle_id: battle.id, user_id: uid, voted_for: targetId }));
      }
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vote counted");
      qc.invalidateQueries({ queryKey: ["battle-votes", battle?.id] });
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Couldn't save vote");
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!uid) throw new Error("auth");
      await (supabase as any)
        .from("battle_comments")
        .insert({ battle_id: battle.id, user_id: uid, content });
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["battle-comments", battle?.id] });
    },
    onError: () => toast.error("Sign in to comment"),
  });

  const toggleLike = async () => {
    if (!uid) return toast.error("Sign in to like");
    const next = !liked;
    setLiked(next);
    setLikesCount((c: number) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        await (supabase as any)
          .from("likes")
          .insert({ user_id: uid, content_id: battle.id, content_type: "battle" });
      } else {
        await (supabase as any)
          .from("likes")
          .delete()
          .eq("user_id", uid)
          .eq("content_id", battle.id)
          .eq("content_type", "battle");
      }
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
      qc.invalidateQueries({ queryKey: ["battles"] });
    } catch {
      setLiked(!next);
      setLikesCount((c: number) => Math.max(0, c + (next ? -1 : 1)));
      toast.error("Could not update like");
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/battle/${battle.id}`;
    const title = battle.title || "YAJ Battle";
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }
    } catch {
      /* cancelled */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch {
      toast.error("Could not share");
    }
  };

  // Never use a video media URL as an <img> cover — that broke battle posters.
  const leftCover =
    battle?.challenger_cover_url ||
    (mediaType === "video" ? null : battle?.challenger_media_url);
  const rightCover =
    battle?.opponent_cover_url ||
    (mediaType === "video" ? null : battle?.opponent_media_url);
  const scheduledStartAt = getBattleScheduledStartAt(battle || {});
  const msToStart = scheduledStartAt
    ? new Date(scheduledStartAt).getTime() - now
    : 0;
  const liveDebateMsLeft =
    mediaType === "live" ? getLiveBattleEndsAt(battle || {}).getTime() - now : 0;
  const timerLabel =
    ended || msLeft <= 0
      ? "Ended"
      : mediaType === "live" && livePhase === "countdown"
        ? `Starts ${formatCountdown(msToStart)}`
        : mediaType === "live" && livePhase === "live"
          ? `Live · ${formatCountdown(Math.max(0, liveDebateMsLeft))}`
          : uiStatus === "countdown"
            ? `Starts ${formatCountdown(msToStart)}`
            : msLeft <= 60_000
              ? formatClockMmSs(msLeft)
              : formatCountdown(msLeft);
  const nowPlayingName = activeSide === "left" ? leftName : rightName;

  const formatCount = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(value);
  };

  const renderCompetitor = (side: "left" | "right") => {
    const name = side === "left" ? leftName : rightName;
    const profile = side === "left" ? leftProfile : rightProfile;
    const cover = side === "left" ? leftCover : rightCover;
    const mediaUrl = side === "left" ? battle?.challenger_media_url : battle?.opponent_media_url;
    const votesN = side === "left" ? tally.leftVotes : tally.rightVotes;
    const isActiveSide = activeSide === side;
    const isExpanded = expandedSide === side;
    const isHidden = expandedSide != null && expandedSide !== side;
    const userId = side === "left" ? battle?.challenger_id : battle?.opponent_id;

    return (
      <div
        className={`relative overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 transition-all duration-300 ${
          side === "left" ? "ring-cyan-300/90" : "ring-pink-400/90"
        } ${isActiveSide && playing ? "opacity-100" : "opacity-85"} ${
          isHidden
            ? "hidden"
            : isExpanded
              ? BATTLE_FEED_TILE_EXPANDED
              : showComments
                ? "min-w-0 flex-1 aspect-[3/4] max-h-full"
                : BATTLE_FEED_TILE
        }`}
      >
        {/* Cover only when this side is NOT decoding — a cover on top of a playing
            video made progress advance with a frozen silent picture. */}
        {!(mediaType === "video" && mediaUrl && isActive && isActiveSide) && cover ? (
          <img
            src={cover}
            alt=""
            className="absolute inset-0 z-0 h-full w-full object-cover"
          />
        ) : !(mediaType === "video" && mediaUrl && isActive && isActiveSide) && !mediaUrl ? (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-neutral-900 text-xs text-white/50">
            Waiting…
          </div>
        ) : !(mediaType === "video" && mediaUrl && isActive && isActiveSide) ? (
          <div className="absolute inset-0 z-0 bg-neutral-900" />
        ) : null}

        {mediaType === "video" && mediaUrl && isActive && isActiveSide ? (
          <video
            ref={(el) => {
              activeMediaRef.current = el;
            }}
            src={mediaUrl}
            playsInline
            loop={false}
            preload="auto"
            // Own compositor layer + above cover — iOS was advancing currentTime
            // without painting frames when the video sat under overlays.
            className="absolute inset-0 z-[1] h-full w-full object-cover"
            style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}
          />
        ) : null}

        {mediaType !== "video" && mediaType !== "live" && mediaUrl && isActive && isActiveSide ? (
          <audio
            ref={(el) => {
              activeMediaRef.current = el;
            }}
            src={mediaUrl}
            loop={false}
            preload="auto"
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        <button
          type="button"
          className="absolute inset-0 z-[3] bg-transparent"
          aria-label={
            isExpanded
              ? `Minimize ${firstName(name)}`
              : isActiveSide && playing && silentLocked
                ? `Tap for sound · ${firstName(name)}`
                : isActiveSide && playing
                  ? `Pause ${firstName(name)}`
                  : `Play ${firstName(name)}`
          }
          onTouchEnd={(e) => handleArtistTouchEnd(e, side)}
          onClick={(e) => handleArtistClick(e, side)}
        />

        {isExpanded ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur">
            Double-tap to minimize
          </div>
        ) : null}

        {!showComments ? (
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5 pr-[48%] text-left">
            <button
              type="button"
              className="pointer-events-auto flex items-center gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                if (userId) navigate(`/artist/${userId}`);
              }}
            >
              <div className="h-7 w-7 overflow-hidden rounded-full bg-white/20 ring-2 ring-white/30">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white">
                    {(name || "?")[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className={`text-xs font-black ${side === "left" ? "text-cyan-300" : "text-pink-400"}`}>
                  {firstName(name)}
                </p>
                <p className="text-[10px] font-bold text-white/65">{formatCompact(votesN)} votes</p>
              </div>
            </button>
          </div>
        ) : null}

        {winnerSide === side ? (
          <BattleWinnerCheckBadge size={isExpanded ? "lg" : "md"} />
        ) : null}
      </div>
    );
  };

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-black text-white">
      {/* Portrait media boxes — double-tap a side to expand / minimize */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col items-center justify-center px-2 transition-all duration-300"
        style={
          showComments
            ? { height: MOBILE_COMMENTS_VIDEO_HEIGHT }
            : expandedSide
              ? {
                  top: "calc(env(safe-area-inset-top) + 2.75rem)",
                  bottom: "calc(13.75rem + env(safe-area-inset-bottom, 0px))",
                }
              : {
                  top: "calc(env(safe-area-inset-top) + 2.75rem)",
                  bottom: "calc(13.75rem + env(safe-area-inset-bottom, 0px))",
                }
        }
      >
        {/* One shared flex shell for photo/audio/video AND live — same card size. */}
        <div
          className={`relative flex w-full max-w-lg items-center justify-center gap-1.5 ${
            expandedSide ? "h-full" : ""
          }`}
        >
          {mediaType === "live" && isActive ? (
            <BattleLiveStage
              battle={battle}
              leftName={leftName}
              rightName={rightName}
              surface="feed"
              compact
              expandedSide={expandedSide}
              replayVideoRef={liveReplayRef}
              winnerSide={winnerSide}
              className={expandedSide ? BATTLE_FEED_TILE_EXPANDED : ""}
              onExpandSide={(side) =>
                setExpandedSide((prev) => (prev === side ? null : side))
              }
            />
          ) : mediaType === "live" ? (
            <>
              {(["left", "right"] as const).map((side) => {
                const cover = side === "left" ? leftCover : rightCover;
                const isExpanded = expandedSide === side;
                const isHidden = expandedSide != null && expandedSide !== side;
                return (
                  <div
                    key={side}
                    className={`relative overflow-hidden rounded-[1.35rem] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 transition-all duration-300 ${
                      side === "left" ? "ring-cyan-300/90" : "ring-pink-400/90"
                    } ${
                      isHidden
                        ? "hidden"
                        : isExpanded
                          ? BATTLE_FEED_TILE_EXPANDED
                          : BATTLE_FEED_TILE
                    }`}
                    onTouchEnd={(e) => handleArtistTouchEnd(e, side)}
                    onClick={(e) => handleArtistClick(e, side)}
                  >
                    {cover ? (
                      <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : null}
                    {winnerSide === side ? (
                      <BattleWinnerCheckBadge size={isExpanded ? "lg" : "md"} />
                    ) : null}
                  </div>
                );
              })}
              {!expandedSide ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
                  <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tracking-widest text-white ring-1 ring-white/25">
                    VS
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {renderCompetitor("left")}
              {!expandedSide ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
                  <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tracking-widest text-white ring-1 ring-white/25">
                    VS
                  </span>
                </div>
              ) : null}
              {renderCompetitor("right")}
            </>
          )}
        </div>
      </div>

      {/* Minimal top status (no play button) */}
      {!showComments ? (
        <div className="pointer-events-none absolute left-14 right-3 top-[calc(env(safe-area-inset-top)+0.85rem)] z-30 flex items-center gap-1.5">
          <BattleStatusBadge status={uiStatus} />
          <span className="rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] font-black text-white/90 backdrop-blur">
            {timerLabel}
          </span>
        </div>
      ) : null}

      {/* Bottom chrome — same placement language as regular posts */}
      {!showComments ? (
        <>
          <div className="absolute right-[max(1rem,env(safe-area-inset-right))] feed-bottom-offset z-40 flex flex-col items-center gap-3.5 pb-1 pointer-events-auto">
            <button type="button" onClick={toggleLike} className="feed-action-btn">
              <Heart className={`feed-action-icon ${liked ? "fill-red-500 text-red-500" : ""}`} />
              <span className="feed-action-count">{formatCount(likesCount)}</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onScrollLockChange?.(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
                openComments();
              }}
              className="feed-action-btn"
            >
              <MessageCircle className="feed-action-icon" />
              <span className="feed-action-count">{formatCount((battleComments as any[]).length)}</span>
            </button>
            <button
              type="button"
              className="feed-action-btn"
              aria-label="Save"
              onClick={() => {
                setSaved((s) => !s);
                toast.success(saved ? "Removed from saved" : "Saved");
              }}
            >
              <Bookmark className={`feed-action-icon ${saved ? "fill-white text-white" : ""}`} />
            </button>
            <button type="button" onClick={share} className="feed-action-btn" aria-label="Share">
              <Forward className="feed-action-icon" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/circle");
              }}
              className="feed-action-btn"
              aria-label="Open My Circle"
            >
              <Users className="feed-action-icon" />
              <span className="feed-action-count text-[9px]">My Circle</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/my-projects");
              }}
              className="feed-action-btn"
              aria-label="Support this artist"
            >
              <HandHeart className="feed-action-icon" />
              <span className="feed-action-count text-[9px]">Support</span>
            </button>
          </div>

          <div className="absolute left-3 right-[5.25rem] feed-bottom-offset z-40 max-w-[calc(100%-6.25rem)] space-y-2 pb-1 pointer-events-auto">
            <div>
              <p className="truncate text-[15px] font-extrabold text-white drop-shadow-lg">
                {battle?.title || "Battle"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/70">
                {mediaType === "live"
                  ? uiStatus === "countdown"
                    ? "Starting soon · cover preview"
                    : uiStatus === "ended"
                      ? "Replay · voting closed"
                      : getBattleReplayMediaUrl(battle || {}) || getLiveBattlePhase(battle || {}, now) === "ended"
                        ? "Replay · voting open"
                        : "Live debate"
                  : ended
                    ? `Ended · ${firstName(nowPlayingName)}`
                    : silentLocked
                      ? `Now playing · ${firstName(nowPlayingName)} · tap for sound`
                      : `Now playing · ${firstName(nowPlayingName)}${playing ? "" : " (paused)"}`}
              </p>
            </div>

            <BattleNeonVoteBar
              leftPct={tally.leftPct}
              leftInitial={leftName}
              rightInitial={rightName}
              size="md"
              interactive={votingOpen}
              disabledLeft={!leftVoteGate.allowed}
              disabledRight={!rightVoteGate.allowed}
              onVoteLeft={() => voteMutation.mutate("left")}
              onVoteRight={() => voteMutation.mutate("right")}
              onDisabledVote={(side) => {
                const gate = side === "left" ? leftVoteGate : rightVoteGate;
                toast.error(gate.reason || (!uid ? "Sign in to vote" : "Can't vote"));
              }}
            />

            {/* Same bottom progress bar placement as regular posts (incl. live replay). */}
            {mediaType !== "live" || showLiveSeek ? (
              <div
                className="seek-area relative z-50 pt-0.5"
                role="slider"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={mediaType === "live" ? "Seek replay" : "Seek"}
              >
                <div
                  ref={seekTrackRef}
                  className="relative h-[3px] w-full cursor-pointer touch-none rounded-full bg-white/20"
                  onMouseDown={handleScrubStart}
                  onTouchStart={handleScrubStart}
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-white pointer-events-none"
                    style={{
                      width: `${progress}%`,
                      transition: isScrubbing || !playing ? "none" : "width 100ms linear",
                    }}
                  />
                  {(isScrubbing || progress > 0) && (
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white pointer-events-none shadow ${
                        isScrubbing ? "h-2.5 w-2.5" : "h-1.5 w-1.5 opacity-90"
                      }`}
                      style={{ left: `calc(${progress}% - ${isScrubbing ? 5 : 3}px)` }}
                    />
                  )}
                </div>
                <div className="mt-1 flex justify-between font-mono text-[9px] text-white/45">
                  <span>{fmt(currentTime)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {showComments ? (
        <div
          data-feed-comments-sheet
          className="fixed inset-x-0 bottom-0 z-[90] mx-auto flex max-w-lg flex-col rounded-t-2xl border-t border-white/15 bg-neutral-950 shadow-[0_-8px_30px_rgba(0,0,0,0.45)]"
          style={{
            top: MOBILE_COMMENTS_VIDEO_HEIGHT,
            height: `calc(100dvh - ${MOBILE_COMMENTS_VIDEO_HEIGHT})`,
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 flex-col items-center border-b border-white/10 px-3 pb-2.5 pt-2">
            <div className="mb-2 h-1 w-10 rounded-full bg-white/25" />
            <div className="relative flex w-full items-center justify-center">
              <p className="text-sm font-semibold">
                {formatCount((battleComments as any[]).length)} comments
              </p>
              <button
                type="button"
                onClick={closeComments}
                className="absolute right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
                aria-label="Close comments"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div
            data-allow-scroll
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3"
          >
            {(battleComments as any[]).length === 0 ? (
              <p className="py-6 text-center text-xs text-white/40">No comments yet — start the chat</p>
            ) : (
              (battleComments as any[]).map((c) => {
                const cp = commentProfileMap.get(c.user_id) || profileMap.get(c.user_id);
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/10">
                      {cp?.avatar_url ? (
                        <img src={cp.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/50">
                          {(cp?.display_name || "U")[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-white/45">
                        {cp?.display_name || "User"}
                      </span>
                      <p className="text-xs text-white/90">{c.content}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={commentsEndRef} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto border-t border-white/10 px-3 py-1.5 scrollbar-hide">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => commentMutation.mutate(e)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2 border-t border-white/10 px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
            <Input
              placeholder="Drop a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && comment.trim()) commentMutation.mutate(comment.trim());
              }}
              className="h-9 border-white/10 bg-white/5 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => comment.trim() && commentMutation.mutate(comment.trim())}
              disabled={!comment.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
