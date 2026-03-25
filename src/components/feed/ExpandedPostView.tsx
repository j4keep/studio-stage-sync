import { useRef, useEffect, useState, useCallback } from "react";
import { ThumbsUp, Heart, MessageCircle, Share2, Search, UserCircle, Volume2, VolumeX, Send, ChevronLeft, Link2, MessageSquare, Copy, Bookmark, Play, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [muted, setMuted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [floatingComments, setFloatingComments] = useState<FloatingComment[]>([]);
  const counterRef = useRef(0);

  // Sheet states
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showSearchSheet, setShowSearchSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    if (videoRef.current) videoRef.current.play().catch(() => {});
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Check follow status
  useEffect(() => {
    if (!user || user.id === post.user_id) return;
    (supabase as any).from("follows").select("id").eq("follower_id", user.id).eq("following_id", post.user_id).maybeSingle()
      .then(({ data }: any) => setIsFollowing(!!data));
  }, [user, post.user_id]);

  const toggleFollow = async () => {
    if (!user) return toast.error("Sign in to follow");
    if (user.id === post.user_id) return;
    if (isFollowing) {
      await (supabase as any).from("follows").delete().eq("follower_id", user.id).eq("following_id", post.user_id);
      setIsFollowing(false);
      toast.success("Unfollowed");
    } else {
      await (supabase as any).from("follows").insert({ follower_id: user.id, following_id: post.user_id });
      setIsFollowing(true);
      toast.success("Following!");
    }
  };

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
      const { data } = await (supabase as any).from("post_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: false });
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

  /* ─── swipe down to close ─── */
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  /* ─── share handler ─── */
  const handleShareOption = async (method: string) => {
    const shareUrl = `${window.location.origin}/feed`;
    const shareText = post.caption || "Check this out!";
    switch (method) {
      case "copy":
        navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied!");
        break;
      case "messages":
        window.open(`sms:?body=${encodeURIComponent(shareText + " " + shareUrl)}`);
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`);
        break;
      default:
        try {
          await navigator.share?.({ title: shareText, url: shareUrl });
        } catch {}
    }
    setShowShareSheet(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={handleDragEnd}
        className="fixed inset-0 z-[100] bg-black flex flex-col touch-none"
      >
        {/* Drag indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 w-10 h-1 rounded-full bg-white/40" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-10 pb-3">
          <div />
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSearchSheet(true)} className="w-9 h-9 flex items-center justify-center">
              <Search className="w-5 h-5 text-white drop-shadow-lg" />
            </button>
            <button onClick={() => setShowProfileSheet(true)} className="w-9 h-9 flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-white drop-shadow-lg" />
            </button>
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
          <div className="absolute left-3 right-16 bottom-52 pointer-events-none z-30">
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

          {/* Right side action icons - no bookmark */}
          <div className="absolute right-3 bottom-44 flex flex-col items-center gap-5 z-50">
            <button onClick={onLike} className="flex flex-col items-center gap-0.5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${liked ? "bg-primary/20" : "bg-white/10 backdrop-blur-sm"}`}>
                <ThumbsUp className={`w-6 h-6 ${liked ? "text-primary fill-primary" : "text-white"}`} />
              </div>
              <span className="text-[11px] font-semibold text-white drop-shadow">{formatCount(likesCount)}</span>
            </button>
            <button onClick={() => setShowCommentsSheet(true)} className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-white drop-shadow">{post.comments_count || 0}</span>
            </button>
            <button onClick={() => setShowShareSheet(true)} className="flex flex-col items-center gap-0.5">
              <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-white drop-shadow">{post.views || 0}</span>
            </button>
          </div>

          {/* Volume toggle for videos */}
          {post.media_type === "video" && (
            <button onClick={() => setMuted(!muted)}
              className="absolute right-3 bottom-36 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center z-50">
              {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
          )}

          {/* Bottom user info overlay - positioned lower */}
          <div className="absolute left-0 right-16 bottom-24 px-4 z-20">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => navigate(`/artist/${post.user_id}`)}
                className="w-10 h-10 rounded-full bg-secondary overflow-hidden ring-2 ring-white/30 flex-shrink-0"
              >
                {post.profile.avatar_url ? (
                  <img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/30 flex items-center justify-center text-white text-xs font-bold">
                    {(post.profile.display_name || "A")[0].toUpperCase()}
                  </div>
                )}
              </button>
              <div>
                <button onClick={() => navigate(`/artist/${post.user_id}`)} className="text-[13px] font-bold text-white drop-shadow hover:underline">
                  {post.profile.display_name || "Artist"}
                </button>
                <p className="text-[11px] text-white/70">{timeAgo}</p>
              </div>
              {user?.id !== post.user_id && (
                <button
                  onClick={toggleFollow}
                  className={`ml-2 px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    isFollowing
                      ? "bg-white/20 text-white border border-white/30"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
            {post.caption && <p className="text-[13px] text-white/90 leading-snug drop-shadow line-clamp-2">{post.caption}</p>}
          </div>
        </div>

        {/* ─── Bottom input bar: emoji picker + comment ─── */}
        <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 px-3 pb-safe z-50">
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

        {/* ═══ PROFILE / LIBRARY SHEET ═══ */}
        <AnimatePresence>
          {showProfileSheet && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60" onClick={() => setShowProfileSheet(false)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[110] bg-background rounded-t-2xl max-h-[70vh] overflow-y-auto">
                <div className="mx-auto mt-3 w-10 h-1 rounded-full bg-muted" />
                <div className="px-4 py-4">
                  <h3 className="text-base font-bold text-foreground mb-4">Your library</h3>
                  {[
                    { icon: ThumbsUp, label: "Liked posts", action: () => { setShowProfileSheet(false); } },
                    { icon: Bookmark, label: "Saved posts", action: () => { setShowProfileSheet(false); } },
                    { icon: Share2, label: "Shared posts", action: () => { setShowProfileSheet(false); } },
                    { icon: Play, label: "Watched videos", action: () => { setShowProfileSheet(false); } },
                    { icon: User, label: "Your profile", action: () => { setShowProfileSheet(false); navigate("/profile"); } },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action} className="flex items-center gap-3 w-full py-3 hover:bg-secondary/50 rounded-lg px-2 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ═══ SEARCH SHEET ═══ */}
        <AnimatePresence>
          {showSearchSheet && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60" onClick={() => setShowSearchSheet(false)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[110] bg-background rounded-t-2xl max-h-[80vh] overflow-y-auto">
                <div className="mx-auto mt-3 w-10 h-1 rounded-full bg-muted" />
                <div className="px-4 py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setShowSearchSheet(false)}>
                      <ChevronLeft className="w-5 h-5 text-foreground" />
                    </button>
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input placeholder="Search posts..."
                        className="w-full pl-9 pr-3 py-2 bg-secondary rounded-full text-sm outline-none text-foreground placeholder:text-muted-foreground" autoFocus />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-3">For you</h4>
                  <p className="text-xs text-muted-foreground text-center py-8">Search for posts, artists, and content</p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ═══ SHARE SHEET ═══ */}
        <AnimatePresence>
          {showShareSheet && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60" onClick={() => setShowShareSheet(false)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[110] bg-background rounded-t-2xl">
                <div className="mx-auto mt-3 w-10 h-1 rounded-full bg-muted" />
                <div className="px-4 py-4">
                  {/* Post author info */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                      {post.profile.avatar_url ? (
                        <img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                          {(post.profile.display_name || "A")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{post.profile.display_name || "Artist"}</p>
                      <p className="text-xs text-muted-foreground">Say something about this...</p>
                    </div>
                    <button onClick={() => handleShareOption("native")} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">
                      Share now
                    </button>
                  </div>
                  {/* Share to */}
                  <h4 className="text-sm font-bold text-foreground mb-3">Share to</h4>
                  <div className="flex items-center gap-4 overflow-x-auto pb-4">
                    {[
                      { icon: MessageSquare, label: "Messages", action: () => handleShareOption("messages"), color: "bg-green-500" },
                      { icon: MessageCircle, label: "WhatsApp", action: () => handleShareOption("whatsapp"), color: "bg-emerald-500" },
                      { icon: Copy, label: "Copy link", action: () => handleShareOption("copy"), color: "bg-secondary" },
                      { icon: Link2, label: "More", action: () => handleShareOption("native"), color: "bg-secondary" },
                    ].map((item, i) => (
                      <button key={i} onClick={item.action} className="flex flex-col items-center gap-1.5 min-w-[64px]">
                        <div className={`w-14 h-14 rounded-full ${item.color} flex items-center justify-center`}>
                          <item.icon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[11px] text-foreground">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ═══ COMMENTS SHEET (Facebook-style) ═══ */}
        <AnimatePresence>
          {showCommentsSheet && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60" onClick={() => setShowCommentsSheet(false)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[110] bg-background rounded-t-2xl max-h-[65vh] flex flex-col">
                <div className="mx-auto mt-3 w-10 h-1 rounded-full bg-muted" />
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs text-muted-foreground">Most relevant ▾</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">No comments yet. Be the first!</p>
                  ) : comments.map((c: any) => (
                    <div key={c.id} className="flex gap-2.5">
                      <button onClick={() => { setShowCommentsSheet(false); navigate(`/artist/${c.user_id}`); }}
                        className="w-8 h-8 rounded-full bg-secondary flex-shrink-0 overflow-hidden">
                        {c.profile.avatar_url ? (
                          <img src={c.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">
                            {(c.profile.display_name || "U")[0].toUpperCase()}
                          </div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="bg-secondary rounded-2xl px-3 py-2">
                          <p className="text-[12px] font-bold text-foreground">{c.profile.display_name || "User"}</p>
                          <p className="text-[13px] text-foreground">{c.content}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1 px-1">
                          <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: false })}</span>
                          <button className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Like</button>
                          <button className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Reply</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Comment input at bottom */}
                <div className="border-t border-border px-4 py-2 flex items-center gap-2 pb-safe">
                  <span className="text-xs text-muted-foreground">Comment as {user ? "you" : "guest"}</span>
                  <div className="flex-1" />
                  <button className="text-lg">😀</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExpandedPostView;
