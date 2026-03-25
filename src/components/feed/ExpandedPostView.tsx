import { useRef, useEffect, useState, useCallback } from "react";
import { X, ThumbsUp, Heart, MessageCircle, Share2, Bookmark, Search, UserCircle, Volume2, VolumeX, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EMOJI_CHARACTERS, EMOJI_MAP, type EmojiCharacter } from "@/lib/emoji-characters";

interface Props {
  post: any;
  liked: boolean;
  likesCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onClose: () => void;
}

/* ─── floating effect types ─── */
interface FloatingEffect {
  id: string;
  src: string;
  x: number;
  y: number;
  type: "float-up" | "burst" | "spiral";
}

interface FloatingComment {
  id: string;
  text: string;
  avatar?: string;
  name: string;
}

const ANIM = {
  "float-up": {
    initial: { y: 0, opacity: 0, scale: 0.3 },
    animate: { y: -300, opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 0.9, 0.6] },
    transition: { duration: 3.5, ease: "easeOut" as const },
  },
  burst: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: [0, 1.8, 1.3, 0], opacity: [0, 1, 1, 0] },
    transition: { duration: 2.5, ease: "easeOut" as const },
  },
  spiral: {
    initial: { scale: 0, opacity: 0, x: 0, y: 0 },
    animate: { scale: [0, 1.5, 1, 0], opacity: [0, 1, 1, 0], x: [0, 50, -30, 15], y: [0, -30, -80, -200], rotate: [0, 180, 360, 720] },
    transition: { duration: 4, ease: "easeOut" as const },
  },
};
const ANIM_TYPES: Array<FloatingEffect["type"]> = ["float-up", "burst", "spiral"];

