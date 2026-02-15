import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Heart, Share2, MessageCircle, MoreHorizontal, ListMusic, ChevronDown, Music, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRadio } from "@/contexts/RadioContext";
import { GENRES } from "@/lib/genres";
import { useLikes } from "@/hooks/use-likes";
import { toast } from "@/hooks/use-toast";
import RadioShareSheet from "@/components/RadioShareSheet";
import RadioMoreSheet from "@/components/RadioMoreSheet";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";

const RADIO_GENRE_FILTERS = ["All", ...GENRES.filter(g => g !== "Beats")];

const formatTime = (s: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// Local comments state type
interface RadioComment {
  id: string;
  text: string;
  timestamp: number;
  createdAt: Date;
  author: string;
}

const RadioPage = () => {
  const navigate = useNavigate();
  const {
    isPlaying, currentTrack, queue, allTracks, toggle, skip, previous, skipsLeft,
    playTrack, setGenreFilter, activeGenre, loading,
    currentTime, duration, seek,
  } = useRadio();

  const songIds = allTracks.map(s => s.id);
  const { toggleLike, isLiked, getLikeCount } = useLikes("song", songIds);

  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Record<string, RadioComment[]>>({});
  const commentInputRef = useRef<HTMLInputElement>(null);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  const trackComments = currentTrack ? (comments[currentTrack.id] || []) : [];

  const handlePostComment = () => {
    if (!commentText.trim() || !currentTrack) return;
    const newComment: RadioComment = {
      id: `c-${Date.now()}`,
      text: commentText.trim(),
      timestamp: currentTime,
      createdAt: new Date(),
      author: "You",
    };
    setComments(prev => ({
      ...prev,
      [currentTrack.id]: [...(prev[currentTrack.id] || []), newComment],
    }));
    setCommentText("");
    toast({ title: "Comment posted!" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground text-sm">Loading radio...</div>
      </div>
    );
  }

  if (!currentTrack) {
    return (
      <div className="px-4 pt-4 flex flex-col min-h-screen">
        <div className="flex items-center justify-between w-full mb-4">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          <h1 className="text-sm font-display font-bold text-foreground">WHEUAT Radio</h1>
          <div className="w-8" />
        </div>
        <div className="flex gap-2 w-full overflow-x-auto scrollbar-hide mb-6 pb-1">
          {RADIO_GENRE_FILTERS.map((g) => (
            <button key={g} onClick={() => setGenreFilter(g)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeGenre === g ? "gradient-primary text-primary-foreground glow-primary" : "bg-card border border-border text-muted-foreground"
              }`}>{g}</button>
          ))}
        </div>
        <div className="py-16 text-center flex-1 flex flex-col items-center justify-center">
          <Music className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No songs on radio{activeGenre !== "All" ? ` for ${activeGenre}` : ""} yet</p>
        </div>
      </div>
    );
  }

  const track = currentTrack;
  const likeCount = getLikeCount(track.id);
  const liked = isLiked(track.id);

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {/* Genre filter bar at top */}
      <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <ChevronDown className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-primary font-semibold uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> LIVE
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {RADIO_GENRE_FILTERS.map((g) => (
            <button key={g} onClick={() => setGenreFilter(g)}
              className={`px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                activeGenre === g ? "gradient-primary text-primary-foreground" : "bg-background/40 backdrop-blur-sm text-foreground/70 border border-border/40"
              }`}>{g}</button>
          ))}
        </div>
      </div>

      {/* Full-screen album art */}
      <AnimatePresence mode="wait">
        <motion.div
          key={track.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative flex-1 min-h-0"
          onTouchStart={(e) => {
            swipeStartX.current = e.touches[0].clientX;
            swipeStartY.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (swipeStartX.current === null || swipeStartY.current === null) return;
            const diffX = e.changedTouches[0].clientX - swipeStartX.current;
            const diffY = e.changedTouches[0].clientY - swipeStartY.current;
            swipeStartX.current = null;
            swipeStartY.current = null;
            if (diffY > 80 && Math.abs(diffX) < Math.abs(diffY)) {
              navigate(-1);
              return;
            }
            if (Math.abs(diffX) > 60) {
              if (diffX < 0) skip();
              else previous();
            }
          }}
        >
          <div className="absolute inset-0">
            <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/40" />
          </div>

          {/* Track info overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 z-10">
            <div className="mb-3">
              <h2 className="text-lg font-bold text-foreground drop-shadow-lg leading-tight">{track.title}</h2>
              <p className="text-sm text-foreground/80 drop-shadow-lg">{track.artist_name}</p>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-background/40 backdrop-blur-sm text-primary font-medium mt-1 inline-block">{track.genre}</span>
            </div>

            {/* Seekable progress bar */}
            <div className="mb-3">
              <Slider
                value={[isSeeking ? undefined as any : currentTime]}
                max={duration || 100}
                step={0.5}
                onValueChange={(v) => { setIsSeeking(true); seek(v[0]); }}
                onValueCommit={() => setIsSeeking(false)}
                className="w-full [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-primary [&_.relative]:h-1"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-foreground/70">{formatTime(currentTime)}</span>
                <span className="text-[10px] text-foreground/70">{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Play button overlay center */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <button onClick={toggle} className="w-16 h-16 rounded-full bg-background/30 backdrop-blur-md flex items-center justify-center border border-foreground/10 hover:bg-background/50 transition-all">
              {isPlaying ? <Pause className="w-7 h-7 text-foreground" /> : <Play className="w-7 h-7 text-foreground ml-1" />}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom action bar */}
      <div className="flex items-center justify-around py-3 px-4 bg-background border-t border-border">
        <button onClick={() => toggleLike(track.id)} className="flex items-center gap-1.5">
          <Heart className={`w-6 h-6 transition-colors ${liked ? "text-primary fill-primary" : "text-foreground"}`} />
          <span className="text-xs text-foreground font-medium">{likeCount}</span>
        </button>

        <button onClick={() => setCommentsOpen(true)}>
          <MessageCircle className="w-6 h-6 text-foreground" />
        </button>

        <button onClick={() => setShareOpen(true)}>
          <Share2 className="w-6 h-6 text-foreground" />
        </button>

        <button onClick={skip} disabled={skipsLeft === 0}>
          <ListMusic className="w-6 h-6 text-foreground disabled:opacity-30" />
        </button>

        <button onClick={() => setMoreOpen(true)}>
          <MoreHorizontal className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Share Sheet */}
      <RadioShareSheet open={shareOpen} onOpenChange={setShareOpen} track={track} />

      {/* More Options Sheet */}
      <RadioMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        track={track}
        isLiked={liked}
        onToggleLike={() => toggleLike(track.id)}
        onViewComments={() => setCommentsOpen(true)}
      />

      {/* Comments Sheet */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl h-[70vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCommentsOpen(false)}>
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
            <h3 className="text-sm font-bold text-foreground">Comments</h3>
            <div className="w-5" />
          </div>

          {/* Track info */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
              <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{track.title}</p>
              <p className="text-xs text-primary">{track.artist_name}</p>
            </div>
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto">
            {trackComments.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {trackComments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-foreground">{c.author[0]}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{c.author}</span>
                        <span className="text-[9px] text-muted-foreground">at {formatTime(c.timestamp)}</span>
                      </div>
                      <p className="text-xs text-foreground/80 mt-0.5">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comment input */}
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
              placeholder={`Comment at ${formatTime(currentTime)}...`}
              className="flex-1 bg-secondary rounded-full px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              onClick={handlePostComment}
              disabled={!commentText.trim()}
              className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center disabled:opacity-40"
            >
              <Send className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default RadioPage;
