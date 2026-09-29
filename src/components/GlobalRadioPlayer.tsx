import { useRadio } from "@/contexts/RadioContext";
import { Pause, Play, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const GlobalRadioPlayer = () => {
  const {
    isPlaying,
    currentTrack,
    toggle,
    skip,
    currentTime,
    duration,
    seek,
    stationMode,
    stationName,
  } = useRadio();

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 90, opacity: 0 }}
        className="fixed bottom-[4.55rem] left-0 right-0 z-[70] mx-auto w-full max-w-2xl px-3"
      >
        <div className="overflow-hidden rounded-[22px] border border-border/70 bg-background/92 shadow-2xl backdrop-blur-2xl">
          <button
            type="button"
            aria-label="Seek radio playback"
            onClick={(event) => {
              if (!duration) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
              seek(ratio * duration);
            }}
            className="block h-1.5 w-full bg-muted/80"
          >
            <span
              className="block h-full rounded-r-full bg-primary transition-[width] duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </button>

          <div className="flex min-h-[62px] items-center gap-3 px-3 py-2">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
              <img src={currentTrack.cover_url} alt="" className="h-full w-full object-cover" />
            </div>

            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13px] font-black text-foreground">{currentTrack.title}</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {stationMode && stationName ? stationName : currentTrack.artist_name}
              </p>
            </div>

            <button
              type="button"
              onClick={toggle}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground active:scale-95"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>

            {!stationMode && (
              <button
                type="button"
                onClick={skip}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground active:scale-95"
                aria-label="Next"
              >
                <SkipForward className="h-5 w-5 fill-current" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GlobalRadioPlayer;
