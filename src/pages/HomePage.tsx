import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Heart, TrendingUp, Music, Mic2, Video, DollarSign, ChevronRight, Headphones, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLikes, incrementSongPlays } from "@/hooks/use-likes";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import { useRadio } from "@/contexts/RadioContext";
import { useAuth } from "@/contexts/AuthContext";
import whetuatLogo from "@/assets/wheuat-logo.png";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import podcast1 from "@/assets/podcast-1.jpg";
import podcast2 from "@/assets/podcast-2.jpg";
import musicvideo1 from "@/assets/musicvideo-1.jpg";
import musicvideo2 from "@/assets/musicvideo-2.jpg";
import artist5 from "@/assets/artist-5.jpg";
import artist1 from "@/assets/artist-1.jpg";

const fallbackSongs = [
  { id: "fs1", title: "Midnight Glow", artist_name: "Kaia Noir", plays: "12.4K", cover_url: album1, likes_count: 0 },
  { id: "fs2", title: "City Lights", artist_name: "Zephyr Cole", plays: "8.2K", cover_url: album2, likes_count: 0 },
  { id: "fs3", title: "Golden Hour", artist_name: "Luna Ray", plays: "15.1K", cover_url: album3, likes_count: 0 },
  { id: "fs4", title: "Rise Up", artist_name: "Dex Marley", plays: "6.7K", cover_url: album4, likes_count: 0 },
];

const fallbackPodcasts = [
  { id: "f1", title: "The Indie Hustle", subtitle: "Marcus James", img: podcast1 },
  { id: "f2", title: "Studio Sessions", subtitle: "Ava Monroe", img: podcast2 },
];

const fallbackVideos = [
  { id: "f1", title: "Midnight Glow (Official)", subtitle: "Kaia Noir", img: musicvideo1, views: "45K" },
  { id: "f2", title: "Rise Up (Live)", subtitle: "Dex Marley", img: musicvideo2, views: "32K" },
];

const projects = [
  { title: "Debut Album Fund", artist: "Aria West", goal: 5000, raised: 3200, img: artist5 },
  { title: "Music Video Production", artist: "Kaia Noir", goal: 8000, raised: 5600, img: artist1 },
];

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

interface CarouselItem {
  id: string;
  title: string;
  subtitle: string;
  img: string;
  likes_count?: number;
  views?: string;
  user_id?: string;
}

