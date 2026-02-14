import { useRadio } from "@/contexts/RadioContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Play, Pause, SkipForward, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GlobalRadioPlayer = () => {
  const { isPlaying, currentTrack, toggle, skip, skipsLeft, pause } = useRadio();
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
        className="fixed bottom-16 left-0 right-0 z-40 px-3 pb-1 max-w-lg mx-auto"
      >
        <div
          onClick={() => navigate("/radio")}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-card/95 backdrop-blur-xl border border-border shadow-lg cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
            <img src={currentTrack.cover_url} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{currentTrack.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{currentTrack.artist_name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); toggle(); }}
              className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-primary-foreground" /> : <Play className="w-3.5 h-3.5 text-primary-foreground ml-0.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); skip(); }}
              disabled={skipsLeft === 0}
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-foreground disabled:opacity-30"
            >
              <SkipForward className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); pause(); }}
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GlobalRadioPlayer;
