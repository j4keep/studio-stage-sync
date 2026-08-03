import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ArrowLeft, Crown, ThumbsUp, Clock, Mic, Flame, Check } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { uploadToR2, getR2DownloadUrl } from "@/lib/r2-storage";
import BattleEffectsOverlay from "@/components/BattleEffectsOverlay";
import BattleLiveComments from "@/components/BattleLiveComments";
import VoiceoverRecorder from "@/components/VoiceoverRecorder";
import AudioEqualizerBackground from "@/components/AudioEqualizerBackground";
import { incrementBattleViews } from "@/hooks/use-likes";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
import BattleCategoryChip from "@/components/battle/BattleCategoryChip";
import BattleNeonVoteBar from "@/components/battle/BattleNeonVoteBar";
import BattleCrowdReaction from "@/components/battle/BattleCrowdReaction";
import BattleWinnerCelebration from "@/components/battle/BattleWinnerCelebration";
import BattleVsMark from "@/components/battle/BattleVsMark";
import BattleLiveStage from "@/components/battle/BattleLiveStage";
import { PhotoBattleSongTrimSheet } from "@/components/battle/PhotoBattleSongTrimSheet";
import { PHOTO_BATTLE_SONG_MAX_SEC } from "@/lib/photo-battle-song";
import { preparePhotoBattleSong } from "@/lib/prepare-photo-battle-song";
import {
  buildLiveBattleBackground,
  getBattleScheduledStartAt,
  liveScheduleFromAccept,
} from "@/lib/battle-live";
import {
  computeVoteMomentum,
  firstName,
  formatClockMmSs,
  formatCompact,
  formatCountdown,
  getBattleExpiresAt,
  getBattleUiStatus,
  isBattleVotingOpen,
  tallyBattleVotes,
} from "@/lib/battle-ui";

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
  const activeArtistRef = useRef<"left" | "right">("left");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [acceptTrackTitle, setAcceptTrackTitle] = useState("");
  const [acceptMediaFile, setAcceptMediaFile] = useState<File | null>(null);
  const [acceptCoverFile, setAcceptCoverFile] = useState<File | null>(null);
  const [acceptSongFile, setAcceptSongFile] = useState<File | null>(null);
  const [acceptSongChecking, setAcceptSongChecking] = useState(false);
  const [acceptSongTrim, setAcceptSongTrim] = useState<{ file: File; durationSec: number } | null>(null);
  const acceptSongInputRef = useRef<HTMLInputElement | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [showAcceptVoiceover, setShowAcceptVoiceover] = useState(false);
  const [hasAcceptVoiceover, setHasAcceptVoiceover] = useState(false);
  const [expandedSide, setExpandedSide] = useState<"left" | "right" | null>(null);

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
    refetchInterval: (q) => {
      const b = q.state.data as { media_type?: string; status?: string } | undefined;
      if ((b?.media_type || "").toLowerCase() === "live" && b?.status !== "ended") return 2000;
      return false;
    },
  });

  // Live battles: pick up accept / schedule changes quickly for the other competitor.
  useEffect(() => {
    if (!battleId) return;
    const channel = supabase
      .channel(`battle-live-${battleId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${battleId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["battle", battleId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [battleId, qc]);

  // Track battle view once
  useEffect(() => {
    if (battleId) incrementBattleViews(battleId);
  }, [battleId]);

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

  const expiresMs = battle?.expires_at
    ? new Date(battle.expires_at).getTime() - Date.now()
    : null;
  const finalMinuteLive =
    !!battle &&
    battle.status === "active" &&
    expiresMs != null &&
    expiresMs > 0 &&
    expiresMs <= 60_000;

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
    refetchInterval: finalMinuteLive ? 2500 : 8000,
  });

  const isParticipant = user?.id === battle?.challenger_id || user?.id === battle?.opponent_id;

  const voteMutation = useMutation({
    mutationFn: async (side: "left" | "right") => {
      if (!user || !battle) return;
      const votedFor = side === "left" ? battle.challenger_id : battle.opponent_id;
      if (!votedFor) return;
      // Participants can vote for the other side only — never themselves.
      if (user.id === votedFor) {
        toast.error("You can't vote for yourself");
        return;
      }
      if (!isBattleVotingOpen(battle)) {
        toast.error("Voting closed — time expired");
        return;
      }
      const existing = votes.find((v: any) => v.user_id === user.id);
      if (existing) {
        await supabase.from("battle_votes").update({ voted_for: votedFor }).eq("id", existing.id);
      } else {
        await supabase.from("battle_votes").insert({ battle_id: battle.id, user_id: user.id, voted_for: votedFor });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["battle-votes", battleId] }),
  });

  /* ── derived (participants may cast cross-votes; self-votes never count) ── */
  const participantIds = [battle?.challenger_id, battle?.opponent_id].filter(Boolean);
  const voteTally = tallyBattleVotes(votes as any[], battle?.challenger_id, battle?.opponent_id);
  const audienceVotes = voteTally.countable;
  const leftVotes = voteTally.leftVotes;
  const rightVotes = voteTally.rightVotes;
  const total = voteTally.total;
  const leftPct = voteTally.leftPct;
  const rightPct = voteTally.rightPct;
  const winner = voteTally.winner === null ? "tied" : voteTally.winner;

  const userVote = votes.find((v: any) => v.user_id === user?.id);
  const hasVotedLeft = userVote?.voted_for === battle?.challenger_id;
  const hasVotedRight = userVote?.voted_for === battle?.opponent_id;
  const canVoteLeft = !!user?.id && user.id !== battle?.challenger_id;
  const canVoteRight = !!user?.id && !!battle?.opponent_id && user.id !== battle?.opponent_id;
  const isPending = battle?.status === "pending" && !!battle?.opponent_id;
  const isLiveBattle = (battle?.media_type || "").toLowerCase() === "live";
  const canAccept =
    isPending &&
    user?.id === battle?.opponent_id &&
    (isLiveBattle
      ? !battle?.opponent_cover_url
      : !battle?.opponent_media_url);

  const leftProfile = profiles[battle?.challenger_id] || {};
  const rightProfile = profiles[battle?.opponent_id] || {};

  const refreshBattleViews = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["battle", battleId] });
    qc.invalidateQueries({ queryKey: ["battles"] });
    qc.invalidateQueries({ queryKey: ["feed-posts"] });
    qc.invalidateQueries({ queryKey: ["profile-posts"] });
  }, [battleId, qc]);

  /* countdown — voting window (24h), not live debate length */
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!battle) return;
    const tick = () => {
      const endAt = getBattleExpiresAt(battle);
      const diff = endAt.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("ENDED"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [battle]);

  // Keep ref in sync with state
  useEffect(() => { activeArtistRef.current = activeArtist; }, [activeArtist]);

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
      setExpandedSide((prev) => prev === side ? null : side);
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

  const handleAcceptPhotoSongChange = async (file: File | null) => {
    if (!file) {
      setAcceptSongFile(null);
      setAcceptSongTrim(null);
      return;
    }
    setAcceptSongChecking(true);
    try {
      const result = await preparePhotoBattleSong(file);
      if (result.kind === "needs_trim") {
        setAcceptSongFile(null);
        setAcceptSongTrim({ file: result.file, durationSec: result.durationSec });
        toast.message("Trim your song to 30s", {
          description: "Photo battles only play a short clip under your photo.",
        });
        return;
      }
      setAcceptSongTrim(null);
      setAcceptSongFile(result.file);
    } catch (err) {
      setAcceptSongFile(null);
      setAcceptSongTrim(null);
      toast.error(err instanceof Error ? err.message : "Couldn't read song");
      if (acceptSongInputRef.current) acceptSongInputRef.current.value = "";
    } finally {
      setAcceptSongChecking(false);
    }
  };

  const handleAcceptBattle = useCallback(async () => {
    if (!user || !battle || !acceptTrackTitle.trim()) return;
    const isPhotoBattle = battle.media_type === "photo";
    const isLive = battle.media_type === "live";

    if (isLive) {
      if (!acceptCoverFile) {
        toast.error("Live debates need a cover picture");
        return;
      }
    } else if (!acceptMediaFile) {
      return;
    }

    if (battle.media_type === "audio" && !acceptCoverFile) {
      toast.error("Audio battles need cover art");
      return;
    }
    if (acceptSongTrim || acceptSongChecking) {
      toast.error("Finish trimming your 30s song clip first");
      return;
    }

    // Validate duration against battle limit (skip for photo/live battles)
    if (!isPhotoBattle && !isLive && acceptMediaFile) {
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

      if (isLive && acceptCoverFile) {
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
      } else if (isPhotoBattle && acceptMediaFile) {
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
      } else if (acceptMediaFile) {
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

      const livePatch =
        isLive
          ? (() => {
              const durationMin = Number((battle as any).max_duration_minutes) || 10;
              const {
                scheduledStartAt,
                debateEndsAt,
                voteExpiresAt,
                durationMin: mins,
              } = liveScheduleFromAccept(durationMin);
              return {
                // Column expires_at = 24h voting window (same as audio/photo/video).
                expires_at: voteExpiresAt,
                battle_background: buildLiveBattleBackground(
                  {
                    scheduled_start_at: scheduledStartAt,
                    debate_ends_at: debateEndsAt,
                    duration_min: mins,
                  },
                  (battle as any).battle_background,
                ),
              };
            })()
          : {};

      const { error } = await (supabase as any)
        .from("battles")
        .update({
          status: "active",
          opponent_title: acceptTrackTitle.trim(),
          opponent_media_url: mediaUrl || null,
          opponent_cover_url: coverUrl || null,
          ...livePatch,
        })
        .eq("id", battle.id)
        .eq("opponent_id", user.id);

      if (error) throw error;

      setAcceptTrackTitle("");
      setAcceptMediaFile(null);
      setAcceptCoverFile(null);
      setAcceptSongFile(null);
      refreshBattleViews();
      if (isLive) {
        toast.success("Challenge accepted — 30s to check your camera");
        // Stay on the battle page so both competitors can preview cameras before go-live.
      } else {
        toast.success("Battle is live — landing on the feed");
        // Launched battles auto-post to the homepage Posts feed for the crowd to vote.
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to accept challenge");
    } finally {
      setAccepting(false);
    }
  }, [
    acceptCoverFile,
    acceptMediaFile,
    acceptSongChecking,
    acceptSongFile,
    acceptSongTrim,
    acceptTrackTitle,
    battle,
    navigate,
    refreshBattleViews,
    user,
  ]);

  // Fix webm Infinity duration by seeking to end trick
  const resolveWebmDuration = useCallback((el: HTMLMediaElement) => {
    if (el.duration && isFinite(el.duration)) return;
    const onSeeked = () => {
      el.removeEventListener("seeked", onSeeked);
      if (el.duration && isFinite(el.duration)) {
        setDuration(el.duration);
      }
      el.currentTime = 0;
    };
    el.addEventListener("seeked", onSeeked);
    el.currentTime = 1e10; // seek to a huge time to force duration calculation
  }, []);

  useEffect(() => {
    const el = activeArtist === "left" ? audioLeftRef.current : audioRightRef.current;
    if (!el) return;

    let frameId: number | null = null;
    let destroyed = false;

    const getDur = () => {
      if (el.duration && isFinite(el.duration)) return el.duration;
      return 0;
    };

    const syncFromElement = () => {
      if (destroyed) return;
      const d = getDur();
      setCurrentTime(el.currentTime || 0);
      if (d > 0) setDuration(d);
    };

    const startSyncLoop = () => {
      if (frameId !== null || destroyed) return;
      const tick = () => {
        if (destroyed) return;
        syncFromElement();
        if (!el.paused && !el.ended) {
          frameId = window.requestAnimationFrame(tick);
        } else {
          frameId = null;
        }
      };
      frameId = window.requestAnimationFrame(tick);
    };

    const stopSyncLoop = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    // Read initial values
    syncFromElement();

    // If duration is still Infinity (webm), try the seek trick
    if (!el.duration || !isFinite(el.duration)) {
      if (el.readyState >= 1) {
        resolveWebmDuration(el);
      }
    }

    const onPlay = () => startSyncLoop();
    const onPause = () => {
      syncFromElement();
      stopSyncLoop();
    };
    const onTime = () => syncFromElement();
    const onDur = () => {
      const d = getDur();
      if (d > 0) setDuration(d);
      else if (el.readyState >= 1) resolveWebmDuration(el);
    };
    const onEnd = () => {
      stopSyncLoop();
      if (battle?.opponent_media_url && battle?.challenger_media_url) {
        const nextSide = activeArtistRef.current === "left" ? "right" : "left";
        setActiveArtist(nextSide);
        setCurrentTime(0);

        setTimeout(() => {
          const next = nextSide === "left" ? audioLeftRef.current : audioRightRef.current;
          if (!next) {
            setIsPlaying(false);
            return;
          }
          next.currentTime = 0;
          next.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }, 50);
        return;
      }

      setIsPlaying(false);
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onDur);
    el.addEventListener("durationchange", onDur);
    el.addEventListener("ended", onEnd);

    if (!el.paused) startSyncLoop();

    return () => {
      destroyed = true;
      stopSyncLoop();
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onDur);
      el.removeEventListener("durationchange", onDur);
      el.removeEventListener("ended", onEnd);
    };
  }, [activeArtist, battle?.challenger_media_url, battle?.opponent_media_url, resolveWebmDuration]);

  if (!battle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const uiStatus = getBattleUiStatus(battle);
  const msLeft = getBattleExpiresAt(battle).getTime() - Date.now();
  const ended =
    uiStatus === "ended" ||
    battle.status === "ended" ||
    battle.status === "expired" ||
    (!isLiveBattle && battle.status === "completed") ||
    timeLeft === "ENDED";
  const finalMinute = !ended && msLeft > 0 && msLeft <= 60_000 && battle.status === "active";
  const leftName = leftProfile.display_name || "Artist A";
  const rightName = rightProfile.display_name || "Artist B";
  const showWinnerCard = ended && total > 0;
  const momentum = computeVoteMomentum(
    audienceVotes,
    battle.challenger_id,
    battle.opponent_id,
    participantIds as string[],
  );

    return (
    <div
      className={`relative flex min-h-screen flex-col overflow-hidden bg-background ${
        finalMinute ? "battle-final-minute" : ""
      }`}
    >
      {/* ── EQUALIZER BACKGROUND ── */}
      <AudioEqualizerBackground
        mediaElement={activeArtist === "left" ? (audioLeftRef.current || videoLeftRef.current) : (audioRightRef.current || videoRightRef.current)}
        isPlaying={isPlaying}
      />
      {/* hidden media elements for audio battles — only load when active */}
      {battle.media_type !== "video" && battle.media_type !== "live" && battle.status === "active" && (
        <>
          <audio ref={audioLeftRef} src={battle.challenger_media_url || ""} preload="metadata" />
          <audio ref={audioRightRef} src={battle.opponent_media_url || ""} preload="metadata" />
        </>
      )}

      {/* ── EVENT SCOREBOARD ── */}
      <div className={`border-b px-4 pb-3 pt-3 ${finalMinute ? "border-rose-500/40 bg-rose-950/20" : "border-border/80 bg-background/80"}`}>
        <div className="mb-2.5 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <BattleCategoryChip mediaType={battle.media_type} className="bg-muted text-foreground ring-border" />
              <BattleStatusBadge status={finalMinute ? "ending" : uiStatus} />
            </div>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-black ${
            finalMinute ? "bg-rose-500 text-white" : uiStatus === "countdown" ? "bg-amber-500 text-white" : "bg-muted text-foreground"
          }`}>
            <Clock className="h-3.5 w-3.5" />
            {uiStatus === "countdown" && getBattleScheduledStartAt(battle)
              ? formatCountdown(new Date(getBattleScheduledStartAt(battle)!).getTime() - Date.now())
              : finalMinute
                ? formatClockMmSs(msLeft)
                : (timeLeft || formatCountdown(msLeft))}
          </div>
        </div>

        <h1 className="text-xl font-black tracking-tight text-foreground">{battle.title}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-muted-foreground">
          <span className="text-foreground">{formatCompact(total)} votes</span>
          <span>👁 {formatCompact(battle.views || 0)}</span>
          <span>❤️ {formatCompact(battle.likes_count || 0)}</span>
          {!ended && msLeft > 0 ? <span>{formatCountdown(msLeft)} remaining</span> : null}
        </div>
      </div>

      {finalMinute ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3 overflow-hidden rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-3 text-center text-white shadow-[0_0_30px_rgba(244,63,94,0.45)]"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.2em]">🔥 Final Minute</p>
          <p className="mt-0.5 font-mono text-2xl font-black tabular-nums">{formatClockMmSs(msLeft)}</p>
          <p className="text-[11px] font-semibold text-white/85">Voting closes soon — momentum updates faster</p>
        </motion.div>
      ) : null}

      {showWinnerCard ? (
        <div className="px-4 pb-2 pt-3">
          <BattleWinnerCelebration
            winnerName={winner === "right" ? rightName : leftName}
            winnerPct={winner === "right" ? rightPct : leftPct}
            loserName={winner === "right" ? leftName : rightName}
            loserPct={winner === "right" ? leftPct : rightPct}
            totalVotes={total}
            tied={winner === "tied"}
          />
        </div>
      ) : null}

      {/* ── MAIN BATTLE AREA ── */}
      {isLiveBattle ? (
        <div
          className={`relative flex flex-1 flex-col px-3 pt-3 ${
            expandedSide ? "fixed inset-0 z-50 bg-background px-4 py-6" : ""
          }`}
        >
          <BattleLiveStage
            battle={battle}
            leftName={leftName}
            rightName={rightName}
            surface="battle"
            compact
            expandedSide={expandedSide}
            onExpandSide={(side) =>
              setExpandedSide((prev) => (prev === side ? null : side))
            }
          />
        </div>
      ) : (
      <div
        className={`relative flex flex-1 flex-col items-center justify-center transition-all duration-300 ${
          expandedSide ? "fixed inset-0 z-50 bg-background px-4 py-6" : "px-3 pt-3"
        }`}
      >
        {!expandedSide ? (
          <div className="mb-2 flex w-full items-center justify-between px-1">
            <p className="truncate text-sm font-black tracking-tight text-[#2563eb]">{firstName(leftName).toUpperCase()}</p>
            <p className="truncate text-right text-sm font-black tracking-tight text-[#e11d48]">{firstName(rightName).toUpperCase()}</p>
          </div>
        ) : null}

        {/* SPLIT SCREEN — collectible cards with VS in the middle */}
        <div className={`relative flex w-full items-center gap-1.5 transition-all duration-300 ${expandedSide ? "min-h-[85vh]" : "min-h-[300px]"}`}>

          {/* LEFT ARTIST */}
          <div
            className={`relative overflow-hidden rounded-[1.35rem] transition-all duration-500 ${
              expandedSide === "left" ? "flex-[3]" : expandedSide === "right" ? "hidden" : "flex-1"
            } ${
              winner === "left" && total > 0 && !ended
                ? "shadow-[0_0_28px_rgba(37,99,235,0.45)] ring-2 ring-[#2563eb]/70"
                : "shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
            }`}
            style={{ opacity: !expandedSide && activeArtist === "right" ? 0.72 : 1 }}
          >
            <AnimatePresence>
              {winner === "left" && total > 0 && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-30 rounded-full bg-secondary/90 px-2 py-0.5 text-[9px] font-black text-foreground shadow-lg flex items-center gap-1"
                >
                  <Crown className="w-3 h-3 text-primary" /> WINNING
                </motion.div>
              )}
            </AnimatePresence>

            {activeArtist === "left" && isPlaying && (
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 z-10 rounded-2xl pointer-events-none"
                style={{ boxShadow: "inset 0 0 40px 6px hsl(var(--primary) / 0.5)" }}
              />
            )}

            <div className={`w-full bg-muted rounded-2xl overflow-hidden ${expandedSide === "left" ? "h-[85vh]" : "aspect-[3/4]"}`}>
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
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : battle.challenger_cover_url ? (
                <img src={battle.challenger_cover_url} alt="" className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center pointer-events-none">
                  <span className="text-4xl">🎵</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onTouchEnd={(e) => handleArtistTouchEnd(e, "left")}
              onClick={(e) => handleArtistClick(e, "left")}
              className={`absolute inset-0 rounded-2xl ${expandedSide === "left" ? "z-10 bottom-28" : "z-20"}`}
              aria-label="Left artist panel"
            />

            {/* AI Effects Overlay for left */}
            {battleId && <BattleEffectsOverlay battleId={battleId} side="left" isExpanded={expandedSide === "left"} />}
            {battleId && <BattleLiveComments battleId={battleId} isExpanded={expandedSide === "left"} />}

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 rounded-b-2xl bg-gradient-to-t from-black/85 to-transparent p-3">
              <p className="truncate text-sm font-black text-white">{leftProfile.display_name || "Artist A"}</p>
              <p className="truncate text-[10px] text-white/60">{battle.challenger_title || "Track"}</p>
            </div>
          </div>

          {/* VS between the two competitor screens */}
          {!expandedSide ? (
            <div className="relative z-30 flex shrink-0 items-center justify-center px-0.5">
              <BattleVsMark size="sm" finalMinute={finalMinute} />
            </div>
          ) : null}

          {/* CENTER PLAY BUTTON — available while media can still be watched */}
          {!expandedSide && (battle.status === "active" || ended) && battle.media_type !== "live" && (
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-40">
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
          )}

          {/* LOCKED overlay when battle not active */}
          {!expandedSide && battle.status !== "active" && battle.status !== "ended" && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
              <div className="px-4 py-2 rounded-full bg-muted/80 backdrop-blur-sm border border-border">
                <span className="text-xs font-bold text-muted-foreground">🔒 Waiting for opponent to accept</span>
              </div>
            </div>
          )}

          {/* RIGHT ARTIST */}
          <div
            className={`relative overflow-hidden rounded-[1.35rem] transition-all duration-500 ${
              expandedSide === "right" ? "flex-[3]" : expandedSide === "left" ? "hidden" : "flex-1"
            } ${
              winner === "right" && total > 0 && !ended
                ? "shadow-[0_0_28px_rgba(225,29,72,0.45)] ring-2 ring-[#e11d48]/70"
                : "shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
            }`}
            style={{ opacity: !expandedSide && activeArtist === "left" ? 0.72 : 1 }}
          >
            <AnimatePresence>
              {winner === "right" && total > 0 && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-30 rounded-full bg-secondary/90 px-2 py-0.5 text-[9px] font-black text-foreground shadow-lg flex items-center gap-1"
                >
                  <Crown className="w-3 h-3 text-primary" /> WINNING
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

            <div className={`w-full bg-muted rounded-2xl overflow-hidden ${expandedSide === "right" ? "h-[85vh]" : "aspect-[3/4]"}`}>
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
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : battle.opponent_cover_url ? (
                <img src={battle.opponent_cover_url} alt="" className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-destructive/30 to-destructive/10 flex items-center justify-center pointer-events-none">
                  <span className="text-4xl">🎵</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onTouchEnd={(e) => handleArtistTouchEnd(e, "right")}
              onClick={(e) => handleArtistClick(e, "right")}
              className={`absolute inset-0 rounded-2xl ${expandedSide === "right" ? "z-10 bottom-28" : "z-20"}`}
              aria-label="Right artist panel"
            />

            {/* AI Effects Overlay for right */}
            {battleId && <BattleEffectsOverlay battleId={battleId} side="right" isExpanded={expandedSide === "right"} />}
            {battleId && <BattleLiveComments battleId={battleId} isExpanded={expandedSide === "right"} />}

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 rounded-b-2xl bg-gradient-to-t from-black/85 to-transparent p-3">
              <p className="truncate text-sm font-black text-white">{rightProfile.display_name || "Artist B"}</p>
              <p className="truncate text-[10px] text-white/60">{battle.opponent_title || "Waiting..."}</p>
            </div>
          </div>
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
      )}

      {/* ── AUDIO PLAYBACK BAR (SEEKABLE) — only when active (not live debates) ── */}
      {battle.status === "active" && !isLiveBattle && (
      <div className="px-6 py-3" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <span>{fmt(currentTime)}</span>
          <Slider
            value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
            onValueChange={(val) => {
              const side = activeArtistRef.current;
              const el = side === "left" ? (audioLeftRef.current || videoLeftRef.current) : (audioRightRef.current || videoRightRef.current);
              if (el && duration > 0) {
                el.currentTime = (val[0] / 100) * duration;
                setCurrentTime(el.currentTime);
              }
            }}
            max={100}
            step={0.1}
            className="flex-1 seek-area"
            role="slider"
          />
          <span>{fmt(duration)}</span>
        </div>
        <p className="text-center text-[9px] text-muted-foreground mt-1">
          🎧 Now playing: {activeArtist === "left" ? (leftProfile.display_name || "Artist A") : (rightProfile.display_name || "Artist B")}
        </p>
      </div>
      )}

      {/* ── NEON VOTE BAR (tap a side — YAJ slides toward the leader) ── */}
      <div className="px-4 pb-3 pt-1">
        {battle.status !== "active" && !ended ? (
          <div className="rounded-2xl bg-muted py-3.5 text-center text-sm font-bold text-muted-foreground opacity-70">
            Voting opens when both artists join
          </div>
        ) : (
          <BattleNeonVoteBar
            leftPct={leftPct}
            leftInitial={leftName}
            rightInitial={rightName}
            size="md"
            interactive={isBattleVotingOpen(battle)}
            disabledLeft={!canVoteLeft || !isBattleVotingOpen(battle)}
            disabledRight={!canVoteRight || !isBattleVotingOpen(battle)}
            onVoteLeft={() => voteMutation.mutate("left")}
            onVoteRight={() => voteMutation.mutate("right")}
          />
        )}
      </div>

      {battleId && (uiStatus === "live" || uiStatus === "ending" || uiStatus === "ended") ? (
        <div className="px-4 pb-6">
          <BattleCrowdReaction battleId={battleId} enabled />
        </div>
      ) : (
        <div className="pb-6" />
      )}

      <style>{`
        .battle-final-minute {
          box-shadow: inset 0 0 0 2px rgba(244, 63, 94, 0.55);
          animation: battle-final-pulse 1s ease-in-out infinite;
        }
        @keyframes battle-final-pulse {
          0%, 100% { box-shadow: inset 0 0 0 2px rgba(244, 63, 94, 0.35); }
          50% { box-shadow: inset 0 0 0 3px rgba(244, 63, 94, 0.85), 0 0 40px rgba(244, 63, 94, 0.25); }
        }
      `}</style>

      {canAccept && (
        <div className="px-6 pb-8">
          <div className="rounded-3xl border border-border bg-card/70 p-4 backdrop-blur-sm">
            <p className="mb-3 text-center text-sm font-semibold text-primary">🥊 You&apos;ve been challenged!</p>
            <div className="space-y-3">
              <Input
                placeholder={
                  battle.media_type === "photo"
                    ? "Your caption"
                    : battle.media_type === "live"
                      ? "Your debate topic / stance"
                      : "Your track title"
                }
                value={acceptTrackTitle}
                onChange={(event) => setAcceptTrackTitle(event.target.value)}
                className="h-11"
              />
              {battle.media_type === "live" ? (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Upload cover picture (required)
                  </label>
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp"
                    onChange={(event) => setAcceptCoverFile(event.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:font-semibold file:text-primary"
                  />
                  {acceptCoverFile && (
                    <p className="mt-1 text-[10px] text-primary">🖼️ {acceptCoverFile.name}</p>
                  )}
                  {getBattleScheduledStartAt(battle) && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Goes live {new Date(getBattleScheduledStartAt(battle)!).toLocaleString()} · ends{" "}
                      {battle.expires_at ? new Date(battle.expires_at).toLocaleString() : "on schedule"}
                    </p>
                  )}
                </div>
              ) : battle.media_type === "photo" ? (
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
                    <label className="mb-1 block text-xs text-muted-foreground">
                      🎵 Add a {PHOTO_BATTLE_SONG_MAX_SEC}s song clip (optional)
                    </label>
                    <input
                      ref={acceptSongInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.flac,.m4a"
                      onChange={(event) => void handleAcceptPhotoSongChange(event.target.files?.[0] || null)}
                      className="w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:font-semibold file:text-primary"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Longer tracks open a trimmer so you pick a {PHOTO_BATTLE_SONG_MAX_SEC}s section.
                    </p>
                    {acceptSongChecking && (
                      <p className="mt-1 text-[10px] text-muted-foreground">Checking song length…</p>
                    )}
                    {acceptSongFile && (
                      <p className="mt-1 text-[10px] text-primary">🎵 {acceptSongFile.name} · clip ready</p>
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

                  {/* Voiceover option for opponent */}
                  {acceptMediaFile && !showAcceptVoiceover && (
                    <button
                      onClick={() => setShowAcceptVoiceover(true)}
                      className="w-full py-2 rounded-lg border border-dashed border-primary/40 text-xs font-bold text-primary flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-colors"
                    >
                      <Mic className="w-3.5 h-3.5" /> {hasAcceptVoiceover ? "Re-record Voiceover ✓" : "Add Voiceover 🎙️"}
                    </button>
                  )}

                  {acceptMediaFile && showAcceptVoiceover && (
                    <VoiceoverRecorder
                      mediaFile={acceptMediaFile}
                      mediaType={battle.media_type as "audio" | "video"}
                      onMixedFile={(mixed) => {
                        setAcceptMediaFile(mixed);
                        setHasAcceptVoiceover(true);
                        setShowAcceptVoiceover(false);
                        toast.success("Voiceover applied! 🎙️");
                      }}
                      onCancel={() => setShowAcceptVoiceover(false)}
                    />
                  )}

                  {(battle.media_type === "audio" || battle.media_type === "video") && (
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Upload cover picture{battle.media_type === "audio" ? " (required)" : " (optional)"}
                      </label>
                      <input
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp"
                        onChange={(event) => setAcceptCoverFile(event.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:font-semibold file:text-primary"
                      />
                      {acceptCoverFile && (
                        <p className="mt-1 text-[10px] text-primary">🖼️ {acceptCoverFile.name}</p>
                      )}
                    </div>
                  )}
                </>
              )}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleAcceptBattle}
                disabled={
                  accepting ||
                  acceptSongChecking ||
                  !!acceptSongTrim ||
                  !acceptTrackTitle.trim() ||
                  (battle.media_type === "live"
                    ? !acceptCoverFile
                    : !acceptMediaFile || (battle.media_type === "audio" && !acceptCoverFile))
                }
                className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {accepting ? "Uploading..." : "Accept Challenge"}
              </motion.button>
            </div>
          </div>
        </div>
      )}

      <PhotoBattleSongTrimSheet
        open={!!acceptSongTrim}
        file={acceptSongTrim?.file ?? null}
        durationSec={acceptSongTrim?.durationSec ?? 0}
        onOpenChange={(next) => {
          if (!next) {
            setAcceptSongTrim(null);
            if (!acceptSongFile && acceptSongInputRef.current) {
              acceptSongInputRef.current.value = "";
            }
          }
        }}
        onConfirm={(clipped) => {
          setAcceptSongFile(clipped);
          setAcceptSongTrim(null);
          toast.success("30s clip ready");
        }}
      />
    </div>
  );
};

export default MusicBattlePlayerPage;
