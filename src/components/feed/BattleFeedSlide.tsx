import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Check,
  Forward,
  HandHeart,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Send,
  Swords,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import BattleWavyMeter from "@/components/battle/BattleWavyMeter";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
import { MOBILE_COMMENTS_VIDEO_HEIGHT } from "@/components/feed/PostCommentsSheet";
import {
  canUserVoteForSide,
  firstName,
  formatClockMmSs,
  formatCompact,
  formatCountdown,
  getBattleExpiresAt,
  getBattleUiStatus,
  tallyBattleVotes,
} from "@/lib/battle-ui";
import { incrementBattleViews } from "@/hooks/use-likes";

type Props = {
  battle: any;
  currentUserId?: string;
  isActive?: boolean;
  /** Lock the parent feed snap scroller while comments are open. */
  onScrollLockChange?: (locked: boolean) => void;
};

const EMOJIS = ["🔥", "💀", "🎤", "👑", "💪", "😤", "🏆", "⚡"];

/**
 * Fullscreen feed slide for an active battle.
 * Right-rail actions match regular posts (like / comment / share / circle…).
 * Vote tabs + vote counts live in their own lane — separate from likes.
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
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(Date.now());

  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioLeftRef = useRef<HTMLAudioElement | null>(null);
  const audioRightRef = useRef<HTMLAudioElement | null>(null);
  const videoLeftRef = useRef<HTMLVideoElement | null>(null);
  const videoRightRef = useRef<HTMLVideoElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const viewedRef = useRef(false);
  const activeSideRef = useRef<"left" | "right">("left");

  const mediaType = (battle?.media_type || "audio").toLowerCase();

  useEffect(() => {
    activeSideRef.current = activeSide;
  }, [activeSide]);

  useEffect(() => {
    setLiked(Boolean(battle?.isLiked));
    setLikesCount(battle?.likes_count || 0);
    setShowComments(false);
    setSaved(false);
    onScrollLockChange?.(false);
  }, [battle?.id, battle?.isLiked, battle?.likes_count, onScrollLockChange]);

  // Fallback lock via closest snap stage (desktop / if callback missing).
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
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const pauseAll = useCallback(() => {
    audioLeftRef.current?.pause();
    audioRightRef.current?.pause();
    videoLeftRef.current?.pause();
    videoRightRef.current?.pause();
  }, []);

  const mediaEl = useCallback(
    (side: "left" | "right") => {
      if (mediaType === "video") {
        return side === "left" ? videoLeftRef.current : videoRightRef.current;
      }
      return side === "left" ? audioLeftRef.current : audioRightRef.current;
    },
    [mediaType],
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

  // When one side finishes, auto-play the other side (user can still pause anytime).
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

  useEffect(() => {
    if (isActive) return;
    pauseAll();
    setPlaying(false);
  }, [isActive, pauseAll]);

  const openComments = useCallback(() => {
    // Lock synchronously so the same touch gesture cannot swipe the feed.
    onScrollLockChange?.(true);
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
  const ended = uiStatus === "ended";
  const msLeft = getBattleExpiresAt(battle || {}).getTime() - now;
  const votingOpen =
    (battle?.status === "active" || uiStatus === "live" || uiStatus === "ending") &&
    !!(battle?.opponent_media_url || battle?.opponent_cover_url);
  const tally = tallyBattleVotes(votes as any[], battle?.challenger_id, battle?.opponent_id);
  const userVote = (votes as any[]).find((v) => v.user_id === uid);
  const hasVotedLeft = userVote?.voted_for === battle?.challenger_id;
  const hasVotedRight = userVote?.voted_for === battle?.opponent_id;
  const leftVoteGate = canUserVoteForSide(uid, battle?.challenger_id, { ended, votingOpen });
  const rightVoteGate = canUserVoteForSide(uid, battle?.opponent_id, { ended, votingOpen });

  const voteMutation = useMutation({
    mutationFn: async (side: "left" | "right") => {
      if (!uid || !battle) return;
      const targetId = side === "left" ? battle.challenger_id : battle.opponent_id;
      const gate = canUserVoteForSide(uid, targetId, { ended, votingOpen });
      if (!gate.allowed) {
        toast.error(gate.reason || "Can't vote");
        return;
      }
      const existing = (votes as any[]).find((v) => v.user_id === uid);
      if (existing) {
        await supabase.from("battle_votes").update({ voted_for: targetId }).eq("id", existing.id);
      } else {
        await supabase
          .from("battle_votes")
          .insert({ battle_id: battle.id, user_id: uid, voted_for: targetId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["battle-votes", battle?.id] });
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
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

  const togglePlay = () => {
    if (playing) {
      pauseAll();
      setPlaying(false);
      return;
    }
    void playSide(activeSideRef.current);
  };

  const timerLabel =
    ended || msLeft <= 0
      ? "Ended"
      : msLeft <= 60_000
        ? formatClockMmSs(msLeft)
        : formatCountdown(msLeft);

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
    const pct = side === "left" ? tally.leftPct : tally.rightPct;
    const isActiveSide = activeSide === side;
    const userId = side === "left" ? battle?.challenger_id : battle?.opponent_id;

    return (
      <div
        className={`relative min-h-0 flex-1 overflow-hidden ${
          side === "left" ? "border-r border-white/10" : ""
        }`}
      >
        <button
          type="button"
          className="absolute inset-0 z-[1]"
          aria-label={`Play ${firstName(name)}`}
          onClick={() => void playSide(side)}
        />

        {mediaType === "video" && mediaUrl ? (
          <video
            ref={side === "left" ? videoLeftRef : videoRightRef}
            src={mediaUrl}
            playsInline
            preload={isActive ? "metadata" : "none"}
            className={`h-full w-full ${showComments ? "object-contain" : "object-cover"}`}
          />
        ) : cover ? (
          <img
            src={cover}
            alt=""
            className={`h-full w-full ${showComments ? "object-contain" : "object-cover"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-xs text-white/50">
            Waiting…
          </div>
        )}

        {/* Stable audio nodes for auto-advance between sides */}
        {mediaType !== "video" && mediaUrl ? (
          <audio
            ref={side === "left" ? audioLeftRef : audioRightRef}
            src={mediaUrl}
            preload={isActive ? "auto" : "none"}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-transparent to-black/35" />

        <div className="absolute inset-x-0 bottom-0 z-10 p-2.5 text-left">
          <button
            type="button"
            className="pointer-events-auto flex items-center gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              if (userId) navigate(`/artist/${userId}`);
            }}
          >
            <div className="h-8 w-8 overflow-hidden rounded-full bg-white/20 ring-2 ring-white/35">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white">
                  {(name || "?")[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className={`text-xs font-black ${side === "left" ? "text-sky-300" : "text-rose-300"}`}>
                {firstName(name)}
              </p>
              <p className="text-[10px] font-bold text-white/70">
                {formatCompact(votesN)} votes · {pct}%
              </p>
            </div>
          </button>
        </div>

        {isActiveSide && playing ? (
          <div
            className={`absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white ${
              side === "left" ? "bg-sky-500/90" : "bg-rose-500/90"
            }`}
          >
            Playing
          </div>
        ) : null}
      </div>
    );
  };

  const voteTab = (side: "left" | "right") => {
    const name = side === "left" ? leftName : rightName;
    const votesN = side === "left" ? tally.leftVotes : tally.rightVotes;
    const gate = side === "left" ? leftVoteGate : rightVoteGate;
    const hasVoted = side === "left" ? hasVotedLeft : hasVotedRight;
    const accent = side === "left" ? "sky" : "rose";

    return (
      <button
        type="button"
        disabled={ended || (!gate.allowed && !hasVoted)}
        onClick={(e) => {
          e.stopPropagation();
          voteMutation.mutate(side);
        }}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2.5 transition-all ${
          hasVoted
            ? accent === "sky"
              ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
              : "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
            : gate.allowed && !ended
              ? accent === "sky"
                ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/45"
                : "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/45"
              : "bg-white/8 text-white/40"
        }`}
      >
        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide">
          {hasVoted ? <Check className="h-3.5 w-3.5" /> : <ThumbsUp className="h-3.5 w-3.5" />}
          {ended
            ? "Closed"
            : hasVoted
              ? "Voted"
              : gate.reason === "You can't vote for yourself"
                ? "Your side"
                : `Vote ${firstName(name)}`}
        </span>
        <span className="text-[13px] font-black tabular-nums">{formatCompact(votesN)} votes</span>
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-black text-white">
      <div
        className="absolute inset-x-0 top-0 flex flex-col overflow-hidden transition-all duration-300"
        style={
          showComments
            ? { height: MOBILE_COMMENTS_VIDEO_HEIGHT }
            : { bottom: 0, height: "100%" }
        }
      >
        <div className="relative z-20 flex shrink-0 items-start gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+3.25rem)] pr-[4.75rem]">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <BattleStatusBadge status={uiStatus} />
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] font-black text-white/85">
                {timerLabel}
              </span>
            </div>
            <h2 className="truncate text-base font-black tracking-tight drop-shadow-lg">
              {battle?.title || "Battle"}
            </h2>
          </div>
          <button
            type="button"
            onClick={togglePlay}
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>

        <div className="relative mx-2 min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
          <div className="flex h-full w-full">
            {renderCompetitor("left")}
            {renderCompetitor("right")}
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tracking-widest text-white ring-1 ring-white/25">
              VS
            </span>
          </div>
        </div>

        {!showComments ? (
          <div className="relative z-20 shrink-0 space-y-2 px-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-2.5 pr-[4.75rem]">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-200 ring-1 ring-violet-400/35">
                <Swords className="h-3 w-3" />
                Vote lane
              </div>
              <p className="text-[11px] font-bold text-white/65">
                {formatCompact(tally.total)} total votes
              </p>
            </div>
            <BattleWavyMeter leftPct={tally.leftPct} size="sm" />
            <div className="flex gap-2">
              {voteTab("left")}
              {voteTab("right")}
            </div>
            <p className="text-center text-[10px] font-semibold text-white/45">
              {ended
                ? "Voting closed — likes & comments still open"
                : "Votes pick the winner · Likes are separate"}
            </p>
          </div>
        ) : null}
      </div>

      {!showComments ? (
        <div className="absolute right-3 feed-bottom-offset z-40 flex flex-col items-center gap-4 pb-1 pointer-events-auto">
          <button type="button" onClick={toggleLike} className="feed-action-btn">
            <Heart className={`feed-action-icon ${liked ? "fill-red-500 text-red-500" : ""}`} />
            <span className="feed-action-count">{formatCount(likesCount)}</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              // Lock the feed scroller before the gesture can start a swipe.
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
      ) : null}

      {/* Fixed comments sheet — same pattern as regular posts; does not swipe the feed */}
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