const ExpandedPostView = ({ post, liked, likesCount, onLike, onComment, onShare, onClose }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [muted, setMuted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [floatingComments, setFloatingComments] = useState<FloatingComment[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    if (videoRef.current) videoRef.current.play().catch(() => {});
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* ─── floating emoji logic ─── */
  const spawnEffect = useCallback((emojiId: string, src: string) => {
    const id = `fx-${counterRef.current++}`;
    const animType = ANIM_TYPES[Math.floor(Math.random() * ANIM_TYPES.length)];
    const effect: FloatingEffect = { id, src, x: 5 + Math.random() * 70, y: 10 + Math.random() * 50, type: animType };
    setEffects(prev => [...prev, effect]);
    setTimeout(() => setEffects(prev => prev.filter(e => e.id !== id)), 5000);
  }, []);

  const handleSendEmoji = async (item: EmojiCharacter) => {
    if (!user) return;
    spawnEffect(item.id, item.src);
    setTimeout(() => spawnEffect(item.id, item.src), 150);
    setTimeout(() => spawnEffect(item.id, item.src), 350);
    setShowPicker(false);
    await (supabase as any).from("post_reactions").insert({
      post_id: post.id, user_id: user.id, emoji_id: item.id,
    });
  };

  /* ─── floating comments logic ─── */
  const spawnFloatingComment = useCallback((text: string, avatar?: string, name?: string) => {
    const id = `fc-${counterRef.current++}`;
    const fc: FloatingComment = { id, text, avatar, name: name || "User" };
    setFloatingComments(prev => [...prev, fc]);
    setTimeout(() => setFloatingComments(prev => prev.filter(c => c.id !== id)), 5000);
  }, []);

  /* ─── comments query ─── */
  const { data: comments = [] } = useQuery({
    queryKey: ["post-comments", post.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("post_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
      if (!data?.length) return [];
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await (supabase as any).from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return data.map((c: any) => ({ ...c, profile: map.get(c.user_id) || { display_name: "User" } }));
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("post_comments").insert({ post_id: post.id, user_id: user.id, content: commentText.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      spawnFloatingComment(commentText.trim(), undefined, "You");
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["post-comments", post.id] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
  });

  /* ─── realtime reactions ─── */
  useEffect(() => {
    const channel = supabase
      .channel(`post-reactions-expanded-${post.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_reactions", filter: `post_id=eq.${post.id}` }, (payload: any) => {
        if (payload.new.user_id !== user?.id) {
          const src = EMOJI_MAP[payload.new.emoji_id] || EMOJI_CHARACTERS[0].src;
          spawnEffect(payload.new.emoji_id, src);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_comments", filter: `post_id=eq.${post.id}` }, (payload: any) => {
        if (payload.new.user_id !== user?.id) {
          spawnFloatingComment(payload.new.content);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.id, user?.id, spawnEffect, spawnFloatingComment]);

  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex flex-col">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-12 pb-3">
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center">
            <X className="w-6 h-6 text-white drop-shadow-lg" />
          </button>
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-white drop-shadow-lg" />
            <UserCircle className="w-6 h-6 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Media fills screen */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {post.media_type === "video" ? (
            <video ref={videoRef} src={post.media_url} className="w-full h-full object-contain" loop playsInline muted={muted} controls={false}
              onClick={() => { if (videoRef.current?.paused) videoRef.current.play(); else videoRef.current?.pause(); }} />
          ) : (
            <img src={post.media_url} alt="" className="w-full h-full object-contain" />
          )}

          {/* ─── Floating emoji effects layer ─── */}
          <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            <AnimatePresence>
              {effects.map(effect => {
                const a = ANIM[effect.type];
                return (
                  <motion.div key={effect.id} initial={a.initial} animate={a.animate} transition={a.transition}
                    className="absolute pointer-events-none" style={{ left: `${effect.x}%`, top: `${effect.y}%` }}>
                    <motion.div animate={{ rotate: [0, -8, 8, -6, 6, 0], scaleX: [1, 1.05, 0.95, 1], scaleY: [1, 0.95, 1.05, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}>
                      <img src={effect.src} alt="" className="w-20 h-20 md:w-28 md:h-28 object-contain"
                        style={{ filter: "drop-shadow(0 0 12px rgba(255,165,0,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }} />
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* ─── Floating comments layer ─── */}
          <div className="absolute left-3 right-16 bottom-44 pointer-events-none z-30">
            <AnimatePresence>
              {floatingComments.map(fc => (
                <motion.div key={fc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: [0, 1, 1, 0], y: [20, 0, -40, -100] }}
                  transition={{ duration: 5, ease: "easeOut" }}
                  className="mb-2 flex items-start gap-2 max-w-[80%]">
                  <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-2xl">
                    <span className="text-[11px] font-bold text-white/80">{fc.name}: </span>
                    <span className="text-[12px] text-white/90">{fc.text}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Right side action icons */}
          <div className="absolute right-3 bottom-56 flex flex-col items-center gap-5 z-50">
            <button onClick={onLike} className="flex flex-col items-center gap-0.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${liked ? "bg-primary/20" : "bg-white/10 backdrop-blur-sm"}`}>
                <ThumbsUp className={`w-6 h-6 ${liked ? "text-primary fill-primary" : "text-white"}`} />
              </div>
              <span className="text-[11px] font-semibold text-white drop-shadow">{formatCount(likesCount)}</span>
            </button>
            <button onClick={() => setShowPicker(false)} className="flex flex-col items-center gap-0.5">
              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-white drop-shadow">{post.comments_count || 0}</span>
            </button>
            <button onClick={onShare} className="flex flex-col items-center gap-0.5">
              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-white drop-shadow">{post.views || 0}</span>
            </button>
            <button className="flex flex-col items-center gap-0.5">
              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Bookmark className="w-6 h-6 text-white" />
              </div>
            </button>
          </div>

          {/* Volume toggle for videos */}
          {post.media_type === "video" && (
            <button onClick={() => setMuted(!muted)}
              className="absolute right-3 bottom-48 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center z-50">
              {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
          )}

          {/* Bottom user info overlay */}
          <div className="absolute left-0 right-16 bottom-36 px-4 z-20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden ring-2 ring-white/30 flex-shrink-0">
                {post.profile.avatar_url ? (
                  <img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/30 flex items-center justify-center text-white text-xs font-bold">
                    {(post.profile.display_name || "A")[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[13px] font-bold text-white drop-shadow">{post.profile.display_name || "Artist"}</p>
                <p className="text-[11px] text-white/70">{timeAgo}</p>
              </div>
              <button className="ml-2 px-3 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold">Following</button>
            </div>
            {post.caption && <p className="text-[13px] text-white/90 leading-snug drop-shadow line-clamp-2">{post.caption}</p>}
          </div>
        </div>

        {/* ─── Bottom input bar: emoji picker + comment ─── */}
        <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 px-3 pb-safe z-50">
          {/* Emoji picker */}
          {showPicker && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="py-2 max-h-52 overflow-y-auto">
              <div className="grid grid-cols-6 gap-1.5">
                {EMOJI_CHARACTERS.map(item => (
                  <button key={item.id} onClick={() => handleSendEmoji(item)}
                    className="w-full aspect-square rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all p-1" title={item.label}>
                    <img src={item.src} alt={item.label} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Comment input + emoji toggle */}
          <div className="flex items-center gap-2 py-2">
            <button onClick={() => setShowPicker(p => !p)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
              <span className="text-lg">✨</span>
            </button>
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 text-sm bg-white/10 rounded-full px-3 py-2 outline-none text-white placeholder:text-white/50"
              onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) commentMutation.mutate(); }} />
            <button onClick={() => commentText.trim() && commentMutation.mutate()}
              disabled={!commentText.trim() || commentMutation.isPending}
              className="text-primary disabled:opacity-40">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExpandedPostView;
