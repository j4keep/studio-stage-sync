import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipForward, Heart, DollarSign, Radio as RadioIcon } from "lucide-react";

const playlist = [
  { title: "Midnight Glow", artist: "Kaia Noir", genre: "R&B" },
  { title: "City Lights", artist: "Zephyr Cole", genre: "Hip Hop" },
  { title: "Golden Hour", artist: "Luna Ray", genre: "Neo Soul" },
  { title: "Rise Up", artist: "Dex Marley", genre: "Reggae" },
  { title: "Electric Dreams", artist: "Aria West", genre: "Pop" },
];

const RadioPage = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(6);

  const track = playlist[currentTrack];

  const handleSkip = () => {
    if (skipsLeft > 0) {
      setCurrentTrack((prev) => (prev + 1) % playlist.length);
      setSkipsLeft((s) => s - 1);
    }
  };

  return (
    <div className="px-4 pt-6 flex flex-col items-center min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8 self-start">
        <RadioIcon className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-display font-bold text-foreground">WHEUAT Radio</h1>
      </div>

      {/* Now Playing Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        {/* Album Art */}
        <div className="w-full aspect-square rounded-2xl gradient-primary flex items-center justify-center mb-6 glow-primary-strong relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/60" />
          <motion.div
            animate={isPlaying ? { rotate: 360 } : {}}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-32 h-32 rounded-full bg-background/20 border-4 border-foreground/10 flex items-center justify-center"
          >
            <div className="w-8 h-8 rounded-full bg-background" />
          </motion.div>
        </div>

        {/* Track Info */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-display font-bold text-foreground">{track.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{track.artist}</p>
          <span className="inline-block mt-2 text-[10px] px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {track.genre}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full mb-6">
          <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full gradient-primary rounded-full"
              animate={isPlaying ? { width: "100%" } : {}}
              transition={{ duration: 30, ease: "linear" }}
              style={{ width: isPlaying ? undefined : "15%" }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0:45</span>
            <span>3:22</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <button className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
            <Heart className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center glow-primary animate-pulse-glow"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-primary-foreground" />
            ) : (
              <Play className="w-7 h-7 text-primary-foreground ml-1" />
            )}
          </button>
          <button
            onClick={handleSkip}
            disabled={skipsLeft === 0}
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mb-6">
          {skipsLeft} skips remaining
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full">
          <button className="flex-1 py-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2">
            <Heart className="w-4 h-4" />
            Support Artist
          </button>
          <button className="flex-1 py-3 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-primary/30 transition-colors flex items-center justify-center gap-2">
            <DollarSign className="w-4 h-4" />
            Tip
          </button>
        </div>
      </motion.div>

      {/* Up Next */}
      <div className="w-full mt-8 mb-4">
        <h3 className="text-sm font-display font-bold text-foreground mb-3">Up Next</h3>
        <div className="flex flex-col gap-2">
          {playlist.filter((_, i) => i !== currentTrack).slice(0, 3).map((t, i) => (
            <div key={t.title} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.artist}</p>
              </div>
              <span className="text-[10px] text-primary">{t.genre}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RadioPage;
