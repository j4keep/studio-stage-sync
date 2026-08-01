import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Forward,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Send,
  ThumbsUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import BattleWavyMeter from "@/components/battle/BattleWavyMeter";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
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
};

const EMOJIS = ["🔥", "💀", "🎤", "👑", "💪", "😤", "🏆", "⚡"];

/**
 * Fullscreen feed slide for an active battle — like / comment / share like a post,
 * plus vote tabs for each side (self-vote locked; voting ends when battle ends).
 */
export default function BattleFeedSlide({ battle, currentUserId, isActive = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const uid = currentUserId || user?.id;

  const [liked, setLiked] = useState(Boolean(battle?.isLiked));
  const [likesCount, setLikesCount] = useState(battle?.likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [activeSide, setActiveSide] = useState<"left" | "right">("left");
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(Date.now());

  const audioLeftRef = useRef<HTMLAudioElement | null>(null);
  const audioRightRef = useRef<HTMLAudioElement | null>(null);
  const videoLeftRef = useRef<HTMLVideoElement | null>(null);
  const videoRightRef = useRef<HTMLVideoElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    setLiked(Boolean(battle?.isLiked));
    setLikesCount(battle?.likes_count || 0);
    setShowComments(false);
  }, [battle?.id, battle?.isLiked, battle?.likes_count]);

  useEffect(() => {
    if (!isActive || !battle?.id || viewedRef.current) return;
    viewedRef.current = true;
    incrementBattleViews(battle.id);
  }, [isActive, battle?.id]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (isActive) return;
    audioLeftRef.current?.pause();
    audioRightRef.current?.pause();
    videoLeftRef.current?.pause();
    videoRightRef.current?.pause();
    setPlaying(false);
  }, [isActive]);

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

  const mediaType = (battle?.media_type || "audio").toLowerCase();
  const leftCover = battle?.challenger_cover_url || battle?.challenger_media_url;
  const rightCover = battle?.opponent_cover_url || battle?.opponent_media_url;

  const pauseAll = () => {
    audioLeftRef.current?.pause();
    audioRightRef.current?.pause();
    videoLeftRef.current?.pause();
    videoRightRef.current?.pause();
  };

  const playSide = async (side: "left" | "right") => {
    pauseAll();
    setActiveSide(side);
    const isVideo = mediaType === "video";
    const el = isVideo
      ? side === "left"
        ? videoLeftRef.current
        : videoRightRef.current
      : side === "left"
        ? audioLeftRef.current
        : audioRightRef.current;
    if (!el) {
      setPlaying(false);
      return;
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const togglePlay = () => {
    if (playing) {
      pauseAll();
      setPlaying(false);
      return;
    }
    void playSide(activeSide);
  };

  const timerLabel =
    ended || msLeft <= 0
      ? "Ended"
      : msLeft <= 60_000
        ? formatClockMmSs(msLeft)
        : formatCountdown(msLeft);

  const renderSide = (side: "left" | "right") => {
    const name = side === "left" ? leftName : rightName;
    const profile = side === "left" ? leftProfile : rightProfile;
    const cover = side === "left" ? leftCover : rightCover;
    const mediaUrl = side === "left" ? battle?.challenger_media_url : battle?.opponent_media_url;
    const pct = side === "left" ? tally.leftPct : tally.rightPct;
    const votesN = side === "left" ? tally.leftVotes : tally.rightVotes;
    const accent = side === "left" ? "sky" : "rose";
    const isActiveSide = activeSide === side;
    const gate = side === "left" ? leftVoteGate : rightVoteGate;
    const hasVoted = side === "left" ? hasVotedLeft : hasVotedRight;
    const userId = side === "left" ? battle?.challenger_id : battle?.opponent_id;

    return (
      <div
        className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${
          side === "left" ? "border-r border-white/10" : ""
        }`}
      >
        <button
          type="button"
          className="relative min-h-0 flex-1 overflow-hidden"
          onClick={() => void playSide(side)}
        >
          {mediaType === "video" && mediaUrl ? (
            <video
              ref={side === "left" ? videoLeftRef : videoRightRef}
              src={mediaUrl}
              playsInline
              preload={isActive ? "metadata" : "none"}
              className="h-full w-full object-cover"
              onEnded={() => setPlaying(false)}
            />
          ) : cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-xs text-white/50">
              Waiting…
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
          {mediaType !== "video" && mediaUrl ? (
            <audio
              ref={side === "left" ? audioLeftRef : audioRightRef}
              src={mediaUrl}
              preload={isActive ? "metadata" : "none"}
              onEnded={() => setPlaying(false)}
            />
          ) : null}

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
              <span className={`text-xs font-black ${side === "left" ? "text-sky-300" : "text-rose-300"}`}>
                {firstName(name)}
              </span>
            </button>
            <p className="mt-1 text-[10px] font-bold text-white/70">
              {formatCompact(votesN)} votes · {pct}%
            </p>
          </div>

          {isActiveSide && playing ? (
            <div
              className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white ${
                accent === "sky" ? "bg-sky-500/90" : "bg-rose-500/90"
              }`}
            >
              Playing
            </div>
          ) : null}
        </button>

        <button
          type="button"
          disabled={!gate.allowed && !hasVoted}
          onClick={() => voteMutation.mutate(side)}
          className={`mx-2 mb-2 mt-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black transition-all ${
            hasVoted
              ? accent === "sky"
                ? "bg-sky-500 text-white"
                : "bg-rose-500 text-white"
              : gate.allowed
                ? accent === "sky"
                  ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/40"
                  : "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40"
                : "bg-white/5 text-white/35"
          }`}
        >
          {hasVoted ? <Check className="h-3.5 w-3.5" /> : <ThumbsUp className="h-3.5 w-3.5" />}
          {ended
            ? "Voting closed"
            : hasVoted
              ? `Voted ${firstName(name)}`
              : !gate.allowed
                ? gate.reason === "You can't vote for yourself"
                  ? "Your side"
                  : gate.reason || "Locked"
                : `Vote ${firstName(name)}`}
        </button>
      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-white">
      {/* Header */}
      <div className="relative z-20 flex shrink-0 items-start gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+3.25rem)]">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <BattleStatusBadge status={uiStatus} />
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] font-black text-white/85">
              {timerLabel}
            </span>
          </div>
          <h2 className="truncate text-base font-black tracking-tight">{battle?.title || "Battle"}</h2>
          <p className="text-[11px] font-semibold text-white/55">
            {formatCompact(tally.total)} votes · likes & comments stay open after voting ends
          </p>
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

      {/* Dual arena */}
      <div className="relative z-10 mx-2 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
        {renderSide("left")}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-black tracking-widest text-white ring-1 ring-white/25">
            VS
          </span>
        </div>
        {renderSide("right")}
      </div>

      <div className="relative z-10 px-3 pt-2">
        <BattleWavyMeter leftPct={tally.leftPct} size="sm" />
        <div className="mt-1 flex justify-between text-[10px] font-bold text-white/55">
          <span className="text-sky-300">{firstName(leftName)} {tally.leftPct}%</span>
          <span className="text-rose-300">{firstName(rightName)} {tally.rightPct}%</span>
        </div>
      </div>

      {/* Post-style actions */}
      <div className="relative z-20 flex shrink-0 items-center justify-around gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <button type="button" onClick={toggleLike} className="feed-action-btn">
          <Heart className={`feed-action-icon ${liked ? "fill-red-500 text-red-500" : ""}`} />
          <span className="feed-action-count">{formatCompact(likesCount)}</span>
        </button>
        <button type="button" onClick={() => setShowComments(true)} className="feed-action-btn">
          <MessageCircle className="feed-action-icon" />
          <span className="feed-action-count">{formatCompact((battleComments as any[]).length)}</span>
        </button>
        <button type="button" onClick={share} className="feed-action-btn" aria-label="Share">
          <Forward className="feed-action-icon" />
          <span className="feed-action-count">Share</span>
        </button>
      </div>

      {/* Comments sheet */}
      {showComments ? (
        <div
          className="absolute inset-x-0 bottom-0 z-[90] flex max-h-[55dvh] flex-col rounded-t-2xl border-t border-white/15 bg-neutral-950/95 backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2.5">
            <p className="text-sm font-semibold">
              {formatCompact((battleComments as any[]).length)} comments
            </p>
            <button
              type="button"
              onClick={() => setShowComments(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
              aria-label="Close comments"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
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
