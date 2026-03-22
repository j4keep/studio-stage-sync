import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ArrowLeft, Crown, ThumbsUp, Clock } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { uploadToR2, getR2DownloadUrl } from "@/lib/r2-storage";

/* ─── helpers ─── */
const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/* ─── page ─── */
const MusicBattlePlayerPage = () => {
  const navigate = useNavigate();
  const { battleId } = useParams<{ battleId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  /* ── state ── */
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeArtist, setActiveArtist] = useState<"left" | "right">("left");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [acceptTrackTitle, setAcceptTrackTitle] = useState("");
  const [acceptMediaFile, setAcceptMediaFile] = useState<File | null>(null);
  const [acceptCoverFile, setAcceptCoverFile] = useState<File | null>(null);
  const [acceptSongFile, setAcceptSongFile] = useState<File | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [isBattleExpanded, setIsBattleExpanded] = useState(false);

  const audioLeftRef = useRef<HTMLMediaElement | null>(null);
  const audioRightRef = useRef<HTMLMediaElement | null>(null);
  const videoLeftRef = useRef<HTMLVideoElement | null>(null);
  const videoRightRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  const touchHandledRef = useRef(false);

  /* ── data ── */
  const { data: battle } = useQuery({
    queryKey: ["battle", battleId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .single();
      return data;
    },
    enabled: !!battleId,
  });

  const { data: profiles = {} } = useQuery({
    queryKey: ["battle-profiles", battle?.challenger_id, battle?.opponent_id],
    queryFn: async () => {
      const ids = [battle.challenger_id, battle.opponent_id].filter(Boolean);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!battle?.challenger_id,
  });

  const { data: votes = [] } = useQuery({
    queryKey: ["battle-votes", battleId],
    queryFn: async () => {
      const { data } = await supabase
        .from("battle_votes")
        .select("*")
        .eq("battle_id", battleId!);
      return data || [];
    },
    enabled: !!battleId,
  });

  const voteMutation = useMutation({
    mutationFn: async (side: "left" | "right") => {
      if (!user || !battle) return;
      const votedFor = side === "left" ? battle.challenger_id : battle.opponent_id;
      if (!votedFor) return;
      const existing = votes.find((v: any) => v.user_id === user.id);
      if (existing) {
        await supabase.from("battle_votes").update({ voted_for: votedFor }).eq("id", existing.id);
      } else {
        await supabase.from("battle_votes").insert({ battle_id: battle.id, user_id: user.id, voted_for: votedFor });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["battle-votes", battleId] }),
  });

  /* ── derived ── */
  const leftVotes = votes.filter((v: any) => v.voted_for === battle?.challenger_id).length;
  const rightVotes = votes.filter((v: any) => v.voted_for === battle?.opponent_id).length;
  const total = leftVotes + rightVotes;
  const leftPct = total > 0 ? Math.round((leftVotes / total) * 100) : 50;
  const rightPct = total > 0 ? 100 - leftPct : 50;
  const winner = total === 0 ? "tied" : leftPct > rightPct ? "left" : leftPct < rightPct ? "right" : "tied";

  const userVote = votes.find((v: any) => v.user_id === user?.id);
  const hasVotedLeft = userVote?.voted_for === battle?.challenger_id;
  const hasVotedRight = userVote?.voted_for === battle?.opponent_id;
  const isPending = battle?.status === "pending" && !!battle?.opponent_id;
  const canAccept = isPending && user?.id === battle?.opponent_id && !battle?.opponent_media_url;

  const leftProfile = profiles[battle?.challenger_id] || {};
  const rightProfile = profiles[battle?.opponent_id] || {};

  const refreshBattleViews = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["battle", battleId] });
    qc.invalidateQueries({ queryKey: ["battles"] });
    qc.invalidateQueries({ queryKey: ["feed-posts"] });
    qc.invalidateQueries({ queryKey: ["profile-posts"] });
  }, [battleId, qc]);

  /* countdown */
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!battle?.expires_at) return;
    const tick = () => {
      const diff = new Date(battle.expires_at).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("ENDED"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [battle?.expires_at]);

  /* ── audio control ── */
  const activeRef = activeArtist === "left" ? audioLeftRef : audioRightRef;
  const inactiveRef = activeArtist === "left" ? audioRightRef : audioLeftRef;

  const togglePlay = useCallback(() => {
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

  const switchSide = useCallback((side: "left" | "right") => {
    if (side === activeArtist && !isPlaying) {
      togglePlay();
      return;
    }
    if (side === activeArtist) return;
    const previous = side === "left" ? audioRightRef.current : audioLeftRef.current;
    previous?.pause();
    const next = side === "left" ? audioLeftRef.current : audioRightRef.current;
    if (next) {
      next.currentTime = 0;
      next.play().catch(() => {});
    }
    setActiveArtist(side);
    setIsPlaying(true);
    setCurrentTime(0);
  }, [activeArtist, isPlaying, togglePlay]);

  const handleArtistTap = useCallback((side: "left" | "right") => {
    const now = Date.now();
    const isDoubleTap = lastTapSideRef.current === side && now - lastTapRef.current < 350;

    lastTapRef.current = now;
    lastTapSideRef.current = side;

    if (isDoubleTap) {
      setIsBattleExpanded((prev) => !prev);
      return;
    }

    switchSide(side);
  }, [switchSide]);

  const handleArtistTouchEnd = useCallback((e: React.TouchEvent, side: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    touchHandledRef.current = true;
    handleArtistTap(side);
  }, [handleArtistTap]);

  const handleArtistClick = useCallback((e: React.MouseEvent, side: "left" | "right") => {
    e.stopPropagation();
    if (touchHandledRef.current) {
      touchHandledRef.current = false;
      return;
    }
    handleArtistTap(side);
  }, [handleArtistTap]);

  const handleAcceptBattle = useCallback(async () => {
    if (!user || !battle || !acceptTrackTitle.trim() || !acceptMediaFile) return;
    if (battle.media_type === "audio" && !acceptCoverFile) {
      toast.error("Audio battles need cover art");
      return;
    }

    const isPhotoBattle = battle.media_type === "photo";

    // Validate duration against battle limit (skip for photo battles)
    if (!isPhotoBattle) {
      const maxMin = (battle as any).max_duration_minutes || 40;
      if (maxMin > 0) {
        try {
          const fileDur = await new Promise<number>((resolve, reject) => {
            const url = URL.createObjectURL(acceptMediaFile);
            const el = acceptMediaFile.type.startsWith("video") ? document.createElement("video") : document.createElement("audio");
            el.preload = "metadata";
            el.onloadedmetadata = () => { resolve(Math.ceil(el.duration / 60)); URL.revokeObjectURL(url); };
            el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Cannot read")); };
            el.src = url;
          });
          if (fileDur > maxMin) {
            toast.error(`Your file is ~${fileDur} min but this battle has a ${maxMin} min limit. Please trim it.`);
            return;
          }
        } catch {
          // can't detect, allow
        }
      }
    }

    setAccepting(true);
    try {
      let mediaUrl = "";
      let coverUrl = "";

      if (isPhotoBattle) {
        // For photo battles, upload photo as cover
        const ext = acceptMediaFile.name.split(".").pop();
        const result = await uploadToR2(acceptMediaFile, {
          folder: `battles/photos/${user.id}`,
          fileName: `${Date.now()}.${ext}`,
          mimeType: acceptMediaFile.type,
        });
        if (result.success && result.data) {
          coverUrl = getR2DownloadUrl(result.data.key);
        } else {
          throw new Error(result.error || "Failed to upload photo");
        }
        // Optional song for photo battle
        if (acceptSongFile) {
          const songExt = acceptSongFile.name.split(".").pop();
          const songResult = await uploadToR2(acceptSongFile, {
            folder: `battles/${user.id}`,
            fileName: `${Date.now()}.${songExt}`,
            mimeType: acceptSongFile.type,
          });
          if (songResult.success && songResult.data) {
            mediaUrl = getR2DownloadUrl(songResult.data.key);
          }
        }
      } else {
        const mediaExt = acceptMediaFile.name.split(".").pop();
        const mediaResult = await uploadToR2(acceptMediaFile, {
          folder: `battles/${user.id}`,
          fileName: `${Date.now()}.${mediaExt}`,
          mimeType: acceptMediaFile.type,
          onProgress: (p) => console.log(`[Battle Accept] Media upload: ${p}%`),
        });
        if (mediaResult.success && mediaResult.data) {
          mediaUrl = getR2DownloadUrl(mediaResult.data.key);
        } else {
          throw new Error(mediaResult.error || "Failed to upload media");
        }

        if (acceptCoverFile) {
          const coverExt = acceptCoverFile.name.split(".").pop();
          const coverResult = await uploadToR2(acceptCoverFile, {
            folder: `battles/covers/${user.id}`,
            fileName: `${Date.now()}.${coverExt}`,
            mimeType: acceptCoverFile.type,
          });
          if (coverResult.success && coverResult.data) {
            coverUrl = getR2DownloadUrl(coverResult.data.key);
          } else {
            throw new Error(coverResult.error || "Failed to upload cover");
          }
        }
      }

      const { error } = await (supabase as any)
        .from("battles")
        .update({
          status: "active",
          opponent_title: acceptTrackTitle.trim(),
          opponent_media_url: mediaUrl || null,
          opponent_cover_url: coverUrl || null,
        })
        .eq("id", battle.id)
        .eq("opponent_id", user.id);

      if (error) throw error;

      setAcceptTrackTitle("");
      setAcceptMediaFile(null);
      setAcceptCoverFile(null);
      setAcceptSongFile(null);
      toast.success("Challenge accepted");
      refreshBattleViews();
    } catch (error: any) {
      toast.error(error?.message || "Failed to accept challenge");
    } finally {
      setAccepting(false);
    }
  }, [acceptCoverFile, acceptMediaFile, acceptTrackTitle, battle, refreshBattleViews, user]);

  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onDur = () => setDuration(el.duration || 0);
    const onEnd = () => {
      if (battle?.opponent_media_url && battle?.challenger_media_url) {
        const nextSide = activeArtist === "left" ? "right" : "left";
        setActiveArtist(nextSide);
        setCurrentTime(0);

        window.requestAnimationFrame(() => {
          const next = nextSide === "left" ? audioLeftRef.current : audioRightRef.current;
          if (!next) {
            setIsPlaying(false);
            return;
          }
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

  if (!battle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const ended = battle.status === "ended" || timeLeft === "ENDED";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* hidden media elements for audio battles */}
      {battle.media_type !== "video" && (
        <>
          <audio ref={audioLeftRef} src={battle.challenger_media_url || ""} preload="metadata" />
          <audio ref={audioRightRef} src={battle.opponent_media_url || ""} preload="metadata" />
        </>
      )}

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">Music Battle</h1>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{timeLeft || "24:00:00"}</span>
        </div>
      </div>

      {/* ── BATTLE TITLE ── */}
      <div className="text-center py-3 px-4">
        <p className="text-sm font-semibold text-foreground">{battle.title}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
          {battle.media_type === "video" ? "Video" : "Audio"} Battle • {ended ? "ENDED" : "LIVE"}
        </p>
      </div>

      {/* ── MAIN BATTLE AREA ── */}
      <div
        className={`flex-1 flex flex-col items-center justify-center relative transition-all duration-300 ${
          isBattleExpanded ? "fixed inset-0 z-50 bg-background px-4 py-6" : "px-4"
        }`}
      >

        {/* SPLIT SCREEN */}
        <div className={`w-full flex gap-2 relative transition-all duration-300 ${isBattleExpanded ? "min-h-[72vh]" : "min-h-[280px]"}`}>

          {/* LEFT ARTIST */}
          <button
            onTouchEnd={(e) => handleArtistTouchEnd(e, "left")}
            onClick={(e) => handleArtistClick(e, "left")}
            className="flex-1 rounded-2xl overflow-hidden relative transition-all duration-500"
            style={{ opacity: activeArtist === "right" ? 0.5 : 1 }}
          >
            {/* winning badge */}
            <AnimatePresence>
              {winner === "left" && total > 0 && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-yellow-500/90 text-black text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"
                >
                  <Crown className="w-3 h-3" /> WINNING
                </motion.div>
              )}
            </AnimatePresence>

            {/* active glow */}
            {activeArtist === "left" && isPlaying && (
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 z-10 rounded-2xl pointer-events-none"
                style={{ boxShadow: "inset 0 0 40px 6px hsl(var(--primary) / 0.5)" }}
              />
            )}

            {/* cover image */}
            <div className="w-full aspect-[3/4] bg-muted rounded-2xl overflow-hidden">
              {battle.media_type === "video" && battle.challenger_media_url ? (
                <video
                  ref={(el) => {
                    videoLeftRef.current = el;
                    audioLeftRef.current = el;
                  }}
                  src={battle.challenger_media_url}
                  preload="metadata"
                  playsInline
                  muted={false}
                  className="w-full h-full object-cover"
                />
              ) : battle.challenger_cover_url ? (
                <img src={battle.challenger_cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <span className="text-4xl">🎵</span>
                </div>
              )}
            </div>

            {/* info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 rounded-b-2xl">
              <p className="text-xs font-bold text-white truncate">{leftProfile.display_name || "Artist A"}</p>
              <p className="text-[10px] text-white/60 truncate">{battle.challenger_title || "Track"}</p>
            </div>
          </button>

          {/* CENTER PLAY BUTTON */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            {/* outer pulse rings */}
            <motion.div
              animate={isPlaying
                ? { scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }
                : { scale: [1, 1.3, 1], opacity: [0.15, 0, 0.15] }
              }
              transition={{ repeat: Infinity, duration: isPlaying ? 1 : 2.5 }}
              className="absolute inset-0 rounded-full border-2 border-primary"
            />
            <motion.div
              animate={isPlaying
                ? { scale: [1, 1.9, 1], opacity: [0.2, 0, 0.2] }
                : { scale: [1, 1.5, 1], opacity: [0.1, 0, 0.1] }
              }
              transition={{ repeat: Infinity, duration: isPlaying ? 1.4 : 3, delay: 0.2 }}
              className="absolute inset-0 rounded-full border border-primary"
            />

            {/* main button */}
            <motion.button
              onClick={togglePlay}
              whileTap={{ scale: 0.9 }}
              animate={isPlaying
                ? { boxShadow: ["0 0 20px 4px hsl(var(--primary) / 0.5)", "0 0 40px 10px hsl(var(--primary) / 0.7)", "0 0 20px 4px hsl(var(--primary) / 0.5)"] }
                : {}
              }
              transition={isPlaying ? { repeat: Infinity, duration: 1.5 } : {}}
              className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg relative"
            >
              <AnimatePresence mode="wait">
                {isPlaying ? (
                  <motion.div key="pause" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}>
                    <Pause className="w-7 h-7 text-primary-foreground" fill="currentColor" />
                  </motion.div>
                ) : (
                  <motion.div key="play" initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: -90 }} transition={{ duration: 0.2 }}>
                    <Play className="w-7 h-7 text-primary-foreground ml-0.5" fill="currentColor" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* RIGHT ARTIST */}
          <button
            onTouchEnd={(e) => handleArtistTouchEnd(e, "right")}
            onClick={(e) => handleArtistClick(e, "right")}
            className="flex-1 rounded-2xl overflow-hidden relative transition-all duration-500"
            style={{ opacity: activeArtist === "left" ? 0.5 : 1 }}
          >
            <AnimatePresence>
              {winner === "right" && total > 0 && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-yellow-500/90 text-black text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"
                >
                  <Crown className="w-3 h-3" /> WINNING
                </motion.div>
              )}
            </AnimatePresence>

            {activeArtist === "right" && isPlaying && (
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 z-10 rounded-2xl pointer-events-none"
                style={{ boxShadow: "inset 0 0 40px 6px hsl(var(--primary) / 0.5)" }}
              />
            )}

            <div className="w-full aspect-[3/4] bg-muted rounded-2xl overflow-hidden">
              {battle.media_type === "video" && battle.opponent_media_url ? (
                <video
                  ref={(el) => {
                    videoRightRef.current = el;
                    audioRightRef.current = el;
                  }}
                  src={battle.opponent_media_url}
                  preload="metadata"
                  playsInline
                  muted={false}
                  className="w-full h-full object-cover"
                />
              ) : battle.opponent_cover_url ? (
                <img src={battle.opponent_cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-destructive/30 to-destructive/10 flex items-center justify-center">
                  <span className="text-4xl">🎵</span>
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 rounded-b-2xl">
              <p className="text-xs font-bold text-white truncate">{rightProfile.display_name || "Artist B"}</p>
              <p className="text-[10px] text-white/60 truncate">{battle.opponent_title || "Waiting..."}</p>
            </div>
          </button>
        </div>

        {/* TIED badge */}
        <AnimatePresence>
          {winner === "tied" && total > 0 && (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="mt-2 bg-muted text-foreground text-[10px] font-black px-3 py-1 rounded-full"
            >
              ⚔️ TIED
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── AUDIO PLAYBACK BAR ── */}
      <div className="px-6 py-3">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <span>{fmt(currentTime)}</span>
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden relative">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
            {/* glow dot at tip */}
            {isPlaying && duration > 0 && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary"
                animate={{ left: `${(currentTime / duration) * 100}%`, boxShadow: ["0 0 6px 2px hsl(var(--primary) / 0.6)", "0 0 12px 4px hsl(var(--primary) / 0.9)", "0 0 6px 2px hsl(var(--primary) / 0.6)"] }}
                transition={{ boxShadow: { repeat: Infinity, duration: 1 }, left: { duration: 0.3 } }}
                style={{ marginLeft: -5 }}
              />
            )}
          </div>
          <span>{fmt(duration)}</span>
        </div>
        <p className="text-center text-[9px] text-muted-foreground mt-1">
          🎧 Now playing: {activeArtist === "left" ? (leftProfile.display_name || "Artist A") : (rightProfile.display_name || "Artist B")}
        </p>
      </div>

      {/* ── VOTE PROGRESS BAR ── */}
      <div className="px-6 pb-2">
        <div className="flex justify-between text-[10px] font-bold mb-1">
          <motion.span
            key={leftPct}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-primary"
          >
            {leftPct}%
          </motion.span>
          <span className="text-muted-foreground text-[9px]">VOTES</span>
          <motion.span
            key={rightPct}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-destructive"
          >
            {rightPct}%
          </motion.span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
          <motion.div
            className="h-full bg-primary rounded-l-full"
            animate={{ width: `${leftPct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
          <motion.div
            className="h-full bg-destructive rounded-r-full"
            animate={{ width: `${rightPct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
          <span>{leftVotes} vote{leftVotes !== 1 ? "s" : ""}</span>
          <span>{rightVotes} vote{rightVotes !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* ── VOTE BUTTONS ── */}
      <div className="px-6 pb-6 flex gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => !ended && voteMutation.mutate("left")}
          disabled={ended}
          className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            hasVotedLeft
              ? "bg-primary text-primary-foreground shadow-lg"
              : "bg-muted text-foreground hover:bg-primary/20"
          } ${ended ? "opacity-50" : ""}`}
        >
          <ThumbsUp className="w-4 h-4" />
          Vote {leftProfile.display_name?.split(" ")[0] || "A"}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => !ended && voteMutation.mutate("right")}
          disabled={ended}
          className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            hasVotedRight
              ? "bg-destructive text-destructive-foreground shadow-lg"
              : "bg-muted text-foreground hover:bg-destructive/20"
          } ${ended ? "opacity-50" : ""}`}
        >
          <ThumbsUp className="w-4 h-4" />
          Vote {rightProfile.display_name?.split(" ")[0] || "B"}
        </motion.button>
      </div>

      {canAccept && (
        <div className="px-6 pb-8">
          <div className="rounded-3xl border border-border bg-card/70 p-4 backdrop-blur-sm">
            <p className="mb-3 text-center text-sm font-semibold text-primary">🥊 You&apos;ve been challenged!</p>
            <div className="space-y-3">
              <Input
                placeholder={battle.media_type === "photo" ? "Your caption" : "Your track title"}
                value={acceptTrackTitle}
                onChange={(event) => setAcceptTrackTitle(event.target.value)}
                className="h-11"
              />
              {battle.media_type === "photo" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Upload your photo</label>
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp"
                      onChange={(event) => {
                        const f = event.target.files?.[0] || null;
                        setAcceptMediaFile(f);
                        setAcceptCoverFile(f);
                      }}
                      className="w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:font-semibold file:text-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">🎵 Add a song (optional)</label>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.flac,.m4a"
                      onChange={(event) => setAcceptSongFile(event.target.files?.[0] || null)}
                      className="w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:font-semibold file:text-primary"
                    />
                    {acceptSongFile && (
                      <p className="mt-1 text-[10px] text-muted-foreground">🎵 {acceptSongFile.name}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Upload {battle.media_type === "audio" ? "song" : "video"} (max {(battle as any).max_duration_minutes || 40} min)
                    </label>
                    <input
                      type="file"
                      accept={battle.media_type === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
                      onChange={(event) => setAcceptMediaFile(event.target.files?.[0] || null)}
                      className="w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:font-semibold file:text-primary"
                    />
                  </div>
                  {battle.media_type === "audio" && (
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Upload cover art</label>
                      <input
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp"
                        onChange={(event) => setAcceptCoverFile(event.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:font-semibold file:text-primary"
                      />
                    </div>
                  )}
                </>
              )}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleAcceptBattle}
                disabled={accepting || !acceptTrackTitle.trim() || !acceptMediaFile || (battle.media_type === "audio" && !acceptCoverFile)}
                className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {accepting ? "Uploading..." : "Accept Challenge"}
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicBattlePlayerPage;