const AutoCarousel = ({ items, interval = 4000, onLike, isLiked, getLikeCount, onPlay }: { 
  items: CarouselItem[]; interval?: number;
  onLike?: (id: string) => void; isLiked?: (id: string) => boolean; getLikeCount?: (id: string) => number;
  onPlay?: (item: CarouselItem) => void;
}) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setCurrent(prev => (prev + 1) % items.length), interval);
    return () => clearInterval(timer);
  }, [items.length, interval]);

  useEffect(() => { if (current >= items.length) setCurrent(0); }, [items.length, current]);

  if (items.length === 0) return null;
  const safeIndex = current < items.length ? current : 0;
  const item = items[safeIndex];
  if (!item) return null;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-card border border-border">
      <div className="relative w-full h-48 overflow-hidden">
        <motion.img key={item.id + safeIndex} src={item.img} alt={item.title} className="w-full h-full object-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-14">
          <p className="text-sm font-display font-bold text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          <div className="flex items-center gap-3 mt-1">
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
          <button onClick={(e) => { e.stopPropagation(); onPlay?.(item); }} className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center glow-primary">
            <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground ml-0.5" />
          </button>
        </div>
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {items.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === safeIndex ? "w-4 bg-primary" : "bg-muted-foreground/30"}`} />
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
  user_id?: string;
}

interface TrendingArtist {
  id: string;
  name: string;
  img: string;
}

const fetchSongs = async (): Promise<DbSong[]> => {
  const { data } = await (supabase as any).from("songs").select("id, title, cover_url, audio_url, plays, user_id, likes_count")
    .order("created_at", { ascending: false }).limit(20);
  if (!data || data.length === 0) return [];
  const userIds = [...new Set(data.map((s: any) => s.user_id).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await (supabase as any).from("profiles").select("user_id, display_name").in("user_id", userIds);
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.display_name || "Artist"; });
  }
  return data.map((s: any) => ({
    id: s.id, title: s.title, artist_name: profileMap[s.user_id] || "Artist",
    plays: s.plays || "0", cover_url: s.cover_url || album1,
    audio_url: s.audio_url ? getR2DownloadUrl(s.audio_url) : undefined,
    likes_count: s.likes_count || 0, user_id: s.user_id,
  }));
};

const fetchVideos = async (): Promise<CarouselItem[]> => {
  const { data } = await (supabase as any).from("videos").select("id, title, cover_url, views, likes_count, user_id")
    .order("created_at", { ascending: false }).limit(20);
  if (!data || data.length === 0) return [];
  return data.map((v: any) => ({
    id: v.id, title: v.title, subtitle: "", img: v.cover_url || musicvideo1,
    likes_count: v.likes_count || 0, views: v.views || "0", user_id: v.user_id,
  }));
};

const fetchPodcasts = async (): Promise<CarouselItem[]> => {
  const { data } = await (supabase as any).from("podcasts").select("id, title, cover_url, plays, likes_count, user_id")
    .order("created_at", { ascending: false }).limit(20);
  if (!data || data.length === 0) return [];
  return data.map((p: any) => ({
    id: p.id, title: p.title, subtitle: "", img: p.cover_url || podcast1,
    likes_count: p.likes_count || 0, views: p.plays || "0", user_id: p.user_id,
  }));
};

const fetchTrendingArtists = async (userId?: string): Promise<TrendingArtist[]> => {
  const { data } = await (supabase as any).from("profiles").select("user_id, display_name, avatar_url")
    .order("created_at", { ascending: false }).limit(10);
  if (data && data.length > 0) {
    const filtered = data.filter((p: any) => p.display_name).map((p: any) => ({
      id: p.user_id, name: p.display_name, img: p.avatar_url || "",
    }));
    if (filtered.length > 0) return filtered;
  }
  if (userId) {
    const { data: profile } = await (supabase as any).from("profiles").select("user_id, display_name, avatar_url").eq("user_id", userId).maybeSingle();
    if (profile) return [{ id: profile.user_id, name: profile.display_name || "You", img: profile.avatar_url || "" }];
  }
  return [];
};

const HomePage = () => {
  const navigate = useNavigate();
  const radio = useRadio();
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const songAudioRef = useRef<HTMLAudioElement | null>(null);
  const playTracked = useRef<Set<string>>(new Set());
  const { user } = useAuth();

  const { data: dbSongs = [] } = useQuery({
    queryKey: ["homepage-songs"],
    queryFn: fetchSongs,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: dbVideos = [] } = useQuery({
    queryKey: ["homepage-videos"],
    queryFn: fetchVideos,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: dbPodcasts = [] } = useQuery({
    queryKey: ["homepage-podcasts"],
    queryFn: fetchPodcasts,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: trendingArtists = [] } = useQuery({
    queryKey: ["homepage-trending-artists", user?.id],
    queryFn: () => fetchTrendingArtists(user?.id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const songIds = dbSongs.map(s => s.id);
  const videoIds = dbVideos.map(v => v.id);
  const podcastIds = dbPodcasts.map(p => p.id);
  const songLikes = useLikes("song", songIds);
  const videoLikes = useLikes("video", videoIds);
  const podcastLikes = useLikes("podcast", podcastIds);

  const displaySongs: DbSong[] = dbSongs.length > 0 ? dbSongs : fallbackSongs;

  const videoCarouselItems: CarouselItem[] = dbVideos.length > 0 ? dbVideos : fallbackVideos.map(v => ({
    id: v.id, title: v.title, subtitle: v.subtitle, img: v.img, views: v.views,
  }));

  const podcastCarouselItems: CarouselItem[] = dbPodcasts.length > 0 ? dbPodcasts : fallbackPodcasts.map(p => ({
    id: p.id, title: p.title, subtitle: p.subtitle, img: p.img,
  }));

  // Song playback
  const handlePlaySong = (song: DbSong) => {
    if (playingSongId === song.id) {
      songAudioRef.current?.pause();
      setPlayingSongId(null);
      return;
    }
    if (!song.audio_url) return;
    if (!songAudioRef.current) songAudioRef.current = new Audio();
    songAudioRef.current.src = song.audio_url;
    songAudioRef.current.play().catch(() => {});
    setPlayingSongId(song.id);
    if (!playTracked.current.has(song.id)) {
      playTracked.current.add(song.id);
      incrementSongPlays(song.id);
    }
    songAudioRef.current.onended = () => setPlayingSongId(null);
  };

  useEffect(() => {
    return () => { songAudioRef.current?.pause(); };
  }, []);

  const currentRadioTrack = radio.currentTrack;

  const handlePlayVideo = (item: CarouselItem) => {
    // Navigate to video or play if has media
    if (item.user_id) navigate(`/profile?user=${item.user_id}`);
  };

  const handlePlayPodcast = (item: CarouselItem) => {
    if (item.user_id) navigate(`/profile?user=${item.user_id}`);
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
        <button onClick={() => navigate("/radio")} className="w-full p-4 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 hover:border-primary/40 transition-all group">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
              <img src={currentRadioTrack?.cover_url || album1} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-background/30 flex items-center justify-center">
                <motion.div animate={radio.isPlaying ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }}>
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
              <p className="text-sm font-semibold text-foreground">{currentRadioTrack?.title || "Tap to tune in"}</p>
              <p className="text-xs text-muted-foreground">{currentRadioTrack?.artist_name || ""}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); radio.toggle(); }} className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center glow-primary shrink-0">
              {radio.isPlaying ? <Pause className="w-4 h-4 text-primary-foreground" /> : <Play className="w-4 h-4 text-primary-foreground ml-0.5" />}
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
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {trendingArtists.length > 0 ? trendingArtists.map((a) => (
            <button key={a.id} onClick={() => navigate(`/profile?user=${a.id}`)} className="flex flex-col items-center gap-2 min-w-[72px] group">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all bg-muted">
                {a.img ? <img src={a.img} alt={a.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">{a.name[0]}</div>}
              </div>
              <span className="text-[11px] font-medium text-foreground truncate w-full text-center">{a.name}</span>
            </button>
          )) : (
            <p className="text-xs text-muted-foreground">No artists yet</p>
          )}
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
              <button onClick={() => s.user_id ? navigate(`/profile?user=${s.user_id}`) : null} className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover" />
              </button>
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
                <button onClick={() => handlePlaySong(s)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  {playingSongId === s.id ? <Pause className="w-3.5 h-3.5 text-primary" /> : <Play className="w-3.5 h-3.5 text-primary fill-primary" />}
                </button>
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
        <AutoCarousel items={videoCarouselItems} interval={5000}
          onLike={dbVideos.length > 0 ? videoLikes.toggleLike : undefined}
          isLiked={dbVideos.length > 0 ? videoLikes.isLiked : undefined}
          getLikeCount={dbVideos.length > 0 ? videoLikes.getLikeCount : undefined}
          onPlay={handlePlayVideo} />
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
        <AutoCarousel items={podcastCarouselItems} interval={6000}
          onLike={dbPodcasts.length > 0 ? podcastLikes.toggleLike : undefined}
          isLiked={dbPodcasts.length > 0 ? podcastLikes.isLiked : undefined}
          getLikeCount={dbPodcasts.length > 0 ? podcastLikes.getLikeCount : undefined}
          onPlay={handlePlayPodcast} />
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
