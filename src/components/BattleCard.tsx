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
  const audioLeftRef = useRef<HTMLAudioElement | null>(null);
  const audioRightRef = useRef<HTMLAudioElement | null>(null);
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
  const challengerAvatar = challengerProfile?.avatar_url;
  const opponentName = opponentProfile?.display_name || "???";
  const opponentAvatar = opponentProfile?.avatar_url || null;

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

  // Sequential play: challenger then opponent
  const handleCenterPlay = () => {
    if (isPlaying) {
      audioLeftRef.current?.pause();
      audioRightRef.current?.pause();
      setIsPlaying(false);
      setCurrentSide(null);
      return;
    }
    setIsPlaying(true);
    setCurrentSide("left");
    audioLeftRef.current?.play();
  };
  const handleLeftEnded = () => {
    if (battle.opponent_media_url) {
      setCurrentSide("right");
      audioRightRef.current?.play();
    } else {
      setIsPlaying(false);
      setCurrentSide(null);
    }
  };
  const handleRightEnded = () => {
    setIsPlaying(false);
    setCurrentSide(null);
  };

  // Accept with upload
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

  const isOpen = battle.status === "open" && !battle.opponent_id;
  const isPending = battle.status === "pending" && battle.opponent_id;
  const canAccept = (isOpen && user?.id !== battle.challenger_id) || (isPending && user?.id === battle.opponent_id);
  const bothHaveMedia = !!battle.challenger_media_url && !!battle.opponent_media_url;
  const canVote = isActive && !isExpired && user && user.id !== battle.challenger_id && user.id !== battle.opponent_id;

  const challengerCover = battle.challenger_cover_url || challengerAvatar;
  const opponentCover = battle.opponent_cover_url || opponentAvatar;

  return (
    <motion.div layout className="rounded-2xl overflow-hidden shadow-2xl border border-border/50">
      {/* ─── CINEMATIC BATTLE HEADER ─── */}
      <div className="relative">
        {/* Split background images */}
        <div className="flex h-52 relative overflow-hidden">
          {/* Left side - Challenger (Red tint) */}
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-900/80 via-red-800/60 to-red-900/90 z-10" />
            {challengerCover ? (
              <img src={challengerCover} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-950 to-red-900 flex items-center justify-center">
                <span className="text-5xl font-bold text-red-400/40">{challengerName[0]}</span>
              </div>
            )}
            {/* Challenger info overlay */}
            <div className="absolute inset-0 z-20 flex flex-col justify-between p-3">
              <div>
                <p className="text-white font-bold text-sm drop-shadow-lg truncate">{challengerName}</p>
                <p className="text-red-200/80 text-[10px] truncate">{battle.challenger_title || "Untitled"}</p>
              </div>
              {/* Vote stats */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded backdrop-blur-sm text-[11px] font-bold ${
                    userVote?.voted_for === battle.challenger_id 
                      ? "bg-red-500 text-white" 
                      : "bg-black/50 text-white/90 border border-red-500/40"
                  }`}>
                    <ThumbsUp className="w-3 h-3" />
                    <span>{challengerVotes.toLocaleString()}</span>
                  </div>
                  {challengerPct >= opponentPct && totalVotes > 0 && (
                    <span className="px-2 py-1 rounded bg-red-600/80 text-white text-[10px] font-bold backdrop-blur-sm">
                      WINNING
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider">Votes</span>
                  <span className="text-white font-black text-lg drop-shadow-lg">{challengerPct}%</span>
                </div>
              </div>
            </div>
            {/* Vote tap area */}
            {canVote && (
              <button
                onClick={() => voteMutation.mutate(battle.challenger_id)}
                className="absolute inset-0 z-30"
                aria-label="Vote for challenger"
              />
            )}
            {currentSide === "left" && (
              <motion.div
                className="absolute inset-0 z-20 border-2 border-red-400 rounded-none pointer-events-none"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>

          {/* Center divider + VS + Play button */}
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            {/* Lightning bolt divider */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-gradient-to-b from-yellow-400 via-white to-yellow-400 opacity-60" />
            
            {/* VS badge */}
            <div className="absolute top-3">
              <span className="text-xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] tracking-wider"
                style={{ textShadow: "0 0 20px rgba(255,200,0,0.6), 0 2px 4px rgba(0,0,0,0.8)" }}>
                VS
              </span>
            </div>

            {/* Center play button */}
            {bothHaveMedia && (
              <button
                onClick={handleCenterPlay}
                className="pointer-events-auto w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95"
                style={{
                  background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3), transparent 60%), linear-gradient(135deg, #666 0%, #333 50%, #666 100%)",
                  border: "3px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 0 30px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.2)",
                }}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 text-white drop-shadow-lg" />
                ) : (
                  <Play className="w-7 h-7 text-white drop-shadow-lg ml-1" />
                )}
              </button>
            )}
          </div>

          {/* Right side - Opponent (Blue tint) */}
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-l from-blue-900/80 via-blue-800/60 to-blue-900/90 z-10" />
            {battle.opponent_id && opponentCover ? (
              <img src={opponentCover} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-bl from-blue-950 to-blue-900 flex items-center justify-center">
                <span className="text-5xl font-bold text-blue-400/40">{battle.opponent_id ? opponentName[0] : "?"}</span>
              </div>
            )}
            {/* Opponent info overlay */}
            <div className="absolute inset-0 z-20 flex flex-col justify-between p-3 items-end text-right">
              <div>
                <p className="text-white font-bold text-sm drop-shadow-lg truncate">{battle.opponent_id ? opponentName : "???"}</p>
                <p className="text-blue-200/80 text-[10px] truncate">{battle.opponent_title || (battle.opponent_id ? "Untitled" : "Waiting...")}</p>
              </div>
              {battle.opponent_id && isActive ? (
                <div className="space-y-1 items-end flex flex-col">
                  <div className="flex items-center gap-1.5">
                    {opponentPct > challengerPct && totalVotes > 0 && (
                      <span className="px-2 py-1 rounded bg-blue-600/80 text-white text-[10px] font-bold backdrop-blur-sm">
                        WINNING
                      </span>
                    )}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded backdrop-blur-sm text-[11px] font-bold ${
                      userVote?.voted_for === battle.opponent_id 
                        ? "bg-blue-500 text-white" 
                        : "bg-black/50 text-white/90 border border-blue-500/40"
                    }`}>
                      <ThumbsUp className="w-3 h-3" />
                      <span>{opponentVotes.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-black text-lg drop-shadow-lg">{opponentPct}%</span>
                    <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider">Votes</span>
                  </div>
                </div>
              ) : !battle.opponent_id || !battle.opponent_media_url ? (
                <div />
              ) : null}
            </div>
            {/* Vote tap area */}
            {canVote && battle.opponent_id && (
              <button
                onClick={() => voteMutation.mutate(battle.opponent_id!)}
                className="absolute inset-0 z-30"
                aria-label="Vote for opponent"
              />
            )}
            {currentSide === "right" && (
              <motion.div
                className="absolute inset-0 z-20 border-2 border-blue-400 rounded-none pointer-events-none"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
        </div>

        {/* Progress bar at bottom of image */}
        <div className="h-3 flex relative bg-black/80">
          <motion.div
            className="h-full bg-gradient-to-r from-red-600 to-red-500"
            animate={{ width: `${challengerPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/60 -translate-x-1/2 z-10" />
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 flex-1"
          />
        </div>
      </div>

      {/* ─── TITLE BAR ─── */}
      <div className="bg-card px-4 py-2.5 flex items-center gap-2 border-b border-border">
        <Swords className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm font-display font-bold text-foreground flex-1 truncate">{battle.title}</span>
        {isExpired && isActive ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold flex items-center gap-1 flex-shrink-0">
            <Trophy className="w-3 h-3" /> ENDED
          </span>
        ) : battle.status === "open" ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 font-bold flex-shrink-0">OPEN</span>
        ) : isPending ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500 font-bold flex-shrink-0">CHALLENGE SENT</span>
        ) : isActive ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-bold animate-pulse flex-shrink-0">LIVE</span>
        ) : null}
        {isActive && !isExpired && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono flex-shrink-0">
            <Clock className="w-3 h-3" /> {timeLeft}
          </span>
        )}
        {user?.id === battle.challenger_id && (
          <button onClick={() => deleteBattleMutation.mutate()} className="text-muted-foreground hover:text-destructive ml-1 flex-shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
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

      {/* ─── ACCEPT CHALLENGE SECTION (for pending/open) ─── */}
      {(isPending && user?.id === battle.opponent_id && !battle.opponent_media_url) && (
        <div className="px-4 py-3 bg-orange-500/5 border-b border-border">
          <p className="text-xs text-orange-400 font-bold mb-2 text-center">🥊 You've been challenged!</p>
          {!showUpload ? (
            <button
              onClick={() => setShowUpload(true)}
              className="w-full py-2 rounded-lg bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Accept & Upload Your Entry
            </button>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Your track title" value={acceptTrackTitle} onChange={(e) => setAcceptTrackTitle(e.target.value)} className="text-xs h-9" />
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Upload {battle.media_type === "audio" ? "Song" : "Video"}</label>
                <input type="file" accept={battle.media_type === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
                  onChange={(e) => setAcceptMediaFile(e.target.files?.[0] || null)}
                  className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-primary/10 file:text-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Cover Art (required for audio)</label>
                <input type="file" accept="image/*" onChange={(e) => setAcceptCoverFile(e.target.files?.[0] || null)}
                  className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-primary/10 file:text-primary" />
              </div>
              <button onClick={handleAcceptBattle} disabled={accepting || !acceptTrackTitle.trim() || !acceptMediaFile}
                className="w-full py-2 rounded-lg bg-blue-500 text-white text-xs font-bold disabled:opacity-50">
                {accepting ? "Uploading..." : "🥊 Accept Challenge"}
              </button>
            </div>
          )}
        </div>
      )}

      {isOpen && canAccept && (
        <div className="px-4 py-3 bg-blue-500/5 border-b border-border">
          {!showUpload ? (
            <button onClick={() => setShowUpload(true)} className="w-full py-2 rounded-lg bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Accept This Battle
            </button>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Your track title" value={acceptTrackTitle} onChange={(e) => setAcceptTrackTitle(e.target.value)} className="text-xs h-9" />
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Upload {battle.media_type === "audio" ? "Song" : "Video"}</label>
                <input type="file" accept={battle.media_type === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
                  onChange={(e) => setAcceptMediaFile(e.target.files?.[0] || null)}
                  className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-primary/10 file:text-primary" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Cover Art (required for audio)</label>
                <input type="file" accept="image/*" onChange={(e) => setAcceptCoverFile(e.target.files?.[0] || null)}
                  className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-primary/10 file:text-primary" />
              </div>
              <button onClick={handleAcceptBattle} disabled={accepting || !acceptTrackTitle.trim() || !acceptMediaFile}
                className="w-full py-2 rounded-lg bg-blue-500 text-white text-xs font-bold disabled:opacity-50">
                {accepting ? "Uploading..." : "🥊 Accept Challenge"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── COMMENTS ─── */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border bg-card">
        <MessageCircle className="w-3.5 h-3.5" />
        {comments.length} Comments
        {totalVotes > 0 && <span className="ml-2 text-muted-foreground/60">•</span>}
        {totalVotes > 0 && <span className="text-muted-foreground/80">{totalVotes} votes</span>}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-card">
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

      {/* Hidden audio */}
      {battle.challenger_media_url && <audio ref={audioLeftRef} src={battle.challenger_media_url} onEnded={handleLeftEnded} />}
      {battle.opponent_media_url && <audio ref={audioRightRef} src={battle.opponent_media_url} onEnded={handleRightEnded} />}
    </motion.div>
  );
};

export default BattleCard;
