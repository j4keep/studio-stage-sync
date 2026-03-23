import { useRef, useEffect, useState } from "react";
import { X, ThumbsUp, Heart, MessageCircle, Share2, Bookmark, Search, UserCircle, Volume2, VolumeX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  post: any;
  liked: boolean;
  likesCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onClose: () => void;
}

const ExpandedPostView = ({ post, liked, likesCount, onLike, onComment, onShare, onClose }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    return () => { document.body.style.overflow = ""; };
  }, []);

  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex flex-col"
      >
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
        <div className="flex-1 relative flex items-center justify-center">
          {post.media_type === "video" ? (
            <video
              ref={videoRef}
              src={post.media_url}
              className="w-full h-full object-contain"
              loop
              playsInline
              muted={muted}
              controls={false}
              onClick={() => {
                if (videoRef.current?.paused) videoRef.current.play();
                else videoRef.current?.pause();
              }}
            />
          ) : (
            <img src={post.media_url} alt="" className="w-full h-full object-contain" />
          )}

          {/* Right side action icons */}
          <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
            <button onClick={onLike} className="flex flex-col items-center gap-0.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                liked ? "bg-primary/20" : "bg-white/10 backdrop-blur-sm"
              }`}>
                <ThumbsUp className={`w-6 h-6 ${liked ? "text-primary fill-primary" : "text-white"}`} />
              </div>
              <span className="text-[11px] font-semibold text-white drop-shadow">{formatCount(likesCount)}</span>
            </button>

            <button onClick={onComment} className="flex flex-col items-center gap-0.5">
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
            <button
              onClick={() => setMuted(!muted)}
              className="absolute right-3 bottom-24 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>
          )}

          {/* Bottom user info overlay */}
          <div className="absolute left-0 right-16 bottom-6 px-4">
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
                <p className="text-[13px] font-bold text-white drop-shadow">
                  {post.profile.display_name || "Artist"}
                </p>
                <p className="text-[11px] text-white/70">{timeAgo}</p>
              </div>
              <button className="ml-2 px-3 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold">
                Following
              </button>
            </div>
            {post.caption && (
              <p className="text-[13px] text-white/90 leading-snug drop-shadow line-clamp-2">
                {post.caption}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExpandedPostView;
