import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Heart, TrendingUp, Music, Mic2, Video, DollarSign, ChevronRight, Headphones, Users, ChevronLeft, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLikes, incrementSongPlays } from "@/hooks/use-likes";
import { getR2DownloadUrl } from "@/lib/r2-storage";
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

const fallbackSongs = [
  { id: "fs1", title: "Midnight Glow", artist: "Kaia Noir", plays: "12.4K", img: album1, likes_count: 0 },
  { id: "fs2", title: "City Lights", artist: "Zephyr Cole", plays: "8.2K", img: album2, likes_count: 0 },
  { id: "fs3", title: "Golden Hour", artist: "Luna Ray", plays: "15.1K", img: album3, likes_count: 0 },
  { id: "fs4", title: "Rise Up", artist: "Dex Marley", plays: "6.7K", img: album4, likes_count: 0 },
];

const fallbackPodcasts = [
  { id: "f1", title: "The Indie Hustle", host: "Marcus James", episodes: "24 episodes", img: podcast1 },
  { id: "f2", title: "Studio Sessions", host: "Ava Monroe", episodes: "18 episodes", img: podcast2 },
];

const fallbackVideos = [
  { id: "f1", title: "Midnight Glow (Official)", artist: "Kaia Noir", views: "45K", img: musicvideo1 },
  { id: "f2", title: "Rise Up (Live)", artist: "Dex Marley", views: "32K", img: musicvideo2 },
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

interface CarouselItem {
  id: string;
  title: string;
  subtitle: string;
  img: string;
  extra?: string;
  likes_count?: number;
  views?: string;
}

const AutoCarousel = ({ items, interval = 4000, contentType, onLike, isLiked, getLikeCount }: { 
  items: CarouselItem[]; 
  interval?: number;
  contentType?: "video" | "podcast";
  onLike?: (id: string) => void;
  isLiked?: (id: string) => boolean;
  getLikeCount?: (id: string) => number;
}) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setCurrent(prev => (prev + 1) % items.length), interval);
    return () => clearInterval(timer);
  }, [items.length, interval]);

  // Reset current if items shrink
  useEffect(() => {
    if (current >= items.length) setCurrent(0);
  }, [items.length, current]);

  if (items.length === 0) return null;

  const safeIndex = current < items.length ? current : 0;
  const item = items[safeIndex];
  if (!item) return null;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-card border border-border">
      <div className="relative w-full h-48 overflow-hidden">
        <motion.img
          key={item.id + safeIndex}
          src={item.img}
          alt={item.title}
          className="w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-14">
          <p className="text-sm font-display font-bold text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          <div className="flex items-center gap-3 mt-1">
            {item.extra && <p className="text-xs text-primary">{item.extra}</p>}
            {onLike && getLikeCount && isLiked && (
              <button onClick={(e) => { e.stopPropagation(); onLike(item.id); }} className="flex items-center gap-1">
                <Heart className={`w-4 h-4 transition-colors ${isLiked(item.id) ? "text-primary fill-primary" : "text-foreground"}`} />
                <span className="text-xs text-foreground">{getLikeCount(item.id)}</span>
              </button>
            )}
            {item.views && (
              <span className="text-xs text-foreground flex items-center gap-1">
                <Eye className="w-4 h-4" /> {item.views}
              </span>
            )}
          </div>
        </div>
        <div className="absolute bottom-3 right-3">
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center glow-primary">
            <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground ml-0.5" />
          </div>
        </div>
      </div>
      {/* Dots */}
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === safeIndex ? "w-4 bg-primary" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface DbSong {
  id: string;
  title: string;
  artist_name: string;
  plays: string;
  cover_url: string;
  audio_url?: string;
  likes_count: number;
}

