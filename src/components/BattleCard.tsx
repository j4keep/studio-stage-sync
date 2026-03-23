import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Clock, Trophy, Crown, MessageCircle, Send, Play, Pause } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { useEffect } from "react";
import { Slider } from "@/components/ui/slider";

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
  const challengerVotes = votes.filter((v: any) => v.voted_for === battle.challenger_id).length;
  const opponentVotes = battle.opponent_id ? votes.filter((v: any) => v.voted_for === battle.opponent_id).length : 0;
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

  return (
    <motion.div
      layout
      onClick={() => {}}
      className={`rounded-2xl overflow-hidden bg-card border border-border shadow-lg transition-all duration-300 ${
        isFullscreen ? "fixed inset-2 z-50 flex flex-col" : ""
      }`}
      style={isFullscreen ? { maxHeight: "calc(100vh - 16px)" } : {}}
    >
      {/* Fullscreen overlay background */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/80 -z-10" onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }} />
      )}

      {/* Hidden audio elements */}
      {battle.media_type !== "video" && (
        <>
          <audio ref={audioLeftRef} src={battle.challenger_media_url || ""} preload="metadata" />
          <audio ref={audioRightRef} src={battle.opponent_media_url || ""} preload="metadata" />
        </>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Music Battle</span>
        </div>
        <div className="flex items-center gap-2">
          {battle.max_duration_minutes && battle.max_duration_minutes < 45 && (
            <span className="text-[9px] text-muted-foreground font-mono">{battle.max_duration_minutes}min limit</span>
          )}
          {isActive && !isExpired && timeLeft && (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-primary">
              <Clock className="h-3 w-3" /> {timeLeft}
            </span>
          )}
          {isExpired && <span className="text-[10px] font-bold text-primary flex items-center gap-1"><Trophy className="h-3 w-3" /> ENDED</span>}
          {isOpen && <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-[10px] font-bold text-green-400">OPEN</span>}
          {isPending && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">PENDING</span>}
          {isActive && !isExpired && <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-[10px] font-bold text-destructive animate-pulse">● LIVE</span>}
          {user?.id === battle.challenger_id && (
            <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="text-center py-1.5">
        <p className="text-[11px] font-bold text-muted-foreground truncate px-4">{battle.title}</p>
      </div>

      {/* Split covers — tap to open full experience */}
      <button onTouchEnd={handleTouchEnd} onClick={handleClick} className="w-full relative block" style={{ minHeight: isFullscreen ? 300 : 220 }}>
        <div className="grid grid-cols-2 h-full" style={{ minHeight: isFullscreen ? 300 : 220 }}>
          {/* Left */}
          <div className="relative overflow-hidden">
            {battle.challenger_cover_url ? (
              <img src={battle.challenger_cover_url} alt="" className="w-full h-full object-cover absolute inset-0" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center absolute inset-0">
                <span className="text-4xl opacity-30">🎵</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            {activeArtist === "left" && isPlaying && (
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 pointer-events-none"
                style={{ boxShadow: "inset 0 0 30px 4px hsl(var(--primary) / 0.4)" }}
              />
            )}
            {winner === "left" && totalVotes > 0 && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/90">
                <Crown className="h-2.5 w-2.5 text-black" />
                <span className="text-[8px] font-black text-black">WINNING</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
              <p className="text-white font-bold text-sm truncate">{challengerName}</p>
              <p className="text-white/50 text-[10px] truncate">{battle.challenger_title || "Track"}</p>
            </div>
          </div>

          {/* Right */}
          <div className="relative overflow-hidden border-l border-white/10">
            {battle.opponent_cover_url ? (
              <img src={battle.opponent_cover_url} alt="" className="w-full h-full object-cover absolute inset-0" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center absolute inset-0">
                <span className="text-4xl opacity-30">{battle.opponent_id ? "🎵" : "❓"}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            {activeArtist === "right" && isPlaying && (
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 pointer-events-none"
                style={{ boxShadow: "inset 0 0 30px 4px hsl(var(--destructive) / 0.4)" }}
              />
            )}
            {winner === "right" && totalVotes > 0 && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/90">
                <Crown className="h-2.5 w-2.5 text-black" />
                <span className="text-[8px] font-black text-black">WINNING</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
              <p className="text-white font-bold text-sm truncate text-right">{opponentName}</p>
              <p className="text-white/50 text-[10px] truncate text-right">{battle.opponent_title || "Waiting..."}</p>
            </div>
          </div>
        </div>

        {/* Center play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg backdrop-blur-sm">
            <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
          </div>
        </div>
      </button>

      {/* Seekable audio progress bar */}
      {isActive && battle.media_type === "audio" && (
        <div className="px-4 py-2 space-y-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              {isPlaying ? <Pause className="w-3 h-3 text-primary" fill="currentColor" /> : <Play className="w-3 h-3 text-primary ml-0.5" fill="currentColor" />}
            </button>
            <span className="text-[9px] font-mono text-muted-foreground min-w-[2rem]">{fmt(currentTime)}</span>
            <Slider
              value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="flex-1 seek-area"
              role="slider"
            />
            <span className="text-[9px] font-mono text-muted-foreground min-w-[2rem] text-right">{fmt(duration)}</span>
          </div>
          <p className="text-center text-[9px] text-muted-foreground">
            🎧 {activeArtist === "left" ? challengerName : opponentName}
          </p>
        </div>
      )}

      {/* Vote bar */}
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-primary">{challengerPct}%</span>
          <span className="text-[10px] text-muted-foreground">{totalVotes} votes</span>
          <span className="text-xs font-bold text-destructive">{opponentPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
          <motion.div className="h-full bg-primary rounded-l-full" animate={{ width: `${challengerPct}%` }} transition={{ type: "spring", stiffness: 200, damping: 25 }} />
          <motion.div className="h-full bg-destructive rounded-r-full" animate={{ width: `${opponentPct}%` }} transition={{ type: "spring", stiffness: 200, damping: 25 }} />
        </div>
      </div>

      {/* Accept challenge */}
      {canAccept && !battle.opponent_media_url && (
        <div className="border-t border-border px-4 py-3">
          {isPending && user?.id === battle.opponent_id && (
            <p className="mb-2 text-center text-xs font-bold text-primary">🥊 You've been challenged!</p>
          )}
          <p className="mb-3 text-center text-[11px] text-muted-foreground">
            Open the battle player to upload your entry ({battle.media_type} only, max {battle.max_duration_minutes || 45} min).
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/battle/${battle.id}`); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold gradient-primary text-primary-foreground"
          >
            <Play className="h-4 w-4" fill="currentColor" /> Open Battle Player
          </button>
        </div>
      )}

      {/* Comments toggle */}
      <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="flex w-full items-center justify-center gap-2 border-t border-border py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <MessageCircle className="h-3.5 w-3.5" /> {battleComments.length} Comments
      </button>

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
