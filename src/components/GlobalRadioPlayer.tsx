import { useRadio } from "@/contexts/RadioContext";
import { ChevronDown, ChevronUp, Pause, Play, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useLocation } from "react-router-dom";

const GlobalRadioPlayer = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const {
    isPlaying,
    currentTrack,
    toggle,
    skip,
    currentTime,
    duration,
    stationMode,
    stationName,
  } = useRadio();

  // This player belongs to creator Radio/Podcast stations only.
  // Do not let it follow users across Home, Explore, YAJ AI, Profile, etc.
  const isStationArea =
    location.pathname === "/radio/stations" ||
    location.pathname.startsWith("/radio/stations/") ||
    location.pathname === "/podcast/live" ||
    location.pathname.startsWith("/podcast/room/") ||
    location.pathname.startsWith("/podcast/join/");

  if (!currentTrack || !stationMode || !isStationArea) return null;

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 90, opacity: 0 }}
        className={
          "fixed bottom-[4.55rem] left-0 right-0 z-[70] mx-auto w-full px-3 " +
          (collapsed ? "max-w-[220px]" : "max-w-2xl")
        }
      >
        <div className="overflow-hidden rounded-[22px] border border-border/70 bg-background/92 shadow-2xl backdrop-blur-2xl">
          {!collapsed && (
            <div
              aria-label="Station playback progress"
              className="block h-1.5 w-full bg-muted/80"
            >
              <span
                className="block h-full rounded-r-full bg-primary transition-[width] duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}

          <div className={"flex items-center gap-3 px-3 " + (collapsed ? "min-h-[46px] py-1.5" : "min-h-[62px] py-2")}>
            {!collapsed && (
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
                <img src={currentTrack.cover_url} alt="" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13px] font-black text-foreground">
                {collapsed ? (stationName || "Station") : currentTrack.title}
              </p>
              {!collapsed && (
                <p className="truncate text-[11px] font-medium text-muted-foreground">
                  {stationMode && stationName ? stationName : currentTrack.artist_name}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={toggle}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground active:scale-95"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>

            {!stationMode && !collapsed && (
              <button
                type="button"
                onClick={skip}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground active:scale-95"
                aria-label="Next"
              >
                <SkipForward className="h-5 w-5 fill-current" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
              aria-label={collapsed ? "Expand station player" : "Collapse station player"}
            >
              {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GlobalRadioPlayer;
