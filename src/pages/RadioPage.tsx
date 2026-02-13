import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward, Heart, DollarSign, Radio as RadioIcon, Users, ChevronDown, Shuffle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import artist1 from "@/assets/artist-1.jpg";
import artist2 from "@/assets/artist-2.jpg";
import artist3 from "@/assets/artist-3.jpg";
import artist4 from "@/assets/artist-4.jpg";
import artist5 from "@/assets/artist-5.jpg";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import album5 from "@/assets/album-5.jpg";

const genres = ["All", "R&B", "Hip Hop", "Neo Soul", "Reggae", "Pop"];

const playlist = [
  { title: "Midnight Glow", artist: "Kaia Noir", genre: "R&B", listeners: "1.2K", albumImg: album1, artistImg: artist1 },
  { title: "City Lights", artist: "Zephyr Cole", genre: "Hip Hop", listeners: "890", albumImg: album2, artistImg: artist2 },
  { title: "Golden Hour", artist: "Luna Ray", genre: "Neo Soul", listeners: "2.1K", albumImg: album3, artistImg: artist3 },
  { title: "Rise Up", artist: "Dex Marley", genre: "Reggae", listeners: "1.5K", albumImg: album4, artistImg: artist4 },
  { title: "Electric Dreams", artist: "Aria West", genre: "Pop", listeners: "3.4K", albumImg: album5, artistImg: artist5 },
];

const RadioPage = () => {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(6);
  const [activeGenre, setActiveGenre] = useState("All");
  const [liked, setLiked] = useState<Set<number>>(new Set());

  const track = playlist[currentTrack];

  const handleSkip = () => {
    if (skipsLeft > 0) {
      setCurrentTrack((prev) => (prev + 1) % playlist.length);
      setSkipsLeft((s) => s - 1);
    }
  };

  const toggleLike = (idx: number) => {
    setLiked(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const filteredQueue = playlist
    .map((t, i) => ({ ...t, idx: i }))
    .filter((t) => t.idx !== currentTrack && (activeGenre === "All" || t.genre === activeGenre));

  return (
    <div className="px-4 pt-4 flex flex-col items-center min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <RadioIcon className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-display font-bold text-foreground">WHEUAT Radio</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">LIVE</span>
          <span className="text-[10px] text-muted-foreground ml-1 flex items-center gap-1">
            <Users className="w-3 h-3" /> {track.listeners} listening
          </span>
        </div>
      </div>

      {/* Genre Filters */}
      <div className="flex gap-2 w-full overflow-x-auto scrollbar-hide mb-6 pb-1">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGenre(g)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeGenre === g
                ? "gradient-primary text-primary-foreground glow-primary"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Now Playing Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTrack}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          {/* Album Art */}
          <div className="w-full aspect-square rounded-2xl overflow-hidden relative mb-5">
            <img src={track.albumImg} alt={track.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            {/* Floating Artist Badge */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/50">
                <img src={track.artistImg} alt={track.artist} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground drop-shadow-lg">{track.title}</p>
                <p className="text-xs text-foreground/80 drop-shadow-lg">{track.artist}</p>
              </div>
            </div>
            <div className="absolute top-3 right-3">
              <span className="text-[9px] px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm text-primary font-medium border border-primary/20">
                {track.genre}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full mb-5">
            <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full gradient-primary rounded-full"
                animate={isPlaying ? { width: "100%" } : {}}
                transition={{ duration: 30, ease: "linear" }}
                style={{ width: isPlaying ? undefined : "15%" }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
              <span>0:45</span>
              <span>3:22</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 mb-6">
            <button className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleLike(currentTrack)}
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center transition-all hover:border-primary/30"
            >
              <Heart className={`w-4 h-4 transition-colors ${liked.has(currentTrack) ? "text-primary fill-primary" : "text-muted-foreground"}`} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center glow-primary-strong"
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
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-30 disabled:hover:text-muted-foreground"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-lg font-display font-bold text-foreground">{skipsLeft}</span>
              <span className="text-[8px] text-muted-foreground -mt-0.5">skips</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 w-full mb-6">
            <button className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 glow-primary">
              <Heart className="w-4 h-4" />
              Support Artist
            </button>
            <button className="flex-1 py-3 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-primary/30 transition-colors flex items-center justify-center gap-2">
              <DollarSign className="w-4 h-4" />
              Tip
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Up Next */}
      <div className="w-full mt-2 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">Up Next</h3>
          <span className="text-[10px] text-muted-foreground">{filteredQueue.length} tracks</span>
        </div>
        <div className="flex flex-col gap-2">
          {filteredQueue.slice(0, 4).map((t, i) => (
            <button
              key={t.title}
              onClick={() => { setCurrentTrack(t.idx); setIsPlaying(true); }}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all w-full text-left group"
            >
              <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
                <img src={t.albumImg} alt={t.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.artist}</p>
              </div>
              <span className="text-[10px] text-primary mr-1">{t.genre}</span>
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-3 h-3 text-primary fill-primary" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RadioPage;
