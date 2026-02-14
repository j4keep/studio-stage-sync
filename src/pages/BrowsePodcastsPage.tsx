import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Pause, Heart, Mic2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLikes } from "@/hooks/use-likes";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import podcast1 from "@/assets/podcast-1.jpg";

interface PodcastItem {
  id: string;
  title: string;
  subtitle: string;
  cover_url: string;
  media_url?: string;
  episode?: string;
  duration?: string;
  plays: string;
  likes_count: number;
  is_video?: boolean;
}

const fetchPodcasts = async (): Promise<PodcastItem[]> => {
  const { data, error } = await (supabase as any)
    .from("podcasts")
    .select("id, title, cover_url, media_url, plays, likes_count, user_id, is_video, episode, duration")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data || data.length === 0) return [];
  const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await (supabase as any).from("profiles").select("user_id, display_name").in("user_id", userIds);
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.display_name || ""; });
  }
  return data.map((p: any) => ({
    id: p.id, title: p.title, subtitle: profileMap[p.user_id] || "",
    cover_url: p.cover_url || podcast1,
    media_url: p.media_url ? getR2DownloadUrl(p.media_url) : undefined,
    episode: p.episode, duration: p.duration,
    plays: p.plays || "0", likes_count: p.likes_count || 0, is_video: p.is_video,
  }));
};

const BrowsePodcastsPage = () => {
  const navigate = useNavigate();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: podcasts = [], isLoading } = useQuery({
    queryKey: ["browse-podcasts"],
    queryFn: fetchPodcasts,
    staleTime: 30_000,
  });

  const podcastIds = podcasts.map(p => p.id);
  const { toggleLike, isLiked, getLikeCount } = useLikes("podcast", podcastIds);

  const handlePlay = (podcast: PodcastItem) => {
    if (!podcast.media_url) return;
    if (playingId === podcast.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = podcast.media_url;
    audioRef.current.play().catch(() => {});
    setPlayingId(podcast.id);
    audioRef.current.onended = () => setPlayingId(null);
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Podcasts</h1>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
      ) : podcasts.length === 0 ? (
        <div className="py-12 text-center">
          <Mic2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No podcasts yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {podcasts.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-all">
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                  <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.subtitle}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.episode && `Ep. ${p.episode} · `}{p.duration || ""} · {p.plays} plays
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleLike(p.id)} className="flex items-center gap-0.5">
                    <Heart className={`w-4 h-4 transition-colors ${isLiked(p.id) ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs text-muted-foreground">{getLikeCount(p.id)}</span>
                  </button>
                  <button onClick={() => handlePlay(p)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {playingId === p.id ? <Pause className="w-3.5 h-3.5 text-primary" /> : <Play className="w-3.5 h-3.5 text-primary fill-primary" />}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BrowsePodcastsPage;
