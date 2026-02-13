import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Heart, TrendingUp, Music, Mic2, Video, DollarSign, ChevronRight, Headphones, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import whetuatLogo from "@/assets/wheuat-logo.png";
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
import podcast1 from "@/assets/podcast-1.jpg";
import podcast2 from "@/assets/podcast-2.jpg";
import musicvideo1 from "@/assets/musicvideo-1.jpg";
import musicvideo2 from "@/assets/musicvideo-2.jpg";

const trendingArtists = [
  { name: "Kaia Noir", genre: "R&B", img: artist1 },
  { name: "Zephyr Cole", genre: "Hip Hop", img: artist2 },
  { name: "Luna Ray", genre: "Neo Soul", img: artist3 },
  { name: "Dex Marley", genre: "Reggae", img: artist4 },
  { name: "Aria West", genre: "Pop", img: artist5 },
];

const newSongs = [
  { title: "Midnight Glow", artist: "Kaia Noir", plays: "12.4K", img: album1 },
  { title: "City Lights", artist: "Zephyr Cole", plays: "8.2K", img: album2 },
  { title: "Golden Hour", artist: "Luna Ray", plays: "15.1K", img: album3 },
  { title: "Rise Up", artist: "Dex Marley", plays: "6.7K", img: album4 },
];

const podcasts = [
  { title: "The Indie Hustle", host: "Marcus James", episodes: 24, img: podcast1 },
  { title: "Studio Sessions", host: "Ava Monroe", episodes: 18, img: podcast2 },
];

const musicVideos = [
  { title: "Midnight Glow (Official)", artist: "Kaia Noir", views: "45K", img: musicvideo1 },
  { title: "Rise Up (Live)", artist: "Dex Marley", views: "32K", img: musicvideo2 },
];

const projects = [
  { title: "Debut Album Fund", artist: "Aria West", goal: 5000, raised: 3200, img: artist5 },
  { title: "Music Video Production", artist: "Kaia Noir", goal: 8000, raised: 5600, img: artist1 },
];

const nowPlaying = { title: "Midnight Glow", artist: "Kaia Noir", img: album1 };

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const HomePage = () => {
  const navigate = useNavigate();
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());

  const toggleLike = (title: string) => {
    setLikedSongs(prev => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  };

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <img src={whetuatLogo} alt="WHEUAT" className="h-8" />
        <p className="text-[10px] text-muted-foreground italic">Together We Show Up</p>
      </div>

      {/* WHEUAT Radio Mini Player */}
      <motion.section {...fadeUp} className="mb-8">
        <button
          onClick={() => navigate("/radio")}
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 hover:border-primary/40 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
              <img src={nowPlaying.img} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-background/30 flex items-center justify-center">
                <motion.div
                  animate={isRadioPlaying ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Headphones className="w-5 h-5 text-primary" />
                </motion.div>
              </div>
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">WHEUAT Radio</span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] text-muted-foreground">LIVE</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{nowPlaying.title}</p>
              <p className="text-xs text-muted-foreground">{nowPlaying.artist}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setIsRadioPlaying(!isRadioPlaying); }}
              className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center glow-primary shrink-0"
            >
              {isRadioPlaying ? <Pause className="w-4 h-4 text-primary-foreground" /> : <Play className="w-4 h-4 text-primary-foreground ml-0.5" />}
            </button>
          </div>
        </button>
      </motion.section>

      {/* Trending Artists */}
      <motion.section {...fadeUp} transition={{ delay: 0.05 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">Trending Artists</h2>
          </div>
          <button className="text-[10px] text-primary flex items-center gap-0.5">See All <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {trendingArtists.map((a) => (
            <button key={a.name} className="flex flex-col items-center gap-2 min-w-[72px] group">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all glow-primary">
                <img src={a.img} alt={a.name} className="w-full h-full object-cover" />
              </div>
              <span className="text-[11px] font-medium text-foreground truncate w-full text-center">{a.name}</span>
              <span className="text-[9px] text-muted-foreground -mt-1.5">{a.genre}</span>
            </button>
          ))}
        </div>
      </motion.section>

      {/* New Songs */}
      <motion.section {...fadeUp} transition={{ delay: 0.1 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">New Songs</h2>
          </div>
          <button className="text-[10px] text-primary flex items-center gap-0.5">See All <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="flex flex-col gap-2">
          {newSongs.map((s) => (
            <button key={s.title} onClick={() => toggleLike(s.title)} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group w-full text-left">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img src={s.img} alt={s.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{s.plays}</span>
                <Heart className={`w-3.5 h-3.5 transition-colors ${likedSongs.has(s.title) ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Play className="w-3.5 h-3.5 text-primary fill-primary" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* New Podcasts */}
      <motion.section {...fadeUp} transition={{ delay: 0.15 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">New Podcasts</h2>
          </div>
          <button className="text-[10px] text-primary flex items-center gap-0.5">See All <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {podcasts.map((p) => (
            <button key={p.title} className="min-w-[200px] rounded-xl bg-card border border-border overflow-hidden hover:border-primary/30 transition-all group text-left">
              <div className="w-full h-28 overflow-hidden">
                <img src={p.img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.host}</p>
                <p className="text-[10px] text-primary mt-1">{p.episodes} episodes</p>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* New Music Videos */}
      <motion.section {...fadeUp} transition={{ delay: 0.2 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">New Music Videos</h2>
          </div>
          <button className="text-[10px] text-primary flex items-center gap-0.5">See All <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {musicVideos.map((v) => (
            <button key={v.title} className="min-w-[240px] rounded-xl bg-card border border-border overflow-hidden hover:border-primary/30 transition-all group text-left">
              <div className="relative w-full h-32 overflow-hidden">
                <img src={v.img} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{v.title}</p>
                    <p className="text-[10px] text-muted-foreground">{v.artist}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground" />
                  </div>
                </div>
              </div>
              <div className="px-3 py-2 flex items-center gap-1">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{v.views} views</span>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Projects Seeking Funding */}
      <motion.section {...fadeUp} transition={{ delay: 0.25 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">Projects Seeking Funding</h2>
          </div>
          <button onClick={() => navigate("/projects")} className="text-[10px] text-primary flex items-center gap-0.5">See All <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <button key={p.title} onClick={() => navigate("/projects")} className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all w-full text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                  <img src={p.img} alt={p.artist} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="text-xs text-muted-foreground">by {p.artist}</p>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-2">
                <div className="h-full rounded-full gradient-primary" style={{ width: `${(p.raised / p.goal) * 100}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>${p.raised.toLocaleString()} raised</span>
                <span className="text-primary font-medium">{Math.round((p.raised / p.goal) * 100)}%</span>
                <span>${p.goal.toLocaleString()} goal</span>
              </div>
            </button>
          ))}
        </div>
      </motion.section>
    </div>
  );
};

export default HomePage;
