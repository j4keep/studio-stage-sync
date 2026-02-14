import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward, Heart, DollarSign, Radio as RadioIcon, Users, Shuffle, ArrowLeft, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRadio } from "@/contexts/RadioContext";
import { GENRES } from "@/lib/genres";
import { useLikes } from "@/hooks/use-likes";

const RADIO_GENRE_FILTERS = ["All", ...GENRES.filter(g => g !== "Beats")];

const RadioPage = () => {
  const navigate = useNavigate();
  const {
    isPlaying, currentTrack, queue, allTracks, toggle, skip, skipsLeft,
    playTrack, setGenreFilter, activeGenre, loading,
  } = useRadio();

  const songIds = allTracks.map(s => s.id);
  const { toggleLike, isLiked, getLikeCount } = useLikes("song", songIds);

  if (loading) {
    return (
      <div className="px-4 pt-4 flex flex-col items-center min-h-screen">
        <div className="py-20 text-center text-muted-foreground text-sm">Loading radio...</div>
      </div>
    );
  }

  if (!currentTrack) {
    return (
      <div className="px-4 pt-4 flex flex-col items-center min-h-screen">
        <div className="flex items-center justify-between w-full mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <RadioIcon className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-display font-bold text-foreground">WHEUAT Radio</h1>
          </div>
        </div>
        <div className="flex gap-2 w-full overflow-x-auto scrollbar-hide mb-6 pb-1">
          {RADIO_GENRE_FILTERS.map((g) => (
            <button key={g} onClick={() => setGenreFilter(g)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeGenre === g ? "gradient-primary text-primary-foreground glow-primary" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}>{g}</button>
          ))}
        </div>
        <div className="py-16 text-center">
          <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No songs on radio{activeGenre !== "All" ? ` for ${activeGenre}` : ""} yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">Artists can publish songs from their profile</p>
        </div>
      </div>
    );
  }

  const track = currentTrack;

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
            <Users className="w-3 h-3" /> {track.plays} plays
          </span>
        </div>
      </div>

      {/* Genre Filters */}
      <div className="flex gap-2 w-full overflow-x-auto scrollbar-hide mb-6 pb-1">
        {RADIO_GENRE_FILTERS.map((g) => (
          <button key={g} onClick={() => setGenreFilter(g)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeGenre === g ? "gradient-primary text-primary-foreground glow-primary" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}>{g}</button>
        ))}
      </div>

      {/* Now Playing Card */}
      <AnimatePresence mode="wait">
        <motion.div key={track.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="w-full max-w-sm">
          <div className="w-full aspect-square rounded-2xl overflow-hidden relative mb-5">
            <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <p className="text-sm font-bold text-foreground drop-shadow-lg">{track.title}</p>
              <p className="text-xs text-foreground/80 drop-shadow-lg">{track.artist_name}</p>
            </div>
            <div className="absolute top-3 right-3">
              <span className="text-[9px] px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm text-primary font-medium border border-primary/20">{track.genre}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full mb-5">
            <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
              <motion.div className="h-full gradient-primary rounded-full" animate={isPlaying ? { width: "100%" } : {}} transition={{ duration: 30, ease: "linear" }} style={{ width: isPlaying ? undefined : "15%" }} />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 mb-6">
            <button className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={() => toggleLike(track.id)} className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center transition-all hover:border-primary/30 relative">
              <Heart className={`w-5 h-5 transition-colors ${isLiked(track.id) ? "text-primary fill-primary" : "text-foreground"}`} />
              {getLikeCount(track.id) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">{getLikeCount(track.id)}</span>
              )}
            </button>
            <button onClick={toggle} className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center glow-primary-strong">
              {isPlaying ? <Pause className="w-7 h-7 text-primary-foreground" /> : <Play className="w-7 h-7 text-primary-foreground ml-1" />}
            </button>
            <button onClick={skip} disabled={skipsLeft === 0 || allTracks.length <= 1} className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-30">
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
              <Heart className="w-4 h-4" /> Support Artist
            </button>
            <button className="flex-1 py-3 rounded-xl bg-card border border-border text-foreground text-sm font-semibold hover:border-primary/30 transition-colors flex items-center justify-center gap-2">
              <DollarSign className="w-4 h-4" /> Tip
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Up Next */}
      {queue.length > 0 && (
        <div className="w-full mt-2 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">Up Next</h3>
            <span className="text-[10px] text-muted-foreground">{queue.length} tracks</span>
          </div>
          <div className="flex flex-col gap-2">
            {queue.slice(0, 4).map((t) => (
              <button key={t.id} onClick={() => playTrack(t)} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all w-full text-left group">
                <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
                  <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.artist_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); toggleLike(t.id); }} className="flex items-center gap-1">
                    <Heart className={`w-4 h-4 transition-colors ${isLiked(t.id) ? "text-primary fill-primary" : "text-foreground"}`} />
                    <span className="text-xs text-foreground">{getLikeCount(t.id)}</span>
                  </button>
                  <span className="text-xs text-foreground">{t.plays} plays</span>
                </div>
                <span className="text-[10px] text-primary mr-1">{t.genre}</span>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-3 h-3 text-primary fill-primary" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RadioPage;
