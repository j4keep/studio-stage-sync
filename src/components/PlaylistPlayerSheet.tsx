import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ChevronDown, SkipForward, SkipBack } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { usePlaylists } from "@/contexts/PlaylistContext";

const formatTime = (s: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const PlaylistPlayerSheet = () => {
  const {
    nowPlaying, isPlaylistPlaying, togglePlaylistPlayback,
    skipPlaylistTrack, prevPlaylistTrack, playlistAudioRef,
    playerSheetOpen, setPlayerSheetOpen,
  } = usePlaylists();

  const [isSeeking, setIsSeeking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const listenersAttached = useRef(false);

  // Sync time from the global audio ref
  const audio = playlistAudioRef.current;
  if (audio && !listenersAttached.current) {
    listenersAttached.current = true;
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("durationchange", () => setDuration(audio.duration));
  }

  if (!nowPlaying) return null;
  const currentItem = nowPlaying.items[nowPlaying.index];
  if (!currentItem) return null;

  const handleSeek = (v: number[]) => {
    setIsSeeking(true);
    if (audio) {
      audio.currentTime = v[0];
      setCurrentTime(v[0]);
    }
  };

  return (
    <Sheet open={playerSheetOpen} onOpenChange={setPlayerSheetOpen}>
      <SheetContent side="bottom" className="bg-background border-none p-0 h-screen max-h-screen [&>button]:hidden">
        <div className="flex flex-col h-full relative">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 flex items-center">
            <button onClick={() => setPlayerSheetOpen(false)} className="w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center">
              <ChevronDown className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Playing from playlist</span>
            </div>
            <div className="w-8" />
          </div>

          {/* Full-screen album art with swipe */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative flex-1 min-h-0"
              onTouchStart={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[role="slider"]') || target.closest('.seek-area')) return;
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
                  setPlayerSheetOpen(false);
                  return;
                }
                if (Math.abs(diffX) > 60) {
                  if (diffX < 0) skipPlaylistTrack();
                  else prevPlaylistTrack();
                }
              }}
            >
              <div className="absolute inset-0">
                <img src={currentItem.image} alt={currentItem.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/40" />
              </div>

              {/* Center play button */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <button onClick={togglePlaylistPlayback} className="w-16 h-16 rounded-full bg-background/30 backdrop-blur-md flex items-center justify-center border border-foreground/10 hover:bg-background/50 transition-all">
                  {isPlaylistPlaying ? <Pause className="w-7 h-7 text-foreground" /> : <Play className="w-7 h-7 text-foreground ml-1" />}
                </button>
              </div>

              {/* Track info & progress at bottom */}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 z-10">
                <div className="mb-3">
                  <h2 className="text-lg font-bold text-foreground drop-shadow-lg leading-tight">{currentItem.title}</h2>
                  <p className="text-sm text-foreground/80 drop-shadow-lg">{currentItem.artist}</p>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-background/40 backdrop-blur-sm text-primary font-medium mt-1 inline-block">{currentItem.type}</span>
                </div>

                {/* Seekable progress */}
                <div className="mb-3 seek-area" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.5}
                    onValueChange={handleSeek}
                    onValueCommit={() => setIsSeeking(false)}
                    className="w-full [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-primary [&_.relative]:h-1"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-foreground/70">{formatTime(currentTime)}</span>
                    <span className="text-[10px] text-foreground/70">-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom controls */}
          <div className="flex items-center justify-center gap-6 py-4 px-4 bg-background border-t border-border">
            <button onClick={prevPlaylistTrack} className="p-2 rounded-full hover:bg-primary/10 transition-colors">
              <SkipBack className="w-6 h-6 text-foreground" />
            </button>
            <button onClick={togglePlaylistPlayback} className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center glow-primary">
              {isPlaylistPlaying ? <Pause className="w-6 h-6 text-primary-foreground" /> : <Play className="w-6 h-6 text-primary-foreground ml-0.5" />}
            </button>
            <button onClick={skipPlaylistTrack} className="p-2 rounded-full hover:bg-primary/10 transition-colors">
              <SkipForward className="w-6 h-6 text-foreground" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PlaylistPlayerSheet;
