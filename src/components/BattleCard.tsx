import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ThumbsUp, Send, Swords, MessageCircle, Trash2, Upload, Clock, Trophy } from "lucide-react";
import battleCardBg from "@/assets/battle-card-bg.png";
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
    <motion.div layout className="overflow-hidden rounded-[2rem] border border-border/40 bg-card shadow-2xl">
      <div className="relative overflow-hidden">
        <img src={battleCardBg} alt="Music Battle" className="w-full h-auto block" />
      </div>

      <div className="border-t border-border/30 bg-card px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{battle.title}</p>
          {isActive && !isExpired && timeLeft && <span className="text-[10px] font-bold text-muted-foreground">Ends in {timeLeft}</span>}
          {isExpired && isActive ? (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              <Trophy className="h-3 w-3" /> ENDED
            </span>
          ) : battle.status === "open" ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">OPEN</span>
          ) : isPending ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">CHALLENGE SENT</span>
          ) : isActive ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">LIVE</span>
          ) : null}
          {user?.id === battle.challenger_id && (
            <button onClick={() => deleteBattleMutation.mutate()} className="text-muted-foreground transition-colors hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isExpired && winnerId && (
        <div className="bg-gradient-to-r from-muted via-secondary to-muted px-4 py-2 text-center">
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

      {((isPending && user?.id === battle.opponent_id && !battle.opponent_media_url) || (isOpen && canAccept)) && (
        <div className="border-t border-border/30 bg-muted/20 px-4 py-3">
          {isPending && user?.id === battle.opponent_id && (
            <p className="mb-2 text-center text-xs font-bold text-foreground">🥊 You've been challenged!</p>
          )}
          {!showUpload ? (
            <button onClick={() => setShowUpload(true)} className="gradient-primary flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-primary-foreground shadow-lg">
              <Upload className="h-3.5 w-3.5" /> Accept & Upload Your Entry
            </button>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Your track title" value={acceptTrackTitle} onChange={(e) => setAcceptTrackTitle(e.target.value)} className="h-9 text-xs" />
              <div>
                <label className="mb-1 block text-[10px] text-muted-foreground">Upload {battle.media_type === "audio" ? "Song (max 45 min)" : "Video (max 45 min)"}</label>
                <input
                  type="file"
                  accept={battle.media_type === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
                  onChange={(e) => handleMediaFileChange(e.target.files?.[0] || null)}
                  className="w-full text-[10px] file:mr-2 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-primary"
                />
              </div>
              {battle.media_type === "audio" && (
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">Cover Art (required)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAcceptCoverFile(e.target.files?.[0] || null)}
                    className="w-full text-[10px] file:mr-2 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-primary"
                  />
                </div>
              )}
              <button
                onClick={handleAcceptBattle}
                disabled={accepting || !acceptTrackTitle.trim() || !acceptMediaFile || (battle.media_type === "audio" && !acceptCoverFile)}
                className="gradient-primary w-full rounded-xl py-2.5 text-xs font-bold text-primary-foreground shadow-lg disabled:opacity-50"
              >
                {accepting ? "Uploading..." : "🥊 Accept Challenge"}
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-center gap-1.5 border-t border-border/30 bg-card px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {comments.length} Comments
        {totalVotes > 0 && <span className="ml-2 text-muted-foreground/60">•</span>}
        {totalVotes > 0 && <span className="text-muted-foreground/80">{totalVotes} votes</span>}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border/30 bg-card">
            <div className="max-h-48 space-y-2 overflow-y-auto px-4 py-2">
              {comments.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">No comments yet. Be the first!</p>}
              {comments.map((c: any) => {
                const cp = profileMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full bg-muted">
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
            <div className="scrollbar-hide flex gap-1.5 overflow-x-auto border-t border-border/50 px-4 py-1.5">
              {EMOJIS.map((emoji) => (
                <button key={emoji} onClick={() => commentMutation.mutate(emoji)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted/50 text-sm hover:bg-muted">
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex gap-2 border-t border-border/50 px-4 py-2">
              <Input
                placeholder="Drop a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && comment.trim()) commentMutation.mutate(comment.trim());
                }}
                className="h-8 text-xs"
              />
              <button onClick={() => comment.trim() && commentMutation.mutate(comment.trim())} disabled={!comment.trim()} className="gradient-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-50">
                <Send className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isVideo && battle.challenger_media_url && <audio ref={audioLeftRef} src={battle.challenger_media_url} onEnded={handleLeftEnded} />}
      {!isVideo && battle.opponent_media_url && <audio ref={audioRightRef} src={battle.opponent_media_url} onEnded={handleRightEnded} />}
    </motion.div>
  );
};

export default BattleCard;
