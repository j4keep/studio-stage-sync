import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Clock, Crown, MessageCircle, Send, Play, Pause, Heart, Eye, Share2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
import BattleCategoryChip from "@/components/battle/BattleCategoryChip";
import BattleLiveMeter from "@/components/battle/BattleLiveMeter";
import {
  formatCompact,
  formatCountdown,
  getBattleExpiresAt,
  getBattleUiStatus,
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

const BattleCard = ({ battle }: { battle: Battle }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const isActive = battle.status === "active" && !!battle.opponent_media_url;
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
  });
  const participantIds = [battle.challenger_id, battle.opponent_id].filter(Boolean);
  const audienceVotes = votes.filter((v: any) => !participantIds.includes(v.user_id));
  const challengerVotes = audienceVotes.filter((v: any) => v.voted_for === battle.challenger_id).length;
  const opponentVotes = battle.opponent_id ? audienceVotes.filter((v: any) => v.voted_for === battle.opponent_id).length : 0;
  const totalVotes = challengerVotes + opponentVotes;
  const challengerPct = totalVotes > 0 ? Math.round((challengerVotes / totalVotes) * 100) : 50;
  const opponentPct = totalVotes > 0 ? 100 - challengerPct : 50;
  const winner = totalVotes === 0 ? null : challengerVotes > opponentVotes ? "left" : challengerVotes < opponentVotes ? "right" : "tied";

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
      queryClient.invalidateQueries({ queryKey: ["battles"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
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

  const handleBattleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/battle/${battle.id}`);
    toast.success("Link copied!");
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
      setIsFullscreen((prev) => !prev);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        navigate(`/battle/${battle.id}`);
      }, 450);
    }
  }, [navigate, battle.id]);

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
  const endsLabel =
    uiStatus === "ended"
      ? "Battle finished"
      : uiStatus === "waiting" || uiStatus === "open"
        ? "Waiting to start"
        : `Ends in ${formatCountdown(msLeft)}`;

  return (
    <motion.div
      layout
      onClick={() => {}}
      className={`overflow-hidden rounded-[1.4rem] border border-border/80 bg-card shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)] transition-all duration-300 ${
        isFullscreen ? "fixed inset-2 z-50 flex flex-col" : ""
      }`}
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

      {/* Event header */}
      <div className="flex items-start justify-between gap-2 px-3.5 pb-2 pt-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <BattleCategoryChip mediaType={battle.media_type} className="bg-muted text-foreground ring-border" />
            <BattleStatusBadge status={uiStatus} />
          </div>
          <h3 className="mt-1.5 truncate text-[15px] font-black tracking-tight text-foreground">
            {battle.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />
            {endsLabel}
            {timeLeft && uiStatus === "live" ? (
              <span className="font-mono text-primary"> · {timeLeft}</span>
            ) : null}
          </p>
        </div>
        {user?.id === battle.challenger_id && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            aria-label="Delete battle"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* VS hero covers */}
      <button
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className="relative mx-3 mb-1 block w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.15rem]"
        style={{ minHeight: isFullscreen ? 300 : 240 }}
      >
        <div className="absolute inset-x-0 top-2 z-20 flex items-center justify-center pointer-events-none">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-black tracking-[0.2em] text-white backdrop-blur-md">
            VS
          </span>
        </div>
        <div className="grid h-full grid-cols-2" style={{ minHeight: isFullscreen ? 300 : 240 }}>
          <div className="relative overflow-hidden">
            {battle.challenger_cover_url ? (
              <img src={battle.challenger_cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-500/30 to-sky-900/40">
                <span className="text-4xl opacity-40">🎵</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            {activeArtist === "left" && isPlaying && (
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="pointer-events-none absolute inset-0"
                style={{ boxShadow: "inset 0 0 30px 4px rgba(56,189,248,0.45)" }}
              />
            )}
            {winner === "left" && totalVotes > 0 && uiStatus !== "ended" && (
              <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5">
                <Crown className="h-2.5 w-2.5 text-black" />
                <span className="text-[8px] font-black text-black">WINNING</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
              <p className="truncate text-base font-black text-white">{challengerName}</p>
              <p className="truncate text-[10px] text-white/60">{battle.challenger_title || "Entry"}</p>
            </div>
          </div>

          <div className="relative overflow-hidden border-l border-white/15">
            {battle.opponent_cover_url ? (
              <img src={battle.opponent_cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-500/30 to-rose-950/40">
                <span className="text-4xl opacity-40">{battle.opponent_id ? "🎵" : "❓"}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            {activeArtist === "right" && isPlaying && (
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="pointer-events-none absolute inset-0"
                style={{ boxShadow: "inset 0 0 30px 4px rgba(251,113,133,0.45)" }}
              />
            )}
            {winner === "right" && totalVotes > 0 && uiStatus !== "ended" && (
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5">
                <Crown className="h-2.5 w-2.5 text-black" />
                <span className="text-[8px] font-black text-black">WINNING</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-3 text-right">
              <p className="truncate text-base font-black text-white">{opponentName}</p>
              <p className="truncate text-[10px] text-white/60">{battle.opponent_title || "Waiting..."}</p>
            </div>
          </div>
        </div>

        {isActive && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-xl">
              <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
            </div>
          </div>
        )}
        {!isActive && uiStatus !== "ended" && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="rounded-full bg-black/65 px-3 py-1.5 backdrop-blur-sm">
              <span className="text-[10px] font-bold text-white">Waiting for opponent</span>
            </div>
          </div>
        )}
      </button>

      {isActive && battle.media_type === "audio" && !isExpired && (
        <div className="space-y-1 px-4 py-2" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
              {isPlaying ? <Pause className="h-3 w-3 text-primary" fill="currentColor" /> : <Play className="ml-0.5 h-3 w-3 text-primary" fill="currentColor" />}
            </button>
            <span className="min-w-[2rem] font-mono text-[9px] text-muted-foreground">{fmt(currentTime)}</span>
            <Slider
              value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="seek-area flex-1"
              role="slider"
            />
            <span className="min-w-[2rem] text-right font-mono text-[9px] text-muted-foreground">{fmt(duration)}</span>
          </div>
        </div>
      )}

      <div className="px-3.5 py-3">
        <BattleLiveMeter
          leftName={challengerName}
          rightName={opponentName}
          leftPct={challengerPct}
          rightPct={opponentPct}
          totalVotes={totalVotes}
          live={uiStatus === "live" || uiStatus === "ending"}
          compact
        />
      </div>

      {canAccept && !battle.opponent_media_url && (
        <div className="border-t border-border px-4 py-3">
          {isPending && user?.id === battle.opponent_id && (
            <p className="mb-2 text-center text-xs font-bold text-primary">🥊 You&apos;ve been challenged!</p>
          )}
          <p className="mb-3 text-center text-[11px] text-muted-foreground">
            Open the battle player to upload your entry ({battle.media_type} only, max {battle.max_duration_minutes || 45} min).
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/battle/${battle.id}`); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold gradient-primary text-primary-foreground"
          >
            <Play className="h-4 w-4" fill="currentColor" /> Enter the Arena
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-border px-3.5 py-2.5">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="h-4 w-4" /> {formatCompact(battle.views || 0)}
        </span>
        <button onClick={toggleBattleLike} className="flex items-center gap-1 text-xs text-muted-foreground">
          <Heart className={`h-4 w-4 ${battleLiked ? "fill-red-500 text-red-500" : ""}`} />
          {formatCompact(battleLikesCount)}
        </button>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageCircle className="h-4 w-4" /> {formatCompact(battleComments.length)}
        </button>
        <span className="text-xs font-semibold text-muted-foreground">
          🗳 {formatCompact(totalVotes)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/battle/${battle.id}`); }}
          className="ml-auto rounded-full bg-foreground px-3 py-1.5 text-[11px] font-black text-background"
        >
          Vote
        </button>
        <button onClick={handleBattleShare} className="text-muted-foreground" aria-label="Share">
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-48 space-y-2 overflow-y-auto px-4 py-3">
              {battleComments.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No comments yet</p>}
              {battleComments.map((c: any) => {
                const cp = commentProfileMap.get(c.user_id) || profileMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-muted overflow-hidden">
                      {cp?.avatar_url ? <img src={cp.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">{(cp?.display_name || "U")[0]}</div>}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground">{cp?.display_name || "User"}</span>
                      <p className="text-xs text-foreground">{c.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={commentsEndRef} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto border-t border-border px-4 py-1.5 scrollbar-hide">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => commentMutation.mutate(e)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50 text-sm hover:bg-muted">{e}</button>
              ))}
            </div>
            <div className="flex gap-2 border-t border-border px-4 py-2">
              <Input placeholder="Drop a comment..." value={comment} onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) commentMutation.mutate(comment.trim()); }}
                className="h-8 text-xs" />
              <button onClick={() => comment.trim() && commentMutation.mutate(comment.trim())} disabled={!comment.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary disabled:opacity-50">
                <Send className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BattleCard;
