import { motion } from "framer-motion";
import { Play, Heart, TrendingUp, Music, Mic2, Building2, FolderHeart } from "lucide-react";
import whetuatLogo from "@/assets/wheuat-logo.png";

const trendingArtists = [
  { name: "Kaia Noir", genre: "R&B", img: "" },
  { name: "Zephyr Cole", genre: "Hip Hop", img: "" },
  { name: "Luna Ray", genre: "Neo Soul", img: "" },
  { name: "Dex Marley", genre: "Reggae", img: "" },
  { name: "Aria West", genre: "Pop", img: "" },
];

const newSongs = [
  { title: "Midnight Glow", artist: "Kaia Noir", plays: "12.4K" },
  { title: "City Lights", artist: "Zephyr Cole", plays: "8.2K" },
  { title: "Golden Hour", artist: "Luna Ray", plays: "15.1K" },
  { title: "Rise Up", artist: "Dex Marley", plays: "6.7K" },
];

const projects = [
  { title: "Debut Album Fund", artist: "Aria West", goal: 5000, raised: 3200 },
  { title: "Music Video Production", artist: "Kaia Noir", goal: 8000, raised: 5600 },
];

const studios = [
  { name: "Sunset Sound Lab", rate: "$75/hr", location: "Los Angeles, CA" },
  { name: "Blue Room Studios", rate: "$50/hr", location: "Atlanta, GA" },
];

const ArtistAvatar = ({ name, genre }: { name: string; genre: string }) => {
  const initials = name.split(" ").map(n => n[0]).join("");
  return (
    <div className="flex flex-col items-center gap-2 min-w-[80px]">
      <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-display font-bold text-lg glow-primary">
        {initials}
      </div>
      <span className="text-xs font-medium text-foreground truncate w-full text-center">{name}</span>
      <span className="text-[10px] text-muted-foreground -mt-1">{genre}</span>
    </div>
  );
};

const SongCard = ({ title, artist, plays }: { title: string; artist: string; plays: string }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group">
    <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center shrink-0">
      <Music className="w-5 h-5 text-primary-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground truncate">{title}</p>
      <p className="text-xs text-muted-foreground">{artist}</p>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">{plays}</span>
      <button className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Play className="w-3.5 h-3.5 text-primary fill-primary" />
      </button>
    </div>
  </div>
);

const HomePage = () => {
  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <img src={whetuatLogo} alt="WHEUAT" className="h-8" />
        </div>
        <p className="text-[10px] text-muted-foreground italic">Together We Show Up</p>
      </div>

      {/* Trending Artists */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-bold text-foreground">Trending Artists</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {trendingArtists.map((a) => (
            <ArtistAvatar key={a.name} {...a} />
          ))}
        </div>
      </motion.section>

      {/* New Songs */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <Music className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-bold text-foreground">New Songs</h2>
        </div>
        <div className="flex flex-col gap-2">
          {newSongs.map((s) => (
            <SongCard key={s.title} {...s} />
          ))}
        </div>
      </motion.section>

      {/* Projects Seeking Support */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <FolderHeart className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-bold text-foreground">Projects Seeking Support</h2>
        </div>
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <div key={p.title} className="p-4 rounded-xl bg-card border border-border">
              <p className="text-sm font-semibold text-foreground">{p.title}</p>
              <p className="text-xs text-muted-foreground mb-3">by {p.artist}</p>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-2">
                <div
                  className="h-full rounded-full gradient-primary"
                  style={{ width: `${(p.raised / p.goal) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>${p.raised.toLocaleString()} raised</span>
                <span>${p.goal.toLocaleString()} goal</span>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Featured Studios */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="text-base font-display font-bold text-foreground">Featured Studios</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {studios.map((s) => (
            <div key={s.name} className="min-w-[200px] p-4 rounded-xl bg-card border border-border">
              <div className="w-full h-24 rounded-lg bg-muted mb-3 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">{s.name}</p>
              <p className="text-xs text-primary font-medium">{s.rate}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.location}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
};

export default HomePage;