const HomePage = () => {
  const navigate = useNavigate();
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [dbVideos, setDbVideos] = useState<CarouselItem[]>([]);
  const [dbPodcasts, setDbPodcasts] = useState<CarouselItem[]>([]);
  const [dbSongs, setDbSongs] = useState<DbSong[]>([]);

  // Collect IDs for likes
  const songIds = dbSongs.map(s => s.id);
  const videoIds = dbVideos.map(v => v.id);
  const podcastIds = dbPodcasts.map(p => p.id);
  const songLikes = useLikes("song", songIds);
  const videoLikes = useLikes("video", videoIds);
  const podcastLikes = useLikes("podcast", podcastIds);

  useEffect(() => {
    // Fetch songs from DB
    (supabase as any).from("songs").select("id, title, cover_url, audio_url, plays, user_id, likes_count")
      .order("created_at", { ascending: false }).limit(20)
      .then(async ({ data }: any) => {
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map((s: any) => s.user_id))];
          const { data: profiles } = await (supabase as any)
            .from("profiles").select("id, display_name").in("id", userIds);
          const profileMap: Record<string, string> = {};
          (profiles || []).forEach((p: any) => { profileMap[p.id] = p.display_name || "Artist"; });

          setDbSongs(data.map((s: any) => ({
            id: s.id,
            title: s.title,
            artist_name: profileMap[s.user_id] || "Artist",
            plays: s.plays || "0",
            cover_url: s.cover_url || album1,
            audio_url: s.audio_url ? getR2DownloadUrl(s.audio_url) : undefined,
            likes_count: s.likes_count || 0,
          })));
        }
      });

    // Fetch videos from DB
    (supabase as any).from("videos").select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          setDbVideos(data.map((v: any) => ({
            id: v.id,
            title: v.title,
            subtitle: v.views ? `${v.views} views` : "New",
            img: v.cover_url || musicvideo1,
            extra: v.duration || undefined,
            likes_count: v.likes_count || 0,
            views: v.views || "0",
          })));
        }
      });

    // Fetch podcasts from DB
    (supabase as any).from("podcasts").select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          setDbPodcasts(data.map((p: any) => ({
            id: p.id,
            title: p.title,
            subtitle: p.episode ? `Episode ${p.episode}` : "New Episode",
            img: p.cover_url || podcast1,
            extra: p.plays ? `${p.plays} plays` : undefined,
            likes_count: p.likes_count || 0,
            views: p.plays || "0",
          })));
        }
      });
  }, []);

  const videoCarouselItems: CarouselItem[] = dbVideos.length > 0 ? dbVideos : fallbackVideos.map(v => ({
    id: v.id, title: v.title, subtitle: v.artist || v.views || "", img: v.img, extra: v.views ? `${v.views} views` : undefined,
  }));

  const podcastCarouselItems: CarouselItem[] = dbPodcasts.length > 0 ? dbPodcasts : fallbackPodcasts.map(p => ({
    id: p.id, title: p.title, subtitle: p.host, img: p.img, extra: p.episodes,
  }));

  const displaySongs = dbSongs.length > 0 ? dbSongs : fallbackSongs.map(s => ({
    id: s.id, title: s.title, artist_name: s.artist, plays: s.plays, cover_url: s.img, likes_count: s.likes_count,
  }));

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
          {displaySongs.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group w-full text-left">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.artist_name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-foreground flex items-center gap-1">
                  <Play className="w-3.5 h-3.5" /> {s.plays}
                </span>
                <button onClick={() => dbSongs.length > 0 && songLikes.toggleLike(s.id)} className="flex items-center gap-1">
                  <Heart className={`w-4 h-4 transition-colors ${dbSongs.length > 0 && songLikes.isLiked(s.id) ? "text-primary fill-primary" : "text-foreground"}`} />
                  <span className="text-xs text-foreground">{dbSongs.length > 0 ? songLikes.getLikeCount(s.id) : s.likes_count}</span>
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Play className="w-3.5 h-3.5 text-primary fill-primary" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Music Videos Carousel */}
      <motion.section {...fadeUp} transition={{ delay: 0.15 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">Music Videos</h2>
          </div>
          <button className="text-[10px] text-primary flex items-center gap-0.5">See All <ChevronRight className="w-3 h-3" /></button>
        </div>
        <AutoCarousel 
          items={videoCarouselItems} 
          interval={5000} 
          contentType="video"
          onLike={dbVideos.length > 0 ? videoLikes.toggleLike : undefined}
          isLiked={dbVideos.length > 0 ? videoLikes.isLiked : undefined}
          getLikeCount={dbVideos.length > 0 ? videoLikes.getLikeCount : undefined}
        />
      </motion.section>

      {/* Podcasts Carousel */}
      <motion.section {...fadeUp} transition={{ delay: 0.2 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">Podcasts</h2>
          </div>
          <button className="text-[10px] text-primary flex items-center gap-0.5">See All <ChevronRight className="w-3 h-3" /></button>
        </div>
        <AutoCarousel 
          items={podcastCarouselItems} 
          interval={6000}
          contentType="podcast"
          onLike={dbPodcasts.length > 0 ? podcastLikes.toggleLike : undefined}
          isLiked={dbPodcasts.length > 0 ? podcastLikes.isLiked : undefined}
          getLikeCount={dbPodcasts.length > 0 ? podcastLikes.getLikeCount : undefined}
        />
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
