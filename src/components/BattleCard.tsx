import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ThumbsUp, Send, Swords, MessageCircle, Trash2, Upload, Clock, Trophy } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSide, setCurrentSide] = useState<"left" | "right" | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const audioLeftRef = useRef<HTMLAudioElement | null>(null);
  const audioRightRef = useRef<HTMLAudioElement | null>(null);
  const videoLeftRef = useRef<HTMLVideoElement | null>(null);
  const videoRightRef = useRef<HTMLVideoElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Accept battle state
  const [showUpload, setShowUpload] = useState(false);
  const [acceptTrackTitle, setAcceptTrackTitle] = useState("");
  const [acceptMediaFile, setAcceptMediaFile] = useState<File | null>(null);
  const [acceptCoverFile, setAcceptCoverFile] = useState<File | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Expiry
  const expiresAt = battle.expires_at ? new Date(battle.expires_at) : new Date(new Date(battle.created_at).getTime() + 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expiresAt;
  const isActive = battle.status === "active" && !!battle.opponent_media_url;

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

  // Fetch votes
  const { data: votes = [] } = useQuery({
    queryKey: ["battle-votes", battle.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("battle_votes").select("*").eq("battle_id", battle.id);
      return data || [];
    },
  });

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ["battle-comments", battle.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("battle_comments")
        .select("*")
        .eq("battle_id", battle.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const allUserIds = [
    battle.challenger_id,
    ...(battle.opponent_id ? [battle.opponent_id] : []),
    ...comments.map((c: any) => c.user_id),
  ];
  const uniqueIds = [...new Set(allUserIds)];

  const { data: profiles = [] } = useQuery({
    queryKey: ["battle-profiles", uniqueIds.join(",")],
    queryFn: async () => {
      if (uniqueIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", uniqueIds);
      return data || [];
    },
    enabled: uniqueIds.length > 0,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
  const challengerProfile = profileMap.get(battle.challenger_id) as any;
  const opponentProfile = battle.opponent_id ? profileMap.get(battle.opponent_id) as any : null;
  const challengerName = challengerProfile?.display_name || "Challenger";
  const opponentName = opponentProfile?.display_name || "???";

  const challengerVotes = votes.filter((v: any) => v.voted_for === battle.challenger_id).length;
  const opponentVotes = battle.opponent_id ? votes.filter((v: any) => v.voted_for === battle.opponent_id).length : 0;
  const totalVotes = challengerVotes + opponentVotes;
  const challengerPct = totalVotes > 0 ? Math.round((challengerVotes / totalVotes) * 100) : 50;
  const opponentPct = totalVotes > 0 ? Math.round((opponentVotes / totalVotes) * 100) : 50;
  const userVote = votes.find((v: any) => v.user_id === user?.id);

  const winnerId = isExpired && totalVotes > 0
    ? (challengerVotes > opponentVotes ? battle.challenger_id : challengerVotes < opponentVotes ? battle.opponent_id : null)
    : null;

  // Realtime
  useEffect(() => {
    const votesChannel = supabase
      .channel(`battle-votes-${battle.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_votes", filter: `battle_id=eq.${battle.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["battle-votes", battle.id] });
      })
      .subscribe();
    const commentsChannel = supabase
      .channel(`battle-comments-${battle.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_comments", filter: `battle_id=eq.${battle.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["battle-comments", battle.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(votesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [battle.id, queryClient]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const voteMutation = useMutation({
    mutationFn: async (votedFor: string) => {
      if (isExpired) { toast.error("This battle has ended!"); return; }
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
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      toast.success("Battle deleted");
    },
    onError: () => toast.error("Failed to delete battle"),
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      await (supabase as any).from("battle_comments").insert({ battle_id: battle.id, user_id: user?.id, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["battle-comments", battle.id] });
      setComment("");
    },
  });

  // Playback with time tracking
  const getLeftMedia = () => battle.media_type === "video" ? videoLeftRef.current : audioLeftRef.current;
  const getRightMedia = () => battle.media_type === "video" ? videoRightRef.current : audioRightRef.current;

  useEffect(() => {
    const leftMedia = getLeftMedia();
    const rightMedia = getRightMedia();
    if (!leftMedia) return;

    const onLoadedLeft = () => {
      const leftDur = leftMedia?.duration || 0;
      const rightDur = rightMedia?.duration || 0;
      setTotalDuration(leftDur + rightDur);
    };
    leftMedia.addEventListener("loadedmetadata", onLoadedLeft);
    rightMedia?.addEventListener("loadedmetadata", onLoadedLeft);

    const onTimeUpdate = () => {
      if (currentSide === "left") {
        setPlaybackTime(leftMedia?.currentTime || 0);
      } else if (currentSide === "right") {
        setPlaybackTime((leftMedia?.duration || 0) + (rightMedia?.currentTime || 0));
      }
    };
    leftMedia.addEventListener("timeupdate", onTimeUpdate);
    rightMedia?.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      leftMedia.removeEventListener("loadedmetadata", onLoadedLeft);
      leftMedia.removeEventListener("timeupdate", onTimeUpdate);
      rightMedia?.removeEventListener("loadedmetadata", onLoadedLeft);
      rightMedia?.removeEventListener("timeupdate", onTimeUpdate);
    };
  });

  const handleCenterPlay = () => {
    if (isPlaying) {
      getLeftMedia()?.pause();
      getRightMedia()?.pause();
      setIsPlaying(false);
      setCurrentSide(null);
      return;
    }
    setIsPlaying(true);
    setCurrentSide("left");
    getLeftMedia()?.play();
  };

  const handleLeftEnded = () => {
    if (battle.opponent_media_url) {
      setCurrentSide("right");
      getRightMedia()?.play();
    } else {
      setIsPlaying(false);
      setCurrentSide(null);
    }
  };

  const handleRightEnded = () => {
    setIsPlaying(false);
    setCurrentSide(null);
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Accept with upload (max 45 min check)
  const handleAcceptBattle = async () => {
    if (!user || !acceptTrackTitle.trim()) return;
    setAccepting(true);
    try {
      let mediaUrl = "";
      let coverUrl = "";
      if (acceptMediaFile) {
        const ext = acceptMediaFile.name.split(".").pop();
        const path = `battles/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData } = await supabase.storage.from("media").upload(path, acceptMediaFile);
        if (uploadData) {
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
          mediaUrl = urlData.publicUrl;
        }
      }
      if (acceptCoverFile) {
        const ext = acceptCoverFile.name.split(".").pop();
        const path = `battles/covers/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData } = await supabase.storage.from("media").upload(path, acceptCoverFile);
        if (uploadData) {
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
          coverUrl = urlData.publicUrl;
        }
      }
      await (supabase as any).from("battles").update({
        opponent_id: user.id,
        status: "active",
        opponent_title: acceptTrackTitle.trim(),
        opponent_media_url: mediaUrl || null,
        opponent_cover_url: coverUrl || null,
      }).eq("id", battle.id);
      queryClient.invalidateQueries({ queryKey: ["battles"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Challenge accepted! 🥊");
      setShowUpload(false);
      setAcceptTrackTitle("");
      setAcceptMediaFile(null);
      setAcceptCoverFile(null);
    } catch {
      toast.error("Failed to accept challenge");
    } finally {
      setAccepting(false);
    }
  };

  const validateMediaDuration = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(el.src);
        if (el.duration > 45 * 60) {
          toast.error("Max duration is 45 minutes!");
          resolve(false);
        } else {
          resolve(true);
        }
      };
      el.src = URL.createObjectURL(file);
    });
  };

  const handleMediaFileChange = async (file: File | null) => {
    if (!file) { setAcceptMediaFile(null); return; }
    const valid = await validateMediaDuration(file);
    if (valid) setAcceptMediaFile(file);
  };

  const isOpen = battle.status === "open" && !battle.opponent_id;
  const isPending = battle.status === "pending" && battle.opponent_id;
  const canAccept = (isOpen && user?.id !== battle.challenger_id) || (isPending && user?.id === battle.opponent_id);
  const bothHaveMedia = !!battle.challenger_media_url && !!battle.opponent_media_url;
  const canVote = isActive && !isExpired && user && user.id !== battle.challenger_id && user.id !== battle.opponent_id;

  const challengerCover = battle.challenger_cover_url;
  const opponentCover = battle.opponent_cover_url;
  const isVideo = battle.media_type === "video";

  return (
    <motion.div layout className="rounded-2xl overflow-hidden shadow-2xl border border-border/30 bg-black">
      {/* ─── BATTLE TITLE HEADER ─── */}
      <div className="relative bg-gradient-to-r from-red-900/60 via-black to-blue-900/60 px-4 py-2.5 flex items-center justify-center">
        <h3 className="text-white font-black text-sm uppercase tracking-widest text-center"
          style={{ textShadow: "0 0 20px rgba(255,200,0,0.5)" }}>
          🎵 {battle.title}
        </h3>
        {user?.id === battle.challenger_id && (
          <button onClick={() => deleteBattleMutation.mutate()} className="absolute right-3 text-white/50 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ─── MAIN BATTLE VISUAL ─── */}
      <div className="relative">
        <div className="flex h-64 relative overflow-hidden">
          {/* LEFT SIDE - Challenger */}
          <div className="flex-1 relative overflow-hidden">
            {challengerCover ? (
              <img src={challengerCover} alt={challengerName} className="w-full h-full object-cover" />
            ) : isVideo && battle.challenger_media_url ? (
              <video ref={videoLeftRef} src={battle.challenger_media_url} className="w-full h-full object-cover" muted={!isPlaying || currentSide !== "left"} onEnded={handleLeftEnded} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                <span className="text-6xl font-black text-white/10">{challengerName[0]}</span>
              </div>
            )}
            {/* Red atmospheric overlay - subtle */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent pointer-events-none" />
            {/* Fire/spark particles effect on left edge */}
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/60 to-transparent pointer-events-none" />

            {/* Challenger name at top */}
            <div className="absolute top-2 left-2 z-20">
              <p className="text-white font-bold text-xs drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/40 px-2 py-0.5 rounded">
                {challengerName}
              </p>
            </div>

            {/* Vote button bottom-left */}
            <div className="absolute bottom-2 left-2 right-2 z-20 space-y-1">
              <button
                onClick={() => canVote && voteMutation.mutate(battle.challenger_id)}
                disabled={!canVote}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-bold transition-all ${
                  userVote?.voted_for === battle.challenger_id
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/40"
                    : "bg-black/60 text-white/90 border border-red-500/50 backdrop-blur-sm hover:bg-red-600/60"
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>{challengerVotes.toLocaleString()}</span>
              </button>
              {challengerPct >= opponentPct && totalVotes > 0 && (
                <span className="inline-block px-2 py-0.5 rounded bg-gradient-to-r from-red-700 to-red-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                  WINNING
                </span>
              )}
            </div>

            {/* Playing indicator */}
            {currentSide === "left" && (
              <motion.div
                className="absolute inset-0 border-2 border-red-500/70 pointer-events-none z-20"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>

          {/* CENTER - VS + Play Button */}
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
            {/* Lightning divider */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px]"
              style={{ background: "linear-gradient(to bottom, rgba(255,200,0,0.8), rgba(255,255,255,0.9), rgba(255,200,0,0.8))" }} />

            {/* VS Badge */}
            <div className="absolute top-4 z-40">
              <span className="text-3xl font-black tracking-wider"
                style={{
                  color: "#FFD700",
                  textShadow: "0 0 30px rgba(255,200,0,0.8), 0 0 60px rgba(255,150,0,0.4), 0 4px 8px rgba(0,0,0,0.9)",
                  WebkitTextStroke: "1px rgba(200,150,0,0.6)",
                }}>
                VS
              </span>
            </div>

            {/* Big Play Button */}
            {bothHaveMedia && (
              <button
                onClick={handleCenterPlay}
                className="pointer-events-auto w-20 h-20 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-40"
                style={{
                  background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.35), transparent 60%), linear-gradient(145deg, #888 0%, #444 40%, #222 100%)",
                  border: "4px solid rgba(255,255,255,0.25)",
                  boxShadow: "0 0 40px rgba(0,0,0,0.7), 0 0 80px rgba(100,100,255,0.15), inset 0 2px 4px rgba(255,255,255,0.3)",
                }}
              >
                {isPlaying ? (
                  <Pause className="w-9 h-9 text-white drop-shadow-lg" />
                ) : (
                  <Play className="w-9 h-9 text-white drop-shadow-lg ml-1" />
                )}
              </button>
            )}
          </div>

          {/* RIGHT SIDE - Opponent */}
          <div className="flex-1 relative overflow-hidden">
            {battle.opponent_id && opponentCover ? (
              <img src={opponentCover} alt={opponentName} className="w-full h-full object-cover" />
            ) : isVideo && battle.opponent_media_url ? (
              <video ref={videoRightRef} src={battle.opponent_media_url} className="w-full h-full object-cover" muted={!isPlaying || currentSide !== "right"} onEnded={handleRightEnded} />
            ) : (
              <div className="w-full h-full bg-gradient-to-bl from-neutral-800 to-neutral-900 flex items-center justify-center">
                <span className="text-6xl font-black text-white/10">{battle.opponent_id ? opponentName[0] : "?"}</span>
              </div>
            )}
            {/* Blue atmospheric overlay - subtle */}
            <div className="absolute inset-0 bg-gradient-to-l from-blue-600/20 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />

            {/* Opponent name at top */}
            <div className="absolute top-2 right-2 z-20">
              <p className="text-white font-bold text-xs drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/40 px-2 py-0.5 rounded">
                {battle.opponent_id ? opponentName : "???"}
              </p>
            </div>

            {/* Vote button bottom-right */}
            {battle.opponent_id && isActive && (
              <div className="absolute bottom-2 left-2 right-2 z-20 space-y-1 flex flex-col items-end">
                <button
                  onClick={() => canVote && battle.opponent_id && voteMutation.mutate(battle.opponent_id)}
                  disabled={!canVote}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-bold transition-all ${
                    userVote?.voted_for === battle.opponent_id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40"
                      : "bg-black/60 text-white/90 border border-blue-500/50 backdrop-blur-sm hover:bg-blue-600/60"
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>{opponentVotes.toLocaleString()}</span>
                </button>
                {opponentPct > challengerPct && totalVotes > 0 && (
                  <span className="inline-block px-2 py-0.5 rounded bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                    WINNING
                  </span>
                )}
              </div>
            )}

            {/* Playing indicator */}
            {currentSide === "right" && (
              <motion.div
                className="absolute inset-0 border-2 border-blue-500/70 pointer-events-none z-20"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
        </div>

        {/* ─── VOTE PERCENTAGES BAR ─── */}
        <div className="bg-black/90 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-black text-base">{challengerPct}%</span>
            <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Votes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Votes</span>
            <span className="text-blue-400 font-black text-base">{opponentPct}%</span>
          </div>
        </div>

        {/* ─── PROGRESS BAR ─── */}
        <div className="h-2.5 flex relative bg-neutral-800">
          <motion.div
            className="h-full bg-gradient-to-r from-red-700 to-red-500"
            animate={{ width: `${challengerPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/50 -translate-x-1/2 z-10" />
          <motion.div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 flex-1" />
        </div>

        {/* ─── PLAYBACK TIMER ─── */}
        {bothHaveMedia && (
          <div className="bg-black/90 px-3 py-1.5 flex items-center justify-center gap-2">
            <Clock className="w-3 h-3 text-white/50" />
            <span className="text-white/80 text-xs font-mono">
              {formatTime(playbackTime)} / {formatTime(totalDuration)}
            </span>
            {isActive && !isExpired && timeLeft && (
              <>
                <span className="text-white/30 mx-1">•</span>
                <span className="text-yellow-400/80 text-[10px] font-bold">⏱ {timeLeft} left</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── STATUS BADGES ─── */}
      <div className="bg-card px-4 py-2 flex items-center gap-2 border-t border-border/30">
        <Swords className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-xs font-bold text-foreground flex-1 truncate">{battle.media_type === "video" ? "🎬 Video" : "🎵 Audio"} Battle</span>
        {isExpired && isActive ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold flex items-center gap-1">
            <Trophy className="w-3 h-3" /> ENDED
          </span>
        ) : battle.status === "open" ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 font-bold">OPEN</span>
        ) : isPending ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500 font-bold">CHALLENGE SENT</span>
        ) : isActive ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-bold animate-pulse">🔴 LIVE</span>
        ) : null}
      </div>

      {/* Winner announcement */}
      {isExpired && winnerId && (
        <div className="bg-gradient-to-r from-yellow-500/10 via-yellow-500/20 to-yellow-500/10 px-4 py-2 text-center">
          <p className="text-sm font-bold text-foreground">
            🏆 {winnerId === battle.challenger_id ? challengerName : opponentName} wins with {winnerId === battle.challenger_id ? challengerPct : opponentPct}% of votes!
          </p>
        </div>
      )}
      {isExpired && totalVotes > 0 && !winnerId && (
        <div className="bg-muted/50 px-4 py-2 text-center">
          <p className="text-sm font-bold text-muted-foreground">It's a tie! 🤝</p>
        </div>
      )}

      {/* ─── ACCEPT CHALLENGE ─── */}
      {((isPending && user?.id === battle.opponent_id && !battle.opponent_media_url) || (isOpen && canAccept)) && (
        <div className="px-4 py-3 bg-orange-500/5 border-t border-border/30">
          {isPending && user?.id === battle.opponent_id && (
            <p className="text-xs text-orange-400 font-bold mb-2 text-center">🥊 You've been challenged!</p>
          )}
          {!showUpload ? (
            <button onClick={() => setShowUpload(true)} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg">
              <Upload className="w-3.5 h-3.5" /> Accept & Upload Your Entry
            </button>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Your track title" value={acceptTrackTitle} onChange={(e) => setAcceptTrackTitle(e.target.value)} className="text-xs h-9" />
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Upload {battle.media_type === "audio" ? "Song (max 45 min)" : "Video (max 45 min)"}</label>
                <input type="file" accept={battle.media_type === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
                  onChange={(e) => handleMediaFileChange(e.target.files?.[0] || null)}
                  className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-primary/10 file:text-primary" />
              </div>
              {battle.media_type === "audio" && (
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Cover Art (required)</label>
                  <input type="file" accept="image/*" onChange={(e) => setAcceptCoverFile(e.target.files?.[0] || null)}
                    className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-primary/10 file:text-primary" />
                </div>
              )}
              <button onClick={handleAcceptBattle} disabled={accepting || !acceptTrackTitle.trim() || !acceptMediaFile || (battle.media_type === "audio" && !acceptCoverFile)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 text-white text-xs font-bold disabled:opacity-50 shadow-lg">
                {accepting ? "Uploading..." : "🥊 Accept Challenge"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── COMMENTS ─── */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border/30 bg-card">
        <MessageCircle className="w-3.5 h-3.5" />
        {comments.length} Comments
        {totalVotes > 0 && <span className="ml-2 text-muted-foreground/60">•</span>}
        {totalVotes > 0 && <span className="text-muted-foreground/80">{totalVotes} votes</span>}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/30 bg-card">
            <div className="max-h-48 overflow-y-auto px-4 py-2 space-y-2">
              {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No comments yet. Be the first!</p>}
              {comments.map((c: any) => {
                const cp = profileMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0 overflow-hidden">
                      {cp?.avatar_url ? <img src={cp.avatar_url} alt="" className="w-full h-full object-cover" /> : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">{(cp?.display_name || "U")[0]}</div>
                      )}
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
            <div className="px-4 py-1.5 flex gap-1.5 overflow-x-auto scrollbar-hide border-t border-border/50">
              {EMOJIS.map((emoji) => (
                <button key={emoji} onClick={() => commentMutation.mutate(emoji)}
                  className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted text-sm flex-shrink-0">{emoji}</button>
              ))}
            </div>
            <div className="px-4 py-2 flex gap-2 border-t border-border/50">
              <Input placeholder="Drop a comment..." value={comment} onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) commentMutation.mutate(comment.trim()); }}
                className="text-xs h-8" />
              <button onClick={() => comment.trim() && commentMutation.mutate(comment.trim())} disabled={!comment.trim()}
                className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shrink-0 disabled:opacity-50">
                <Send className="w-3.5 h-3.5 text-primary-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden audio elements (for audio battles) */}
      {!isVideo && battle.challenger_media_url && <audio ref={audioLeftRef} src={battle.challenger_media_url} onEnded={handleLeftEnded} />}
      {!isVideo && battle.opponent_media_url && <audio ref={audioRightRef} src={battle.opponent_media_url} onEnded={handleRightEnded} />}
      {/* Video elements are inline above */}
    </motion.div>
  );
};

export default BattleCard;
