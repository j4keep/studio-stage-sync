import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ChevronDown, SkipForward, SkipBack } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { PlaylistItem } from "@/contexts/PlaylistContext";

const formatTime = (s: number) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

interface PlaylistPlayerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PlaylistItem[];
  startIndex: number;
}

const PlaylistPlayerSheet = ({ open, onOpenChange, items, startIndex }: PlaylistPlayerSheetProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const swipeStartX = useRef<number | null>(null);

  const currentItem = items[currentIndex] || null;

  // Reset index when sheet opens with a new startIndex
  useEffect(() => {
    if (open) {
      setCurrentIndex(startIndex);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [open, startIndex]);

  // Create audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("durationchange", () => setDuration(audio.duration));

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Auto-advance on ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (items.length > 1) {
        setCurrentIndex(prev => (prev + 1) % items.length);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [items.length]);

  // Load and play track when index changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentItem || !open) return;

    setCurrentTime(0);
    setDuration(0);

    if (currentItem.audioUrl) {
      audio.src = currentItem.audioUrl;
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audio.src = "";
      setIsPlaying(false);
    }
  }, [currentIndex, currentItem?.id, open]);

  // Pause when sheet closes
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [open]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const goNext = () => {
    if (items.length > 1) {
      setCurrentIndex(prev => (prev + 1) % items.length);
    }
  };

  const goPrev = () => {
    if (items.length > 1) {
      setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
    }
  };

  if (!currentItem) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-background border-none p-0 h-screen max-h-screen [&>button]:hidden">
        <div className="flex flex-col h-full relative">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 flex items-center">
            <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center">
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
              onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (swipeStartX.current === null) return;
                const diff = e.changedTouches[0].clientX - swipeStartX.current;
                swipeStartX.current = null;
                if (Math.abs(diff) > 60) {
                  if (diff < 0) goNext();
                  else goPrev();
                }
              }}
            >
              <div className="absolute inset-0">
                <img src={currentItem.image} alt={currentItem.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/40" />
              </div>

              {/* Center play button */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <button onClick={togglePlayPause} className="w-16 h-16 rounded-full bg-background/30 backdrop-blur-md flex items-center justify-center border border-foreground/10 hover:bg-background/50 transition-all">
                  {isPlaying ? <Pause className="w-7 h-7 text-foreground" /> : <Play className="w-7 h-7 text-foreground ml-1" />}
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
                <div className="mb-3">
                  <Slider
                    value={[isSeeking ? undefined as any : currentTime]}
                    max={duration || 100}
                    step={0.5}
                    onValueChange={(v) => {
                      setIsSeeking(true);
                      if (audioRef.current) {
                        audioRef.current.currentTime = v[0];
                        setCurrentTime(v[0]);
                      }
                    }}
                    onValueCommit={() => setIsSeeking(false)}
                    className="w-full [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-primary [&_.relative]:h-1"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-foreground/70">{formatTime(currentTime)}</span>
                    <span className="text-[10px] text-foreground/70">{duration > 0 ? formatTime(duration) : currentItem.duration}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom controls */}
          <div className="flex items-center justify-center gap-6 py-4 px-4 bg-background border-t border-border">
            <button onClick={goPrev} className="p-2 rounded-full hover:bg-primary/10 transition-colors">
              <SkipBack className="w-6 h-6 text-foreground" />
            </button>
            <button onClick={togglePlayPause} className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center glow-primary">
              {isPlaying ? <Pause className="w-6 h-6 text-primary-foreground" /> : <Play className="w-6 h-6 text-primary-foreground ml-0.5" />}
            </button>
            <button onClick={goNext} className="p-2 rounded-full hover:bg-primary/10 transition-colors">
              <SkipForward className="w-6 h-6 text-foreground" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PlaylistPlayerSheet;
