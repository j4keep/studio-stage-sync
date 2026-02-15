import { usePlaylists } from "@/contexts/PlaylistContext";
import { useLocation } from "react-router-dom";
import { Play, Pause, SkipForward, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GlobalPlaylistPlayer = () => {
  const {
    nowPlaying, isPlaylistPlaying, togglePlaylistPlayback,
    skipPlaylistTrack, stopPlaylistPlayback, setPlayerSheetOpen,
  } = usePlaylists();
  const location = useLocation();

  // Hide on library page (it has its own full player)
  if (location.pathname === "/library" || location.pathname === "/playlists") return null;
  if (!nowPlaying || !isPlaylistPlaying) return null;

  const currentItem = nowPlaying.items[nowPlaying.index];
  if (!currentItem) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-16 left-0 right-0 z-40 px-3 pb-1 max-w-lg mx-auto"
      >
        <div
          onClick={() => setPlayerSheetOpen(true)}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-card/95 backdrop-blur-xl border border-border shadow-lg cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
            <img src={currentItem.image} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{currentItem.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{currentItem.artist}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); togglePlaylistPlayback(); }}
              className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center"
            >
              {isPlaylistPlaying ? <Pause className="w-3.5 h-3.5 text-primary-foreground" /> : <Play className="w-3.5 h-3.5 text-primary-foreground ml-0.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); skipPlaylistTrack(); }}
              className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-foreground"
            >
              <SkipForward className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); stopPlaylistPlayback(); }}
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

export default GlobalPlaylistPlayer;
