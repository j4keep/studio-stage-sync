import { useRadio } from "@/contexts/RadioContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Play, Pause, SkipForward, SkipBack, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GlobalRadioPlayer = () => {
  const { isPlaying, currentTrack, toggle, skip, previous, pause } = useRadio();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on the radio page itself (it has its own full UI)
  if (location.pathname === "/radio") return null;
  if (!currentTrack || !isPlaying) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-16 left-0 right-0 z-40 mx-auto max-w-lg px-3 pb-1"
      >
        <div
          onClick={() => navigate("/radio")}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur-xl"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
            <img src={currentTrack.cover_url} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{currentTrack.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">{currentTrack.artist_name}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                previous();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground"
              aria-label="Previous"
            >
              <SkipBack className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 text-primary-foreground" />
              ) : (
                <Play className="ml-0.5 h-3.5 w-3.5 text-primary-foreground" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                skip();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground"
              aria-label="Next"
            >
              <SkipForward className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pause();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GlobalRadioPlayer;
