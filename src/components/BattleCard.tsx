import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Clock,
  MessageCircle,
  Send,
  Play,
  Pause,
  Heart,
  Eye,
  Share2,
  BadgeCheck,
  TrendingUp,
  Zap,
  Gift,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
import BattleWavyMeter from "@/components/battle/BattleWavyMeter";
import {
  battleCategoryFromMedia,
  computeVoteMomentum,
  firstName,
  formatClockMmSs,
  formatCompact,
  formatCountdown,
  getBattleExpiresAt,
  getBattleUiStatus,
  tallyBattleVotes,
} from "@/lib/battle-ui";

interface Battle {
  id: string;
  challenger_id: string;
  opponent_id: string | null;
  title: string;
  status: string;
  media_type: string;
  challenger_media_url: string | null;
  challenger_cover_url: string | null;
  challenger_title: string | null;
  opponent_media_url: string | null;
  opponent_cover_url: string | null;
  opponent_title: string | null;
  winner_id: string | null;
  created_at: string;
  expires_at?: string;
  max_duration_minutes?: number;
  views?: number;
  likes_count?: number;
}

const EMOJIS = ["🔥", "💀", "🎤", "👑", "💪", "😤", "🏆", "⚡"];

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const BattleCard = ({ battle, onOpen }: { battle: Battle; onOpen?: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openBattle = useCallback(() => {
    if (onOpen) onOpen();
    else navigate(`/battle/${battle.id}`);
  }, [onOpen, navigate, battle.id]);
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [battleLiked, setBattleLiked] = useState(!!(battle as any).isLiked);
  const [battleLikesCount, setBattleLikesCount] = useState(battle.likes_count || 0);

  useEffect(() => {
    setBattleLiked(!!(battle as any).isLiked);
  }, [battle.id, (battle as any).isLiked]);

  useEffect(() => {
    setBattleLikesCount(battle.likes_count || 0);
  }, [battle.id, battle.likes_count]);

  // Audio playback state for inline preview
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeArtist, setActiveArtist] = useState<"left" | "right">("left");
  const activeArtistRef = useRef<"left" | "right">("left");
  const audioLeftRef = useRef<HTMLAudioElement | null>(null);
  const audioRightRef = useRef<HTMLAudioElement | null>(null);
  const lastTapRef = useRef(0);

  const expiresAt = battle.expires_at ? new Date(battle.expires_at) : new Date(new Date(battle.created_at).getTime() + 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expiresAt;
  const isActive =
    battle.status === "active" && !!(battle.opponent_media_url || battle.opponent_cover_url);
  const isOpen = battle.status === "open" && !battle.opponent_id;
  const isPending = battle.status === "pending" && battle.opponent_id;
  const canAccept = (isOpen && user?.id !== battle.challenger_id) || (isPending && user?.id === battle.opponent_id);

  // Countdown
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (isExpired || !isActive) return;
    const update = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [expiresAt, isActive, isExpired]);

  // Profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["battle-card-profiles", battle.challenger_id, battle.opponent_id],
    queryFn: async () => {
      const ids = [battle.challenger_id, battle.opponent_id].filter(Boolean);
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
      return data || [];
    },
  });
  const profileMap = new Map((Array.isArray(profiles) ? profiles : []).map((p: any) => [p.user_id, p]));
  const challengerName = (profileMap.get(battle.challenger_id) as any)?.display_name || "Challenger";
  const opponentName = battle.opponent_id ? (profileMap.get(battle.opponent_id) as any)?.display_name || "???" : "???";

  // Votes
  const { data: votes = [] } = useQuery({
    queryKey: ["battle-votes", battle.id],
    queryFn: async () => {
      const { data } = await supabase.from("battle_votes").select("*").eq("battle_id", battle.id);
      return data || [];
    },
    refetchInterval: isActive && !isExpired ? 8000 : false,
  });
  const participantIds = [battle.challenger_id, battle.opponent_id].filter(Boolean);
  const tally = tallyBattleVotes(votes as any[], battle.challenger_id, battle.opponent_id);
  const audienceVotes = tally.countable;
  const challengerVotes = tally.leftVotes;
  const opponentVotes = tally.rightVotes;
  const totalVotes = tally.total;
  const challengerPct = tally.leftPct;
  const opponentPct = tally.rightPct;
  const winner = tally.winner;
  const isParticipant = !!user?.id && participantIds.includes(user.id);
  const isChallenger = !!user?.id && user.id === battle.challenger_id;
  const isOpponent = !!user?.id && user.id === battle.opponent_id;

  const leftVoterIds = useMemo(
    () =>
      [...new Set(
        audienceVotes
          .filter((v: any) => v.voted_for === battle.challenger_id)
          .map((v: any) => v.user_id),
      )].slice(0, 4) as string[],
    [audienceVotes, battle.challenger_id],
  );
  const rightVoterIds = useMemo(
    () =>
      [...new Set(
        audienceVotes
          .filter((v: any) => v.voted_for === battle.opponent_id)
          .map((v: any) => v.user_id),
      )].slice(0, 4) as string[],
    [audienceVotes, battle.opponent_id],
  );
  const supporterIds = useMemo(
    () => [...new Set([...leftVoterIds, ...rightVoterIds])],
    [leftVoterIds, rightVoterIds],
  );

  const { data: supporterProfiles = [] } = useQuery({
    queryKey: ["battle-supporters", battle.id, supporterIds.join(",")],
    queryFn: async () => {
      if (!supporterIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, avatar_url, display_name")
        .in("user_id", supporterIds);
      return data || [];
    },
    enabled: supporterIds.length > 0,
  });
  const supporterMap = new Map(
    (supporterProfiles as any[]).map((p) => [p.user_id, p]),
  );

  // Comments
  const { data: battleComments = [] } = useQuery({
    queryKey: ["battle-comments", battle.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("battle_comments").select("*").eq("battle_id", battle.id).order("created_at", { ascending: true });
      return data || [];
    },
  });
  const allUserIds = [...new Set([...battleComments.map((c: any) => c.user_id)])];
  const { data: commentProfiles = [] } = useQuery({
    queryKey: ["battle-comment-profiles", allUserIds.join(",")],
    queryFn: async () => {
      if (!allUserIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", allUserIds);
      return data || [];
    },
    enabled: allUserIds.length > 0,
  });
  const commentProfileMap = new Map(commentProfiles.map((p: any) => [p.user_id, p]));

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("battles").delete().eq("id", battle.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Remove from Battles page and homepage Posts feed / profile feeds.
      queryClient.invalidateQueries({ queryKey: ["battles"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      toast.success("Battle deleted");
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      await (supabase as any).from("battle_comments").insert({ battle_id: battle.id, user_id: user?.id, content });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["battle-comments", battle.id] }); setComment(""); },
  });

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [battleComments.length]);

  const toggleBattleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const wasLiked = battleLiked;
    const previousCount = battleLikesCount;

    setBattleLiked(!wasLiked);
    setBattleLikesCount((count) => (wasLiked ? Math.max(count - 1, 0) : count + 1));

    try {
      if (wasLiked) {
        const { error } = await (supabase as any)
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", battle.id)
          .eq("content_type", "battle");
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("likes")
          .insert({ user_id: user.id, content_id: battle.id, content_type: "battle" });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["battles"] });
    } catch {
      setBattleLiked(wasLiked);
      setBattleLikesCount(previousCount);
      toast.error("Could not update battle love");
    }
  };

  const handleBattleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Audio playback for inline card
  const activeRef = activeArtist === "left" ? audioLeftRef : audioRightRef;
  const inactiveRef = activeArtist === "left" ? audioRightRef : audioLeftRef;

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = activeRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      inactiveRef.current?.pause();
      el.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying, activeRef, inactiveRef]);

  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onDur = () => setDuration(el.duration || 0);
    const onEnd = () => {
      // auto-switch to other side
      if (battle.opponent_media_url && battle.challenger_media_url) {
        const nextSide = activeArtist === "left" ? "right" : "left";
        setActiveArtist(nextSide);
        setCurrentTime(0);
        window.requestAnimationFrame(() => {
          const next = nextSide === "left" ? audioLeftRef.current : audioRightRef.current;
          if (!next) { setIsPlaying(false); return; }
          next.currentTime = 0;
          next.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });
        return;
      }
      setIsPlaying(false);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("ended", onEnd);
    };
  }, [activeRef, activeArtist, battle?.challenger_media_url, battle?.opponent_media_url]);

  // Keep ref in sync
  useEffect(() => { activeArtistRef.current = activeArtist; }, [activeArtist]);

  const handleSeek = (value: number[]) => {
    const side = activeArtistRef.current;
    const el = side === "left" ? audioLeftRef.current : audioRightRef.current;
    if (el && duration > 0) {
      el.currentTime = (value[0] / 100) * duration;
      setCurrentTime(el.currentTime);
    }
  };

  // Double-tap to fullscreen, single-tap to navigate (touch-friendly)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchRef = useRef(false);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 450) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      // Feed mode: expand into the post viewer. Elsewhere: toggle card fullscreen.
      if (onOpen) openBattle();
      else setIsFullscreen((prev) => !prev);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        openBattle();
      }, 450);
    }
  }, [openBattle, onOpen]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isTouchRef.current = true;
    handleTap();
  }, [handleTap]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Skip if this was already handled by touch
    if (isTouchRef.current) {
      isTouchRef.current = false;
      return;
    }
    handleTap();
  }, [handleTap]);

  const uiStatus = getBattleUiStatus(battle);
  const msLeft = getBattleExpiresAt(battle).getTime() - Date.now();
  const finalMinute = isActive && !isExpired && msLeft > 0 && msLeft <= 60_000;
  const momentum = computeVoteMomentum(
    audienceVotes,
    battle.challenger_id,
    battle.opponent_id,
    participantIds as string[],
  );
  const cat = battleCategoryFromMedia(battle.media_type);
  const leadPct = Math.abs(challengerPct - opponentPct);
  const leadName = winner === "right" ? firstName(opponentName) : firstName(challengerName);
  const timerLabel = finalMinute
    ? formatClockMmSs(msLeft)
    : timeLeft || (msLeft > 0 ? formatCountdown(msLeft) : "Ended");
  const watchingLabel = formatCompact(Math.max(battle.views || 0, totalVotes * 3));

  const renderSupporters = (ids: string[], count: number, side: "left" | "right") => (
    <div className={`mt-2 flex items-center gap-1.5 ${side === "right" ? "justify-end" : ""}`}>
      <div className={`flex ${side === "right" ? "flex-row-reverse" : ""}`}>
        {(ids.length ? ids : [null, null, null]).slice(0, 3).map((id, i) => {
          const p = id ? supporterMap.get(id) : null;
          return (
            <div
              key={`${side}-${id || i}`}
              className={`h-6 w-6 overflow-hidden rounded-full bg-muted ring-2 ring-[#0b0b10] ${
                i > 0 ? (side === "right" ? "mr-[-6px]" : "ml-[-6px]") : ""
              }`}
            >
              {p?.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-muted-foreground">
                  {(p?.display_name || "?")[0]}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span className={`text-[10px] font-bold ${side === "left" ? "text-sky-300" : "text-rose-300"}`}>
        +{formatCompact(Math.max(count, ids.length))}
      </span>
    </div>
  );

  return (
    <motion.div
      layout
      onClick={() => {}}
      className={`overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0b0b10] text-white shadow-[0_24px_60px_-28px_rgba(88,28,255,0.45)] transition-all duration-300 ${
        finalMinute ? "ring-1 ring-rose-500/50" : ""
      } ${isFullscreen ? "fixed inset-2 z-50 flex flex-col" : ""}`}
      style={isFullscreen ? { maxHeight: "calc(100vh - 16px)" } : {}}
    >
      {isFullscreen && (
        <div className="fixed inset-0 -z-10 bg-black/80" onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }} />
      )}

      {battle.media_type !== "video" && isActive && (
        <>
          <audio ref={audioLeftRef} src={battle.challenger_media_url || ""} preload="metadata" />
          <audio ref={audioRightRef} src={battle.opponent_media_url || ""} preload="metadata" />
        </>
      )}

      {/* Status bar — matches mockup */}
      <div className="flex items-center gap-2 px-3.5 pb-1 pt-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-violet-300 ring-1 ring-violet-400/30">
          {cat.emoji} {cat.label} Battle
        </span>
        <BattleStatusBadge status={finalMinute ? "ending" : uiStatus} />
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-white/55">
          <Clock className="h-3 w-3" />
          {uiStatus === "waiting" || uiStatus === "open" ? "Waiting" : `${timerLabel} remaining`}
        </span>
        <span className="text-[10px] font-bold text-white/45">{watchingLabel} watching</span>
        {user?.id === battle.challenger_id && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
            className="rounded-full p-1 text-white/40 hover:text-rose-400"
            aria-label="Delete battle"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Neon VS matchup */}
      <div className="relative px-3 pb-2 pt-2">
        <div className="mb-2 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black tracking-[0.04em] text-[#3b82f6]">
              {challengerName.toUpperCase()}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-white/70">
              <span className="truncate">{battle.challenger_title || battle.title || "Entry"}</span>
              {battle.challenger_media_url || battle.challenger_cover_url ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#3b82f6]" />
              ) : null}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-[11px] font-black tracking-[0.04em] text-[#e11d48]">
              {opponentName.toUpperCase()}
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1 truncate text-[11px] font-semibold text-white/70">
              {battle.opponent_media_url || battle.opponent_cover_url ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#e11d48]" />
              ) : null}
              <span className="truncate">{battle.opponent_title || (battle.opponent_id ? "Waiting…" : "Open slot")}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          className="relative block w-full"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <div>
              <div
                className="relative aspect-square overflow-hidden rounded-2xl shadow-[0_0_24px_rgba(37,99,235,0.35)] ring-[3px] ring-[#2563eb]/80"
              >
                {battle.challenger_cover_url ? (
                  <img src={battle.challenger_cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-600/40 to-sky-950">
                    <span className="text-4xl opacity-50">🎵</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <p className="absolute inset-x-2 bottom-8 truncate text-center font-black uppercase italic tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                  style={{ fontSize: "clamp(14px, 4.2vw, 22px)" }}
                >
                  {(battle.challenger_title || "READY").split(" ")[0]}
                </p>
                <span className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
                  <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
                </span>
              </div>
              {renderSupporters(leftVoterIds, challengerVotes, "left")}
            </div>

            {/* VS sits in the gutter between the two screens */}
            <div className="relative z-20 flex items-center justify-center self-center pb-8">
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 10px rgba(37,99,235,0.35)",
                    "0 0 22px rgba(225,29,72,0.45)",
                    "0 0 10px rgba(37,99,235,0.35)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black font-black tracking-[0.16em] text-white ring-2 ring-white/85"
              >
                VS
              </motion.div>
            </div>

            <div>
              <div
                className={`relative aspect-square overflow-hidden rounded-2xl ring-[3px] ${
                  battle.opponent_cover_url
                    ? "shadow-[0_0_24px_rgba(225,29,72,0.35)] ring-[#e11d48]/80"
                    : "shadow-none ring-[#e11d48]/35"
                }`}
              >
                {battle.opponent_cover_url ? (
                  <img src={battle.opponent_cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-rose-950/80 to-black px-3 text-center">
                    <span className="text-3xl opacity-50">❓</span>
                    <p className="mt-2 text-[11px] font-bold text-white/60">
                      {isPending ? "Waiting for opponent" : "Open challenge"}
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                {battle.opponent_title ? (
                  <p
                    className="absolute inset-x-2 bottom-8 truncate text-center font-black uppercase italic tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                    style={{ fontSize: "clamp(14px, 4.2vw, 22px)" }}
                  >
                    {battle.opponent_title.split(" ")[0]}
                  </p>
                ) : null}
                {battle.opponent_cover_url ? (
                  <span className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
                    <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />
                  </span>
                ) : null}
              </div>
              {renderSupporters(rightVoterIds, opponentVotes, "right")}
            </div>
          </div>
        </button>
      </div>

      {isActive && battle.media_type === "audio" && !isExpired && (
        <div className="space-y-1 px-4 py-1" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/25">
              {isPlaying ? <Pause className="h-3 w-3 text-violet-200" fill="currentColor" /> : <Play className="ml-0.5 h-3 w-3 text-violet-200" fill="currentColor" />}
            </button>
            <span className="min-w-[2rem] font-mono text-[9px] text-white/50">{fmt(currentTime)}</span>
            <Slider
              value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="seek-area flex-1"
              role="slider"
            />
            <span className="min-w-[2rem] text-right font-mono text-[9px] text-white/50">{fmt(duration)}</span>
          </div>
        </div>
      )}

      {/* Crowd Momentum */}
      <div className="px-3.5 pb-3 pt-1">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
          🔥 Crowd Momentum
        </p>
        <div className="mt-1.5 flex items-end justify-between">
          <motion.p
            key={`lp-${challengerPct}`}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-3xl font-black tabular-nums text-[#3b82f6]"
          >
            {challengerPct}%
          </motion.p>
          <motion.p
            key={`rp-${opponentPct}`}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-3xl font-black tabular-nums text-[#e11d48]"
          >
            {opponentPct}%
          </motion.p>
        </div>
        <div className="mt-2">
          <BattleWavyMeter leftPct={challengerPct} size="sm" />
        </div>
        <p className="mt-1.5 text-center text-[11px] font-bold text-white/50">
          {formatCompact(totalVotes)} votes
          {momentum.trending !== "none" ? ` · ${momentum.label}` : ""}
        </p>

        {/* Leading callout + CTA */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#12162a] px-3 py-2.5 ring-1 ring-violet-500/20">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <p className="text-xs font-semibold leading-snug text-white/85">
                {uiStatus === "waiting" || uiStatus === "open"
                  ? "Battle created — waiting for the opponent to join the arena."
                  : totalVotes === 0
                    ? "Crowd is warming up — cast the first vote!"
                    : winner === "tied"
                      ? "Dead heat — every vote can flip this battle."
                      : `${leadName} is leading by ${leadPct}% · Keep voting — every vote counts!`}
              </p>
            </div>
          </div>
          {canAccept && !battle.opponent_media_url ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/battle/${battle.id}`); }}
              className="shrink-0 rounded-full bg-violet-500 px-3 py-2 text-[11px] font-black text-white shadow-[0_0_18px_rgba(139,92,246,0.55)]"
            >
              Enter Arena
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openBattle(); }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-500 px-3 py-2 text-[11px] font-black text-white shadow-[0_0_18px_rgba(139,92,246,0.55)]"
            >
              <Zap className="h-3.5 w-3.5" />
              {onOpen ? "Open battle" : "Cast your vote"}
            </button>
          )}
        </div>
      </div>

      {/* Stats + share */}
      <div className="flex items-center gap-3 border-t border-white/10 px-3.5 py-2.5">
        <span className="flex items-center gap-1 text-xs text-white/55">
          <Eye className="h-4 w-4" /> {formatCompact(battle.views || 0)}
        </span>
        <button onClick={toggleBattleLike} className="flex items-center gap-1 text-xs text-white/55">
          <Heart className={`h-4 w-4 ${battleLiked ? "fill-rose-500 text-rose-500" : ""}`} />
          {formatCompact(battleLikesCount)}
        </button>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="flex items-center gap-1 text-xs text-white/55">
          <MessageCircle className="h-4 w-4" /> {formatCompact(battleComments.length)}
        </button>
        <span className="flex items-center gap-1 text-xs text-white/55">
          <Gift className="h-4 w-4" /> {formatCompact(Math.max(0, Math.round(totalVotes / 4)))}
        </span>
        <button
          onClick={handleBattleShare}
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80 ring-1 ring-white/10"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>

      {isParticipant ? (
        <div className="bg-white/5 px-3.5 py-2 text-center text-[11px] font-semibold text-white/45">
          {isChallenger
            ? `You can vote for ${firstName(opponentName)} — not yourself.`
            : isOpponent
              ? `You can vote for ${firstName(challengerName)} — not yourself.`
              : "You can vote for the other side — not yourself."}
        </div>
      ) : null}

      {/* Comments */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-48 space-y-2 overflow-y-auto px-4 py-3">
              {battleComments.length === 0 && <p className="py-4 text-center text-xs text-white/40">No comments yet</p>}
              {battleComments.map((c: any) => {
                const cp = commentProfileMap.get(c.user_id) || profileMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white/10">
                      {cp?.avatar_url ? <img src={cp.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/50">{(cp?.display_name || "U")[0]}</div>}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-white/45">{cp?.display_name || "User"}</span>
                      <p className="text-xs text-white/90">{c.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={commentsEndRef} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto border-t border-white/10 px-4 py-1.5 scrollbar-hide">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => commentMutation.mutate(e)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm hover:bg-white/15">{e}</button>
              ))}
            </div>
            <div className="flex gap-2 border-t border-white/10 px-4 py-2">
              <Input placeholder="Drop a comment..." value={comment} onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) commentMutation.mutate(comment.trim()); }}
                className="h-8 border-white/10 bg-white/5 text-xs text-white" />
              <button onClick={() => comment.trim() && commentMutation.mutate(comment.trim())} disabled={!comment.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 disabled:opacity-50">
                <Send className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BattleCard;
