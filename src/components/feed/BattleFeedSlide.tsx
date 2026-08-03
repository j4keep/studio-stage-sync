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
  isBattleVotingOpen,
  tallyBattleVotes,
} from "@/lib/battle-ui";
import {
  getBattleReplayMediaUrl,
  getBattleScheduledStartAt,
  getLiveBattlePhase,
} from "@/lib/battle-live";
import { incrementBattleViews } from "@/hooks/use-likes";

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

  const [liked, setLiked] = useState(Boolean(battle?.isLiked));
  const [likesCount, setLikesCount] = useState(battle?.likes_count || 0);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [activeSide, setActiveSide] = useState<"left" | "right">("left");
  const [expandedSide, setExpandedSide] = useState<"left" | "right" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioLeftRef = useRef<HTMLAudioElement | null>(null);
  const audioRightRef = useRef<HTMLAudioElement | null>(null);
  const videoLeftRef = useRef<HTMLVideoElement | null>(null);
  const videoRightRef = useRef<HTMLVideoElement | null>(null);
  const liveReplayRef = useRef<HTMLVideoElement | null>(null);
  const seekTrackRef = useRef<HTMLDivElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const viewedRef = useRef(false);
  const activeSideRef = useRef<"left" | "right">("left");
  const autoStartedRef = useRef<string | null>(null);
  const lastTapRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchHandledRef = useRef(false);

  const mediaType = (battle?.media_type || "audio").toLowerCase();
  const liveReplayUrl = mediaType === "live" ? getBattleReplayMediaUrl(battle || {}) : null;
  const livePhase = mediaType === "live" ? getLiveBattlePhase(battle || {}, now) : null;
  const showLiveSeek = mediaType === "live" && (!!liveReplayUrl || livePhase === "ended");

  useEffect(() => {
    activeSideRef.current = activeSide;
  }, [activeSide]);

  useEffect(() => {
    setLiked(Boolean(battle?.isLiked));
    setLikesCount(battle?.likes_count || 0);
    setShowComments(false);
    setSaved(false);
    setExpandedSide(null);
    onScrollLockChange?.(false);
    autoStartedRef.current = null;
  }, [battle?.id, battle?.isLiked, battle?.likes_count, onScrollLockChange]);

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

  const pauseAll = useCallback(() => {
    audioLeftRef.current?.pause();
    audioRightRef.current?.pause();
    videoLeftRef.current?.pause();
    videoRightRef.current?.pause();
  }, []);

  const mediaEl = useCallback(
    (side: "left" | "right") => {
      if (mediaType === "live") return liveReplayRef.current;
      if (mediaType === "video") {
        return side === "left" ? videoLeftRef.current : videoRightRef.current;
      }
      return side === "left" ? audioLeftRef.current : audioRightRef.current;
    },
    [mediaType],
  );

  // Live replay progress (same clock as audio/video battles).
  useEffect(() => {
    if (!isActive || mediaType !== "live") return;
    let raf = 0;
    const tick = () => {
      const el = liveReplayRef.current;
      if (el && !isScrubbing) {
        const d = el.duration || 0;
        const t = el.currentTime || 0;
        setDuration(Number.isFinite(d) ? d : 0);
        setCurrentTime(t);
        setProgress(d > 0 ? (t / d) * 100 : 0);
        setPlaying(!el.paused);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [isActive, mediaType, isScrubbing, liveReplayUrl]);

  const scrubToClientX = useCallback(
    (clientX: number) => {
      const track = seekTrackRef.current;
      const el =
        mediaType === "live"
          ? liveReplayRef.current
          : mediaEl(activeSideRef.current);
      if (!track || !el) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)));
      const d = el.duration || 0;
      if (!Number.isFinite(d) || d <= 0) return;
      el.currentTime = pct * d;
      setProgress(pct * 100);
      setCurrentTime(pct * d);
      setDuration(d);
    },
    [mediaEl, mediaType],
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
        const el =
          mediaType === "live"
            ? liveReplayRef.current
            : mediaEl(activeSideRef.current);
        if (el && el.paused) void el.play().catch(() => undefined);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
    },
    [mediaEl, mediaType, scrubToClientX],
  );

  const playSide = useCallback(
    async (side: "left" | "right", opts?: { fromStart?: boolean }) => {
      pauseAll();
      setActiveSide(side);
      activeSideRef.current = side;
      const el = mediaEl(side);
      if (!el) {
        setPlaying(false);
        return;
      }
      if (opts?.fromStart) el.currentTime = 0;
      try {
        await el.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    },
    [mediaEl, pauseAll],
  );

  const toggleSide = useCallback(
    (side: "left" | "right") => {
      if (activeSideRef.current === side && playing) {
        pauseAll();
        setPlaying(false);
        return;
      }
      void playSide(side);
    },
    [pauseAll, playSide, playing],
  );

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

  // Autoplay when the slide becomes active (like a regular feed post).
  useEffect(() => {
    if (!isActive || !battle?.id) return;
    if (autoStartedRef.current === battle.id) return;
    const startSide: "left" | "right" = battle.challenger_media_url
      ? "left"
      : battle.opponent_media_url
        ? "right"
        : "left";
    if (!battle.challenger_media_url && !battle.opponent_media_url) return;
    autoStartedRef.current = battle.id;
    const t = window.setTimeout(() => {
      void playSide(startSide, { fromStart: true });
    }, 120);
    return () => window.clearTimeout(t);
  }, [
    isActive,
    battle?.id,
    battle?.challenger_media_url,
    battle?.opponent_media_url,
    playSide,
  ]);

  // Auto-advance to the other side when a track ends.
  useEffect(() => {
    if (!isActive) return;
    const left = mediaEl("left");
    const right = mediaEl("right");
    if (!left && !right) return;

    const onEnded = (finished: "left" | "right") => {
      const other: "left" | "right" = finished === "left" ? "right" : "left";
      const otherUrl =
        other === "left" ? battle?.challenger_media_url : battle?.opponent_media_url;
      if (!otherUrl) {
        setPlaying(false);
        return;
      }
      window.requestAnimationFrame(() => {
        void playSide(other, { fromStart: true });
      });
    };

    const onLeftEnded = () => onEnded("left");
    const onRightEnded = () => onEnded("right");
    left?.addEventListener("ended", onLeftEnded);
    right?.addEventListener("ended", onRightEnded);
    return () => {
      left?.removeEventListener("ended", onLeftEnded);
      right?.removeEventListener("ended", onRightEnded);
    };
  }, [
    isActive,
    mediaEl,
    playSide,
    battle?.challenger_media_url,
    battle?.opponent_media_url,
    battle?.id,
  ]);

  // Progress for the active side.
  useEffect(() => {
    if (!isActive) return;
    let raf = 0;
    const tick = () => {
      const el = mediaEl(activeSideRef.current);
      if (el) {
        const d = el.duration || 0;
        const t = el.currentTime || 0;
        setDuration(d);
        setCurrentTime(t);
        setProgress(d > 0 ? (t / d) * 100 : 0);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [isActive, mediaEl, activeSide, playing]);

  useEffect(() => {
    if (isActive) return;
    pauseAll();
    setPlaying(false);
  }, [isActive, pauseAll]);

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

  const leftCover = battle?.challenger_cover_url || battle?.challenger_media_url;
  const rightCover = battle?.opponent_cover_url || battle?.opponent_media_url;
  const scheduledStartAt = getBattleScheduledStartAt(battle || {});
  const msToStart = scheduledStartAt
    ? new Date(scheduledStartAt).getTime() - now
    : 0;
  const timerLabel =
    ended || msLeft <= 0
      ? "Ended"
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
        <button
          type="button"
          className="absolute inset-0 z-[1]"
          aria-label={
            isExpanded
              ? `Minimize ${firstName(name)}`
              : isActiveSide && playing
                ? `Pause ${firstName(name)}`
                : `Play ${firstName(name)}`
          }
          onTouchEnd={(e) => handleArtistTouchEnd(e, side)}
          onClick={(e) => handleArtistClick(e, side)}
        />

        {mediaType === "video" && mediaUrl ? (
          <video
            ref={side === "left" ? videoLeftRef : videoRightRef}
            src={mediaUrl}
            playsInline
            preload={isActive ? "auto" : "none"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : cover ? (
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-xs text-white/50">
            Waiting…
          </div>
        )}

        {mediaType !== "video" && mediaUrl ? (
          <audio
            ref={side === "left" ? audioLeftRef : audioRightRef}
            src={mediaUrl}
            preload={isActive ? "auto" : "none"}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        {isExpanded ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur">
            Double-tap to minimize
          </div>
        ) : null}

        {!showComments ? (
          <div className="absolute inset-x-0 bottom-0 z-10 p-2.5 text-left">
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

            {mediaType !== "live" || showLiveSeek ? (
              <div
                className="seek-area relative z-50 pt-0.5"
                role="slider"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Seek replay"
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
