import { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Heart,
  Share2,
  MessageCircle,
  MoreHorizontal,
  SkipForward,
  SkipBack,
  ChevronDown,
  Music,
  Send,
  Search,
  Shuffle,
  Volume2,
  VolumeX,
  Library,
  Upload,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRadio } from "@/contexts/RadioContext";
import { GENRES } from "@/lib/genres";
import { useLikes } from "@/hooks/use-likes";
import { toast } from "@/hooks/use-toast";
import RadioShareSheet from "@/components/RadioShareSheet";
import RadioMoreSheet from "@/components/RadioMoreSheet";
import YajRadioWordmark from "@/components/YajRadioWordmark";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import BoostAdOverlay from "@/components/BoostAdOverlay";

const RADIO_GENRE_FILTERS = ["All", "Podcasts", ...GENRES.filter((g) => g !== "Beats")];

const SEEK_WAVE_BARS = Array.from({ length: 88 }, (_, index) => {
  const seed = (index * 17 + 23) % 100;
  return 28 + (seed % 48);
});

const formatTime = (s: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

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
    isPlaying,
    currentTrack,
    queue,
    allTracks,
    toggle,
    skip,
    previous,
    playTrack,
    setGenreFilter,
    activeGenre,
    loading,
    currentTime,
    duration,
    seek,
    fetchRadioSongs,
    volume,
    setVolume,
    shuffled,
    toggleShuffle,
    songPlayCount,
    resetSongPlayCount,
  } = useRadio();

  useEffect(() => {
    if (allTracks.length === 0) void fetchRadioSongs();
  }, [allTracks.length, fetchRadioSongs]);

  const songIds = allTracks.filter((s) => s.source !== "podcast").map((s) => s.id);
  const podcastIds = allTracks.filter((s) => s.source === "podcast").map((s) => s.id);
  const songLikes = useLikes("song", songIds);
  const podcastLikes = useLikes("podcast", podcastIds);

  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [radioSearchQuery, setRadioSearchQuery] = useState("");
  const [showRadioSearch, setShowRadioSearch] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Record<string, RadioComment[]>>({});
  const commentInputRef = useRef<HTMLInputElement>(null);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const seekGestureLockRef = useRef(false);

  const trackComments = currentTrack ? comments[currentTrack.id] || [] : [];
  const sliderValue = isSeeking ? (seekPreview ?? currentTime) : currentTime;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, sliderValue / duration)) : 0;
  const waveBars = useMemo(() => SEEK_WAVE_BARS, []);
  const seekAreaRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const upNext = queue.slice(0, 4);

  const searchMatches = useMemo(() => {
    const q = radioSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return allTracks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist_name.toLowerCase().includes(q) ||
          ((t as any).album || "").toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [allTracks, radioSearchQuery]);

  const seekByClientX = (clientX: number) => {
    const rect = seekAreaRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const value = ratio * duration;
    setSeekPreview(value);
    seek(value);
  };

  const handleSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    seekGestureLockRef.current = true;
    activePointerIdRef.current = e.pointerId;
    seekAreaRef.current?.setPointerCapture(e.pointerId);
    setIsSeeking(true);
    seekByClientX(e.clientX);
  };

  const handleSeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSeeking || activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    seekByClientX(e.clientX);
  };

  const handleSeekPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    seekByClientX(e.clientX);
    setIsSeeking(false);
    setSeekPreview(null);
    activePointerIdRef.current = null;
    seekGestureLockRef.current = false;
  };

  const handlePostComment = () => {
    if (!commentText.trim() || !currentTrack) return;
    const newComment: RadioComment = {
      id: `c-${Date.now()}`,
      text: commentText.trim(),
      timestamp: currentTime,
      createdAt: new Date(),
      author: "You",
    };
    setComments((prev) => ({
      ...prev,
      [currentTrack.id]: [...(prev[currentTrack.id] || []), newComment],
    }));
    setCommentText("");
    toast({ title: "Comment posted!" });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center lg:min-h-[calc(100dvh-3.5rem-1.5rem)]">
        <div className="text-sm text-muted-foreground">Loading radio...</div>
      </div>
    );
  }

  if (!currentTrack) {
    return (
      <div className="flex min-h-screen flex-col bg-background px-4 pt-4 lg:min-h-[calc(100dvh-3.5rem-1.5rem)] lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-6">
        <div className="mb-4 flex w-full items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card lg:hidden"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <YajRadioWordmark size="sm" />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate("/my-songs?upload=1")}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left"
          >
            <Upload className="h-4 w-4 text-primary" />
            <span className="text-[12px] font-bold">Add Song</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/library")}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left"
          >
            <Library className="h-4 w-4 text-primary" />
            <span className="text-[12px] font-bold">My Library</span>
          </button>
        </div>
        <div className="mb-6 flex w-full gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {RADIO_GENRE_FILTERS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenreFilter(g)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeGenre === g
                  ? "gradient-primary text-primary-foreground glow-primary"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Music className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No songs on radio{activeGenre !== "All" ? ` for ${activeGenre}` : ""} yet
          </p>
          <button
            type="button"
            onClick={() => navigate("/my-songs?upload=1")}
            className="mt-4 rounded-full bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#14B8A6] px-4 py-2 text-xs font-bold text-white"
          >
            Be the first — Add Song
          </button>
        </div>
      </div>
    );
  }

  const track = currentTrack;
  const activeLikes = track.source === "podcast" ? podcastLikes : songLikes;
  const likeCount = activeLikes.getLikeCount(track.id);
  const liked = activeLikes.isLiked(track.id);

  const coverBlock = (
    <AnimatePresence mode="wait">
      <motion.div
        key={track.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-muted shadow-sm lg:mx-0 lg:max-w-none lg:h-full lg:max-h-[min(640px,calc(100dvh-8rem))] lg:aspect-auto"
        onTouchStart={(e) => {
          if (seekGestureLockRef.current) return;
          const target = e.target as HTMLElement;
          if (target.closest('[role="slider"]') || target.closest(".seek-area")) return;
          swipeStartX.current = e.touches[0].clientX;
          swipeStartY.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (seekGestureLockRef.current) return;
          const target = e.target as HTMLElement;
          if (target.closest('[role="slider"]') || target.closest(".seek-area")) {
            swipeStartX.current = null;
            swipeStartY.current = null;
          }
        }}
        onTouchEnd={(e) => {
          if (seekGestureLockRef.current) {
            swipeStartX.current = null;
            swipeStartY.current = null;
            return;
          }
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
        <img src={track.cover_url} alt={track.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={toggle}
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/35 backdrop-blur-md transition hover:bg-black/50 lg:h-20 lg:w-20"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7 text-white lg:h-8 lg:w-8" />
            ) : (
              <Play className="ml-1 h-7 w-7 text-white lg:h-8 lg:w-8" />
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  const controlsBlock = (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-black leading-tight tracking-tight text-foreground lg:text-3xl">{track.title}</h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground lg:text-base">
          {track.artist_name}
          {(track as any).album ? ` · ${(track as any).album}` : ""}
        </p>
        <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          {track.genre}
        </span>
      </div>

      <div
        ref={seekAreaRef}
        className="seek-area mb-4 select-none touch-none"
        onPointerDown={handleSeekPointerDown}
        onPointerMove={handleSeekPointerMove}
        onPointerUp={handleSeekPointerUp}
        onPointerCancel={handleSeekPointerUp}
      >
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-foreground/90">{formatTime(sliderValue)}</span>
          <span className="text-muted-foreground">{formatTime(duration)}</span>
        </div>
        <div className="flex h-14 items-end gap-[2px] rounded-xl bg-muted/60 px-1.5 py-2 lg:h-16">
          {waveBars.map((barHeight, index) => {
            const barRatio = (index + 1) / waveBars.length;
            const isPlayed = progressRatio >= barRatio;
            return (
              <div key={index} className="flex flex-1 flex-col items-center justify-end gap-[1px]" style={{ height: "100%" }}>
                <span
                  className="w-full rounded-[1px]"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: isPlayed ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.28)",
                  }}
                />
                <span
                  className="w-full rounded-[1px]"
                  style={{
                    height: `${Math.max(15, barHeight * 0.45)}%`,
                    backgroundColor: isPlayed ? "hsl(var(--primary) / 0.55)" : "hsl(var(--primary) / 0.12)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <button type="button" onClick={() => setVolume(volume === 0 ? 1 : 0)} className="shrink-0" aria-label="Mute">
          {volume === 0 ? (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Volume2 className="h-4 w-4 text-foreground" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer accent-primary"
        />
        <button
          type="button"
          onClick={toggleShuffle}
          className={`shrink-0 ${shuffled ? "text-primary" : "text-muted-foreground"}`}
          aria-label="Shuffle"
        >
          <Shuffle className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-5 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={previous}
          className="flex flex-col items-center gap-1"
          aria-label="Previous song"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
            <SkipBack className="h-5 w-5 text-foreground" />
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">Previous</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#A855F7] via-[#EC4899] to-[#14B8A6] text-white shadow-sm"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
        </button>
        <button
          type="button"
          onClick={skip}
          className="flex flex-col items-center gap-1"
          aria-label="Next song"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
            <SkipForward className="h-5 w-5 text-foreground" />
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">Next</span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => activeLikes.toggleLike(track.id)}
          className="flex flex-col items-center gap-1 py-1"
        >
          <Heart className={`h-6 w-6 ${liked ? "fill-primary text-primary" : "text-foreground"}`} />
          <span className="text-[10px] font-medium text-muted-foreground">{likeCount || "Like"}</span>
        </button>
        <button type="button" onClick={() => setCommentsOpen(true)} className="flex flex-col items-center gap-1 py-1">
          <MessageCircle className="h-6 w-6 text-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">Comment</span>
        </button>
        <button type="button" onClick={() => setShareOpen(true)} className="flex flex-col items-center gap-1 py-1">
          <Share2 className="h-6 w-6 text-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">Share</span>
        </button>
        <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-1 py-1">
          <MoreHorizontal className="h-6 w-6 text-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">More</span>
        </button>
      </div>

      {upNext.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Up next</p>
          <ul className="space-y-2">
            {upNext.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => playTrack(t)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-2 py-2 text-left transition hover:bg-muted"
                >
                  <img src={t.cover_url} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{t.artist_name}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative bg-background lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-sm">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-3 pb-3 pt-3 backdrop-blur lg:static lg:bg-card lg:px-3 lg:pt-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted lg:hidden"
            aria-label="Back"
          >
            <ChevronDown className="h-5 w-5 text-foreground" />
          </button>
          <div className="min-w-0 shrink-0">
            <YajRadioWordmark size="md" />
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowRadioSearch(!showRadioSearch)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Search radio"
          >
            <Search className="h-4 w-4 text-foreground" />
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> LIVE
          </span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate("/my-songs?upload=1")}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition active:scale-[0.98]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#A855F7] via-[#EC4899] to-[#14B8A6] text-white">
              <Upload className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-black text-foreground">Add Song</span>
              <span className="block text-[10px] text-muted-foreground">Upload & put on Radio</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/library")}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition active:scale-[0.98]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-primary">
              <Library className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-black text-foreground">My Library</span>
              <span className="block text-[10px] text-muted-foreground">Playlists & saves</span>
            </span>
          </button>
        </div>

        {showRadioSearch && (
          <div className="relative mb-3">
            <input
              autoFocus
              placeholder="Search by song, artist, or album…"
              value={radioSearchQuery}
              onChange={(e) => setRadioSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
            />
            {radioSearchQuery.trim() && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                {searchMatches.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      playTrack(t);
                      setShowRadioSearch(false);
                      setRadioSearchQuery("");
                    }}
                    className="flex w-full items-center gap-3 p-2.5 text-left transition hover:bg-primary/5"
                  >
                    <img src={t.cover_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{t.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {t.artist_name} · {(t as any).album || "Unknown Album"}
                      </p>
                    </div>
                  </button>
                ))}
                {searchMatches.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">No matches found</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {RADIO_GENRE_FILTERS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenreFilter(g)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                activeGenre === g
                  ? "gradient-primary text-primary-foreground"
                  : "border border-border bg-muted/70 text-muted-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* One continuous page scroll — works anywhere on desktop & mobile */}
      <div className="px-4 pb-28 pt-4 lg:px-5 lg:pb-10 lg:pt-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="w-full shrink-0 lg:sticky lg:top-4 lg:w-[48%] lg:max-w-[520px]">{coverBlock}</div>
          <div className="min-w-0 w-full lg:flex-1">{controlsBlock}</div>
        </div>
      </div>

      <RadioShareSheet open={shareOpen} onOpenChange={setShareOpen} track={track} />
      <RadioMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        track={track}
        isLiked={liked}
        onToggleLike={() => activeLikes.toggleLike(track.id)}
        onViewComments={() => setCommentsOpen(true)}
      />

      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="bottom" className="flex h-[70vh] flex-col rounded-t-2xl border-border bg-card">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={() => setCommentsOpen(false)}>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </button>
            <h3 className="text-sm font-bold text-foreground">Comments</h3>
            <div className="w-5" />
          </div>

          <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
              <img src={track.cover_url} alt="" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{track.title}</p>
              <p className="text-xs text-primary">{track.artist_name}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {trackComments.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {trackComments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <span className="text-[10px] font-bold text-foreground">{c.author[0]}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{c.author}</span>
                        <span className="text-[9px] text-muted-foreground">at {formatTime(c.timestamp)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-foreground/80">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
              placeholder={`Comment at ${formatTime(currentTime)}...`}
              className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={handlePostComment}
              disabled={!commentText.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full gradient-primary disabled:opacity-40"
            >
              <Send className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <BoostAdOverlay songPlayCount={songPlayCount} onAdComplete={resetSongPlayCount} interval={3} />
    </div>
  );
};

export default RadioPage;
