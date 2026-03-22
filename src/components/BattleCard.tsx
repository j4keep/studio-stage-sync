import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ThumbsUp, Send, Trash2, Upload, Trophy, Clock, MessageCircle, Crown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";

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
}

const EMOJIS = ["🔥", "💀", "🎤", "👑", "💪", "😤", "🏆", "⚡"];

const BattleCard = ({ battle }: { battle: Battle }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Core state ──
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeArtist, setActiveArtist] = useState<"left" | "right" | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");

  // Accept battle state
  const [showUpload, setShowUpload] = useState(false);
  const [acceptTrackTitle, setAcceptTrackTitle] = useState("");
  const [acceptMediaFile, setAcceptMediaFile] = useState<File | null>(null);
  const [acceptCoverFile, setAcceptCoverFile] = useState<File | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Refs
  const audioLeftRef = useRef<HTMLAudioElement | null>(null);
  const audioRightRef = useRef<HTMLAudioElement | null>(null);
  const videoLeftRef = useRef<HTMLVideoElement | null>(null);
  const videoRightRef = useRef<HTMLVideoElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const isVideo = battle.media_type === "video";
  const expiresAt = battle.expires_at ? new Date(battle.expires_at) : new Date(new Date(battle.created_at).getTime() + 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expiresAt;
  const isActive = battle.status === "active" && !!battle.opponent_media_url;
  const bothHaveMedia = !!battle.challenger_media_url && !!battle.opponent_media_url;

  // ── Countdown timer ──
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
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isActive, isExpired]);

  // ── Data queries ──
  const { data: votes = [] } = useQuery({
    queryKey: ["battle-votes", battle.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("battle_votes").select("*").eq("battle_id", battle.id);
      return data || [];
    },
  });

  const { data: battleComments = [] } = useQuery({
    queryKey: ["battle-comments", battle.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("battle_comments").select("*").eq("battle_id", battle.id).order("created_at", { ascending: true });
      return data || [];
    },
  });

  const allUserIds = [battle.challenger_id, ...(battle.opponent_id ? [battle.opponent_id] : []), ...battleComments.map((c: any) => c.user_id)];
  const uniqueIds = [...new Set(allUserIds)];

  const { data: profiles = [] } = useQuery({
    queryKey: ["battle-profiles", uniqueIds.join(",")],
    queryFn: async () => {
      if (uniqueIds.length === 0) return [];
      const { data } = await (supabase as any).from("profiles").select("user_id, display_name, avatar_url").in("user_id", uniqueIds);
      return data || [];
    },
    enabled: uniqueIds.length > 0,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
  const challengerProfile = profileMap.get(battle.challenger_id) as any;
  const opponentProfile = battle.opponent_id ? profileMap.get(battle.opponent_id) as any : null;
  const challengerName = challengerProfile?.display_name || "Challenger";
  const opponentName = opponentProfile?.display_name || "???";

  // ── Vote calculations ──
  const challengerVotes = votes.filter((v: any) => v.voted_for === battle.challenger_id).length;
  const opponentVotes = battle.opponent_id ? votes.filter((v: any) => v.voted_for === battle.opponent_id).length : 0;
  const totalVotes = challengerVotes + opponentVotes;
  const challengerPct = totalVotes > 0 ? Math.round((challengerVotes / totalVotes) * 100) : 50;
  const opponentPct = totalVotes > 0 ? Math.round((opponentVotes / totalVotes) * 100) : 50;
  const userVote = votes.find((v: any) => v.user_id === user?.id);
  const currentWinner = totalVotes > 0 ? (challengerVotes > opponentVotes ? "left" : challengerVotes < opponentVotes ? "right" : "tied") : "tied";
  const winnerId = isExpired && totalVotes > 0 ? (challengerVotes > opponentVotes ? battle.challenger_id : challengerVotes < opponentVotes ? battle.opponent_id : null) : null;

  const canVote = isActive && !isExpired && user && user.id !== battle.challenger_id && user.id !== battle.opponent_id;
  const isOpen = battle.status === "open" && !battle.opponent_id;
  const isPending = battle.status === "pending" && battle.opponent_id;
  const canAccept = (isOpen && user?.id !== battle.challenger_id) || (isPending && user?.id === battle.opponent_id);

  // ── Realtime ──
  useEffect(() => {
    const vCh = supabase.channel(`bv-${battle.id}`).on("postgres_changes", { event: "*", schema: "public", table: "battle_votes", filter: `battle_id=eq.${battle.id}` }, () => {
      queryClient.invalidateQueries({ queryKey: ["battle-votes", battle.id] });
    }).subscribe();
    const cCh = supabase.channel(`bc-${battle.id}`).on("postgres_changes", { event: "*", schema: "public", table: "battle_comments", filter: `battle_id=eq.${battle.id}` }, () => {
      queryClient.invalidateQueries({ queryKey: ["battle-comments", battle.id] });
    }).subscribe();
    return () => { supabase.removeChannel(vCh); supabase.removeChannel(cCh); };
  }, [battle.id, queryClient]);

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [battleComments.length]);

  // ── Mutations ──
  const voteMutation = useMutation({
    mutationFn: async (votedFor: string) => {
      if (isExpired) { toast.error("Battle has ended!"); return; }
      if (userVote) {
        if (userVote.voted_for === votedFor) {
          await (supabase as any).from("battle_votes").delete().eq("id", userVote.id);
        } else {
          await (supabase as any).from("battle_votes").update({ voted_for: votedFor }).eq("id", userVote.id);
        }
      } else {
        await (supabase as any).from("battle_votes").insert({ battle_id: battle.id, user_id: user?.id, voted_for: votedFor });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["battle-votes", battle.id] }),
  });

  const deleteBattleMutation = useMutation({
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

  // ── Audio engine ──
  const getMedia = useCallback((side: "left" | "right") => {
    if (isVideo) return side === "left" ? videoLeftRef.current : videoRightRef.current;
    return side === "left" ? audioLeftRef.current : audioRightRef.current;
  }, [isVideo]);

  const stopAll = useCallback(() => {
    [audioLeftRef, audioRightRef, videoLeftRef, videoRightRef].forEach(ref => {
      if (ref.current) { ref.current.pause(); ref.current.currentTime = 0; }
    });
  }, []);

  const playSide = useCallback((side: "left" | "right") => {
    stopAll();
    const media = getMedia(side);
    if (media) {
      media.play().catch(() => {});
      setActiveArtist(side);
      setIsPlaying(true);
    }
  }, [getMedia, stopAll]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      const media = activeArtist ? getMedia(activeArtist) : null;
      media?.pause();
      setIsPlaying(false);
    } else {
      const side = activeArtist || "left";
      const media = getMedia(side);
      if (media) {
        media.play().catch(() => {});
        setActiveArtist(side);
        setIsPlaying(true);
      }
    }
  }, [isPlaying, activeArtist, getMedia]);

  const handleSideTap = useCallback((side: "left" | "right") => {
    if (!bothHaveMedia) return;
    if (activeArtist === side && isPlaying) {
      // Already playing this side - pause
      getMedia(side)?.pause();
      setIsPlaying(false);
    } else {
      playSide(side);
    }
  }, [bothHaveMedia, activeArtist, isPlaying, getMedia, playSide]);

  // Time updates
  useEffect(() => {
    const updateTime = () => {
      if (!activeArtist) return;
      const media = getMedia(activeArtist);
      if (media) {
        setCurrentTime(media.currentTime || 0);
        setDuration(media.duration || 0);
      }
    };
    const leftA = audioLeftRef.current;
    const rightA = audioRightRef.current;
    const leftV = videoLeftRef.current;
    const rightV = videoRightRef.current;
    [leftA, rightA, leftV, rightV].forEach(el => el?.addEventListener("timeupdate", updateTime));
    [leftA, rightA, leftV, rightV].forEach(el => el?.addEventListener("loadedmetadata", updateTime));
    return () => {
      [leftA, rightA, leftV, rightV].forEach(el => el?.removeEventListener("timeupdate", updateTime));
      [leftA, rightA, leftV, rightV].forEach(el => el?.removeEventListener("loadedmetadata", updateTime));
    };
  }, [activeArtist, getMedia]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const playbackPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ── Accept battle ──
  const validateMediaDuration = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
      el.preload = "metadata";
      el.onloadedmetadata = () => { URL.revokeObjectURL(el.src); resolve(el.duration <= 45 * 60 || (toast.error("Max 45 min!"), false)); };
      el.src = URL.createObjectURL(file);
    });
  };

  const handleAcceptBattle = async () => {
    if (!user || !acceptTrackTitle.trim()) return;
    setAccepting(true);
    try {
      let mediaUrl = "", coverUrl = "";
      if (acceptMediaFile) {
        const ext = acceptMediaFile.name.split(".").pop();
        const path = `battles/${user.id}/${Date.now()}.${ext}`;
        const { data: ud } = await supabase.storage.from("media").upload(path, acceptMediaFile);
        if (ud) { const { data: u } = supabase.storage.from("media").getPublicUrl(path); mediaUrl = u.publicUrl; }
      }
      if (acceptCoverFile) {
        const ext = acceptCoverFile.name.split(".").pop();
        const path = `battles/covers/${user.id}/${Date.now()}.${ext}`;
        const { data: ud } = await supabase.storage.from("media").upload(path, acceptCoverFile);
        if (ud) { const { data: u } = supabase.storage.from("media").getPublicUrl(path); coverUrl = u.publicUrl; }
      }
      await (supabase as any).from("battles").update({
        opponent_id: user.id, status: "active", opponent_title: acceptTrackTitle.trim(),
        opponent_media_url: mediaUrl || null, opponent_cover_url: coverUrl || null,
      }).eq("id", battle.id);
      queryClient.invalidateQueries({ queryKey: ["battles"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Challenge accepted! 🥊");
      setShowUpload(false);
    } catch { toast.error("Failed to accept"); } finally { setAccepting(false); }
  };

  // ── RENDER ──
  return (
    <motion.div layout className="rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)]" style={{ background: "linear-gradient(180deg, hsl(240 8% 6%) 0%, hsl(240 8% 3%) 100%)" }}>

      {/* ═══ HEADER BAR ═══ */}
      <div className="flex items-center justify-between px-5 py-3" style={{ background: "linear-gradient(90deg, hsl(240 8% 10%) 0%, hsl(240 8% 8%) 100%)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground/70">Music Battle</span>
        </div>
        <div className="flex items-center gap-2">
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
            <button onClick={() => deleteBattleMutation.mutate()} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Battle title */}
      <div className="text-center py-2">
        <p className="text-xs font-bold text-foreground/50 truncate px-6">{battle.title}</p>
      </div>

      {/* ═══ IMMERSIVE BATTLE ARENA ═══ */}
      <div className="relative" style={{ minHeight: 380 }}>
        <div className="grid grid-cols-2 h-full" style={{ minHeight: 380 }}>

          {/* LEFT ARTIST */}
          <motion.button
            onClick={() => handleSideTap("left")}
            animate={{
              opacity: activeArtist === "right" ? 0.4 : 1,
              scale: activeArtist === "left" && isPlaying ? 1 : activeArtist === "right" ? 0.97 : 1,
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="relative overflow-hidden text-left border-r border-white/5"
          >
            {/* Cover */}
            <div className="absolute inset-0">
              {battle.challenger_cover_url ? (
                <img src={battle.challenger_cover_url} alt="" className="w-full h-full object-cover" />
              ) : isVideo && battle.challenger_media_url ? (
                <video ref={videoLeftRef} src={battle.challenger_media_url} onEnded={handleEnded} className="w-full h-full object-cover" playsInline muted={activeArtist !== "left"} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900/60 via-blue-800/30 to-transparent flex items-center justify-center">
                  <span className="text-5xl opacity-30">🎵</span>
                </div>
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />
            </div>

            {/* Active glow ring — breathing animation */}
            <AnimatePresence>
              {activeArtist === "left" && isPlaying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ boxShadow: "inset 0 0 60px 8px hsl(var(--primary) / 0.5), inset 0 0 120px 20px hsl(var(--primary) / 0.15)" }}
                />
              )}
            </AnimatePresence>

            {/* Winning side glow — persistent golden shimmer */}
            {currentWinner === "left" && totalVotes > 0 && !isPlaying && (
              <motion.div
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="absolute inset-0 pointer-events-none z-10"
                style={{ boxShadow: "inset 0 0 50px 5px rgba(255,200,0,0.2)" }}
              />
            )}

            {/* WINNING badge */}
            <AnimatePresence>
              {currentWinner === "left" && totalVotes > 0 && (
                <motion.div
                  initial={{ scale: 0, y: -20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg"
                  style={{ background: "linear-gradient(135deg, hsl(42 100% 58%), hsl(30 100% 45%))", boxShadow: "0 0 20px rgba(255,200,0,0.5)" }}
                >
                  <Crown className="h-3 w-3 text-black" />
                  <span className="text-[9px] font-black text-black tracking-wide">WINNING</span>
                </motion.div>
              )}
              {currentWinner === "tied" && totalVotes > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className="text-[9px] font-black text-white">🤝 TIED</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Now playing indicator */}
            {activeArtist === "left" && isPlaying && (
              <div className="absolute top-3 right-3 z-20">
                <div className="flex items-end gap-[2px] h-4">
                  {[1,2,3,4].map(i => (
                    <motion.div
                      key={i}
                      animate={{ height: ["30%", "100%", "50%", "80%", "30%"] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                      className="w-[3px] rounded-full bg-primary"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Artist info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <p className="text-white font-black text-base truncate drop-shadow-lg">{challengerName}</p>
              <p className="text-white/50 text-[11px] truncate mt-0.5">{battle.challenger_title || "Track"}</p>
            </div>
          </motion.button>

          {/* RIGHT ARTIST */}
          <motion.button
            onClick={() => handleSideTap("right")}
            animate={{
              opacity: activeArtist === "left" ? 0.4 : 1,
              scale: activeArtist === "right" && isPlaying ? 1 : activeArtist === "left" ? 0.97 : 1,
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="relative overflow-hidden text-left"
          >
            <div className="absolute inset-0">
              {battle.opponent_cover_url ? (
                <img src={battle.opponent_cover_url} alt="" className="w-full h-full object-cover" />
              ) : isVideo && battle.opponent_media_url ? (
                <video ref={videoRightRef} src={battle.opponent_media_url} onEnded={handleEnded} className="w-full h-full object-cover" playsInline muted={activeArtist !== "right"} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-red-900/60 via-red-800/30 to-transparent flex items-center justify-center">
                  <span className="text-5xl opacity-30">{battle.opponent_id ? "🎵" : "❓"}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/30" />
            </div>

            <AnimatePresence>
              {activeArtist === "right" && isPlaying && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} exit={{ opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ boxShadow: "inset 0 0 60px 8px hsl(var(--primary) / 0.5), inset 0 0 120px 20px hsl(var(--primary) / 0.15)" }}
                />
              )}
            </AnimatePresence>

            {currentWinner === "right" && totalVotes > 0 && !isPlaying && (
              <motion.div
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="absolute inset-0 pointer-events-none z-10"
                style={{ boxShadow: "inset 0 0 50px 5px rgba(255,200,0,0.2)" }}
              />
            )}

            <AnimatePresence>
              {currentWinner === "right" && totalVotes > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg"
                  style={{ background: "linear-gradient(135deg, hsl(42 100% 58%), hsl(30 100% 45%))", boxShadow: "0 0 20px rgba(255,200,0,0.5)" }}
                >
                  <Crown className="h-3 w-3 text-black" />
                  <span className="text-[9px] font-black text-black tracking-wide">WINNING</span>
                </motion.div>
              )}
            </AnimatePresence>

            {activeArtist === "right" && isPlaying && (
              <div className="absolute top-3 left-3 z-20">
                <div className="flex items-end gap-[2px] h-4">
                  {[1,2,3,4].map(i => (
                    <motion.div key={i} animate={{ height: ["30%", "100%", "50%", "80%", "30%"] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                      className="w-[3px] rounded-full bg-primary"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <p className="text-white font-black text-base truncate drop-shadow-lg text-right">{opponentName}</p>
              <p className="text-white/50 text-[11px] truncate mt-0.5 text-right">{battle.opponent_title || "Waiting..."}</p>
            </div>
          </motion.button>
        </div>

        {/* ═══ CENTER PLAY BUTTON ═══ */}
        {bothHaveMedia && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <motion.button
              onClick={togglePlay}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.08 }}
              className="pointer-events-auto relative"
            >
              {/* Outer pulse rings — always visible but stronger when playing */}
              <motion.div
                animate={{ scale: [1, 1.8], opacity: [isPlaying ? 0.5 : 0.15, 0] }}
                transition={{ repeat: Infinity, duration: isPlaying ? 1.2 : 2.5, ease: "easeOut" }}
                className="absolute inset-[-20px] rounded-full"
                style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 70%)" }}
              />
              {isPlaying && (
                <motion.div
                  animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
                  transition={{ repeat: Infinity, duration: 1.8, delay: 0.4, ease: "easeOut" }}
                  className="absolute inset-[-30px] rounded-full"
                  style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 70%)" }}
                />
              )}

              {/* Button body */}
              <motion.div
                animate={isPlaying
                  ? { scale: [1, 1.05, 1], boxShadow: ["0 0 30px 8px hsl(var(--primary) / 0.3)", "0 0 60px 20px hsl(var(--primary) / 0.5)", "0 0 30px 8px hsl(var(--primary) / 0.3)"] }
                  : { scale: [1, 1.03, 1], boxShadow: ["0 0 20px 5px hsl(var(--primary) / 0.15)", "0 0 35px 10px hsl(var(--primary) / 0.25)", "0 0 20px 5px hsl(var(--primary) / 0.15)"] }
                }
                transition={{ repeat: Infinity, duration: isPlaying ? 1.2 : 2.5, ease: "easeInOut" }}
                className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-primary/40 backdrop-blur-sm"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
              >
                <AnimatePresence mode="wait">
                  {isPlaying ? (
                    <motion.div key="pause" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}>
                      <Pause className="h-9 w-9 text-primary-foreground fill-primary-foreground" />
                    </motion.div>
                  ) : (
                    <motion.div key="play" initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: -90 }} transition={{ duration: 0.2 }}>
                      <Play className="h-9 w-9 text-primary-foreground fill-primary-foreground ml-1" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.button>
          </div>
        )}
      </div>

      {/* ═══ VOTE PROGRESS BAR ═══ */}
      <div className="px-5 py-3" style={{ background: "hsl(240 8% 6%)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => canVote && voteMutation.mutate(battle.challenger_id)}
              disabled={!canVote}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                userVote?.voted_for === battle.challenger_id
                  ? "bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                  : canVote ? "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25" : "bg-muted/20 text-muted-foreground"
              }`}
            >
              <ThumbsUp className={`h-3 w-3 ${userVote?.voted_for === battle.challenger_id ? "fill-current" : ""}`} />
              {challengerVotes}
            </button>
            <span className="text-lg font-black text-blue-400">{challengerPct}%</span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">{totalVotes} votes</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-red-400">{opponentPct}%</span>
            <button
              onClick={() => canVote && battle.opponent_id && voteMutation.mutate(battle.opponent_id)}
              disabled={!canVote || !battle.opponent_id}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                userVote?.voted_for === battle.opponent_id
                  ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                  : canVote ? "bg-red-500/15 text-red-400 hover:bg-red-500/25" : "bg-muted/20 text-muted-foreground"
              }`}
            >
              {opponentVotes}
              <ThumbsUp className={`h-3 w-3 ${userVote?.voted_for === battle.opponent_id ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>

        {/* Vote bar */}
        <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "hsl(240 8% 12%)" }}>
          <motion.div
            animate={{ width: `${challengerPct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="h-full rounded-l-full"
            style={{ background: "linear-gradient(90deg, hsl(217 91% 50%), hsl(217 91% 60%))" }}
          />
          <motion.div
            animate={{ width: `${opponentPct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="h-full rounded-r-full"
            style={{ background: "linear-gradient(90deg, hsl(0 84% 50%), hsl(0 84% 60%))" }}
          />
        </div>
      </div>

      {/* ═══ AUDIO PLAYBACK BAR ═══ */}
      {bothHaveMedia && (
        <div className="px-5 py-3 flex items-center gap-3 border-t border-white/5" style={{ background: "hsl(240 8% 5%)" }}>
          {activeArtist && isPlaying && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-[2px] h-3 shrink-0">
              {[1,2,3].map(i => (
                <motion.div key={i} animate={{ height: ["30%", "100%", "30%"] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                  className="w-[2px] rounded-full bg-primary" />
              ))}
            </motion.div>
          )}
          <span className="text-[11px] font-mono text-foreground/50 w-9 text-right shrink-0">{formatTime(currentTime)}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--primary) / 0.15)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ width: `${playbackPct}%`, background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
            />
          </div>
          <span className="text-[11px] font-mono text-foreground/50 w-9 shrink-0">{formatTime(duration)}</span>
        </div>
      )}

      {/* ═══ WINNER ANNOUNCEMENT ═══ */}
      {isExpired && winnerId && (
        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="overflow-hidden"
          style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))" }}>
          <p className="py-3 text-center text-sm font-black text-primary">
            🏆 {winnerId === battle.challenger_id ? challengerName : opponentName} wins with {winnerId === battle.challenger_id ? challengerPct : opponentPct}%!
          </p>
        </motion.div>
      )}
      {isExpired && totalVotes > 0 && !winnerId && (
        <div className="py-3 text-center" style={{ background: "hsl(240 8% 8%)" }}>
          <p className="text-sm font-bold text-foreground/60">🤝 It's a tie!</p>
        </div>
      )}

      {/* ═══ ACCEPT CHALLENGE ═══ */}
      {((isPending && user?.id === battle.opponent_id && !battle.opponent_media_url) || (isOpen && canAccept)) && (
        <div className="border-t border-white/5 px-5 py-4" style={{ background: "hsl(240 8% 7%)" }}>
          {isPending && user?.id === battle.opponent_id && (
            <p className="mb-3 text-center text-xs font-bold text-primary">🥊 You've been challenged!</p>
          )}
          {!showUpload ? (
            <button onClick={() => setShowUpload(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-primary-foreground shadow-lg"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}>
              <Upload className="h-4 w-4" /> Accept & Upload Entry
            </button>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Track title" value={acceptTrackTitle} onChange={(e) => setAcceptTrackTitle(e.target.value)} className="h-9 text-xs bg-white/5 border-white/10 text-white" />
              <div>
                <label className="mb-1 block text-[10px] text-foreground/50">{battle.media_type === "audio" ? "Song" : "Video"} (max 45 min)</label>
                <input type="file" accept={battle.media_type === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f && await validateMediaDuration(f)) setAcceptMediaFile(f); }}
                  className="w-full text-[10px] text-white file:mr-2 file:rounded-lg file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-primary" />
              </div>
              {battle.media_type === "audio" && (
                <div>
                  <label className="mb-1 block text-[10px] text-foreground/50">Cover Art</label>
                  <input type="file" accept="image/*" onChange={(e) => setAcceptCoverFile(e.target.files?.[0] || null)}
                    className="w-full text-[10px] text-white file:mr-2 file:rounded-lg file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-primary" />
                </div>
              )}
              <button onClick={handleAcceptBattle}
                disabled={accepting || !acceptTrackTitle.trim() || !acceptMediaFile || (battle.media_type === "audio" && !acceptCoverFile)}
                className="w-full rounded-2xl py-3 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}>
                {accepting ? "Uploading..." : "🥊 Accept Challenge"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ COMMENTS TOGGLE ═══ */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-center gap-2 border-t border-white/5 py-3 text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
        style={{ background: "hsl(240 8% 5%)" }}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {battleComments.length} Comments
        {totalVotes > 0 && <span className="text-foreground/20">•</span>}
        {totalVotes > 0 && <span>{totalVotes} votes</span>}
      </button>

      {/* ═══ COMMENTS SECTION ═══ */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5" style={{ background: "hsl(240 8% 5%)" }}>
            <div className="max-h-48 space-y-2 overflow-y-auto px-5 py-3">
              {battleComments.length === 0 && <p className="py-4 text-center text-xs text-foreground/30">No comments yet</p>}
              {battleComments.map((c: any) => {
                const cp = profileMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-muted/30 overflow-hidden">
                      {cp?.avatar_url ? <img src={cp.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-foreground/40">{(cp?.display_name || "U")[0]}</div>}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-foreground/40">{cp?.display_name || "User"}</span>
                      <p className="text-xs text-foreground/80">{c.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={commentsEndRef} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto border-t border-white/5 px-5 py-1.5 scrollbar-hide">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => commentMutation.mutate(e)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/10 text-sm hover:bg-muted/20">{e}</button>
              ))}
            </div>
            <div className="flex gap-2 border-t border-white/5 px-5 py-2">
              <Input placeholder="Drop a comment..." value={comment} onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) commentMutation.mutate(comment.trim()); }}
                className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-foreground/30" />
              <button onClick={() => comment.trim() && commentMutation.mutate(comment.trim())} disabled={!comment.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary disabled:opacity-50">
                <Send className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden audio */}
      {!isVideo && battle.challenger_media_url && <audio ref={audioLeftRef} src={battle.challenger_media_url} onEnded={handleEnded} />}
      {!isVideo && battle.opponent_media_url && <audio ref={audioRightRef} src={battle.opponent_media_url} onEnded={handleEnded} />}
    </motion.div>
  );
};

export default BattleCard;
