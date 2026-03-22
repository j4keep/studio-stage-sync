import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Heart, Send, Trophy, Swords, Music, Users, MessageCircle, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
}

const EMOJIS = ["🔥", "💀", "🎤", "👑", "💪", "😤", "🏆", "⚡"];

const HealthBar = ({ percentage, side }: { percentage: number; side: "left" | "right" }) => {
  const getColor = () => {
    if (percentage < 30) return "from-red-500 to-red-600";
    if (percentage < 60) return "from-yellow-500 to-yellow-600";
    return "from-green-500 to-green-600";
  };

  return (
    <div className={`flex-1 h-4 rounded-full bg-muted/50 overflow-hidden border border-border/50 ${side === "right" ? "flex-row-reverse" : ""}`}>
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${getColor()}`}
        initial={{ width: "50%" }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
};

const BattleCard = ({ battle }: { battle: Battle }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [playingSide, setPlayingSide] = useState<"left" | "right" | null>(null);
  const audioLeftRef = useRef<HTMLAudioElement | null>(null);
  const audioRightRef = useRef<HTMLAudioElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

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

  // Fetch profiles for display names
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
  const challengerPct = totalVotes > 0 ? (challengerVotes / totalVotes) * 100 : 50;
  const opponentPct = totalVotes > 0 ? (opponentVotes / totalVotes) * 100 : 50;

  const userVote = votes.find((v: any) => v.user_id === user?.id);

  // Realtime subscriptions
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

  // Auto scroll comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const voteMutation = useMutation({
    mutationFn: async (votedFor: string) => {
      if (userVote) {
        if (userVote.voted_for === votedFor) {
          await (supabase as any).from("battle_votes").delete().eq("id", userVote.id);
        } else {
          await (supabase as any).from("battle_votes").update({ voted_for: votedFor }).eq("id", userVote.id);
        }
      } else {
        await (supabase as any).from("battle_votes").insert({
          battle_id: battle.id,
          user_id: user?.id,
          voted_for: votedFor,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["battle-votes", battle.id] }),
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      await (supabase as any).from("battle_comments").insert({
        battle_id: battle.id,
        user_id: user?.id,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["battle-comments", battle.id] });
      setComment("");
    },
  });

  const handlePlay = (side: "left" | "right") => {
    const ref = side === "left" ? audioLeftRef : audioRightRef;
    const otherRef = side === "left" ? audioRightRef : audioLeftRef;

    if (playingSide === side) {
      ref.current?.pause();
      setPlayingSide(null);
    } else {
      otherRef.current?.pause();
      ref.current?.play();
      setPlayingSide(side);
    }
  };

  const acceptBattle = async () => {
    if (!user) return;
    await (supabase as any).from("battles").update({
      opponent_id: user.id,
      status: "active",
    }).eq("id", battle.id);
    queryClient.invalidateQueries({ queryKey: ["battles"] });
  };

  const isOpen = battle.status === "open" && !battle.opponent_id;
  const isPending = battle.status === "pending" && battle.opponent_id;
  const canAccept = (isOpen && user?.id !== battle.challenger_id) || (isPending && user?.id === battle.opponent_id);

  return (
    <motion.div
      layout
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      {/* Battle Title Header */}
      <div className="bg-gradient-to-r from-red-600/20 via-primary/10 to-blue-600/20 px-4 py-3 flex items-center gap-2">
        <Swords className="w-4 h-4 text-primary" />
        <span className="text-sm font-display font-bold text-foreground flex-1">{battle.title}</span>
        {battle.status === "open" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 font-bold">OPEN</span>}
        {battle.status === "pending" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500 font-bold">CHALLENGE SENT</span>}
        {battle.status === "active" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-bold animate-pulse">LIVE</span>}
      </div>

      {/* Health Bars - Street Fighter Style */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold text-red-400 w-8">{challengerVotes}</span>
          <HealthBar percentage={challengerPct} side="left" />
          <span className="text-[10px] font-bold text-foreground">VS</span>
          <HealthBar percentage={opponentPct} side="right" />
          <span className="text-[10px] font-bold text-blue-400 w-8 text-right">{opponentVotes}</span>
        </div>
      </div>

      {/* Split Screen */}
      <div className="flex divide-x divide-border">
        {/* Challenger Side (Red) */}
        <div className="flex-1 p-3">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full mx-auto mb-2 overflow-hidden bg-red-500/20 border-2 border-red-500/50">
              {challengerAvatar ? (
                <img src={challengerAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-red-400 font-bold text-lg">
                  {challengerName[0]}
                </div>
              )}
            </div>
            <p className="text-xs font-bold text-foreground truncate">{challengerName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{battle.challenger_title || "Untitled"}</p>

            {battle.challenger_media_url && (
              <button
                onClick={() => handlePlay("left")}
                className="mt-2 w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto hover:bg-red-500/30 transition-colors"
              >
                {playingSide === "left" ? <Pause className="w-4 h-4 text-red-400" /> : <Play className="w-4 h-4 text-red-400 ml-0.5" />}
              </button>
            )}

            <button
              onClick={() => battle.opponent_id && voteMutation.mutate(battle.challenger_id)}
              disabled={!battle.opponent_id}
              className={`mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 mx-auto transition-all ${
                userVote?.voted_for === battle.challenger_id
                  ? "bg-red-500 text-white"
                  : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
              } disabled:opacity-30`}
            >
              <Heart className={`w-3 h-3 ${userVote?.voted_for === battle.challenger_id ? "fill-white" : ""}`} /> Vote
            </button>
          </div>
        </div>

        {/* Opponent Side (Blue) */}
        <div className="flex-1 p-3">
          <div className="text-center">
            {battle.opponent_id ? (
              <>
                <div className="w-14 h-14 rounded-full mx-auto mb-2 overflow-hidden bg-blue-500/20 border-2 border-blue-500/50">
                  {opponentAvatar ? (
                    <img src={opponentAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-blue-400 font-bold text-lg">
                      {opponentName[0]}
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-foreground truncate">{opponentName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{battle.opponent_title || "Untitled"}</p>

                {battle.opponent_media_url && (
                  <button
                    onClick={() => handlePlay("right")}
                    className="mt-2 w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mx-auto hover:bg-blue-500/30 transition-colors"
                  >
                    {playingSide === "right" ? <Pause className="w-4 h-4 text-blue-400" /> : <Play className="w-4 h-4 text-blue-400 ml-0.5" />}
                  </button>
                )}

                <button
                  onClick={() => voteMutation.mutate(battle.opponent_id!)}
                  className={`mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 mx-auto transition-all ${
                    userVote?.voted_for === battle.opponent_id
                      ? "bg-blue-500 text-white"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                  }`}
                >
                  <Heart className={`w-3 h-3 ${userVote?.voted_for === battle.opponent_id ? "fill-white" : ""}`} /> Vote
                </button>
              </>
            ) : (
              <div className="py-4">
                <div className="w-14 h-14 rounded-full mx-auto mb-2 bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden">
                  {opponentAvatar ? (
                    <img src={opponentAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{battle.opponent_id ? opponentName[0] : "?"}</span>
                  )}
                </div>
                <p className="text-xs font-bold text-foreground truncate">{battle.opponent_id ? opponentName : "???"}</p>
                <p className="text-xs text-muted-foreground mb-2">{isPending ? "Challenge sent!" : "Waiting for opponent..."}</p>
                {canAccept && (
                  <button
                    onClick={acceptBattle}
                    className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[11px] font-bold mx-auto"
                  >
                    Accept Challenge
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expand for comments */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {comments.length} Comments
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            {/* Comments Section */}
            <div className="max-h-48 overflow-y-auto px-4 py-2 space-y-2">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No comments yet. Be the first!</p>
              )}
              {comments.map((c: any) => {
                const cp = profileMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0 overflow-hidden">
                      {cp?.avatar_url ? (
                        <img src={cp.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {(cp?.display_name || "U")[0]}
                        </div>
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

            {/* Emoji Quick Bar */}
            <div className="px-4 py-1.5 flex gap-1.5 overflow-x-auto scrollbar-hide border-t border-border/50">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => commentMutation.mutate(emoji)}
                  className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted text-sm flex-shrink-0"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Comment Input */}
            <div className="px-4 py-2 flex gap-2 border-t border-border/50">
              <Input
                placeholder="Drop a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && comment.trim()) {
                    commentMutation.mutate(comment.trim());
                  }
                }}
                className="text-xs h-8"
              />
              <button
                onClick={() => comment.trim() && commentMutation.mutate(comment.trim())}
                disabled={!comment.trim()}
                className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-primary-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden audio elements */}
      {battle.challenger_media_url && (
        <audio ref={audioLeftRef} src={battle.challenger_media_url} onEnded={() => setPlayingSide(null)} />
      )}
      {battle.opponent_media_url && (
        <audio ref={audioRightRef} src={battle.opponent_media_url} onEnded={() => setPlayingSide(null)} />
      )}
    </motion.div>
  );
};

export default BattleCard;
