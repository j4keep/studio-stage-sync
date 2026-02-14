import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Pause, Heart, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLikes, incrementSongPlays } from "@/hooks/use-likes";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import album1 from "@/assets/album-1.jpg";

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

const fetchSongs = async (): Promise<DbSong[]> => {
  const { data, error } = await (supabase as any)
    .from("songs")
    .select("id, title, cover_url, audio_url, plays, user_id, likes_count")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data || data.length === 0) return [];
  const userIds = [...new Set(data.map((s: any) => s.user_id).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await (supabase as any).from("profiles").select("user_id, display_name").in("user_id", userIds);
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.display_name || "Artist"; });
  }
  return data.map((s: any) => ({
    id: s.id, title: s.title, artist_name: profileMap[s.user_id] || "Artist",
    plays: s.plays || "0",
    cover_url: (s.cover_url && s.cover_url.length < 500) ? s.cover_url : (s.cover_url?.startsWith("data:") ? s.cover_url : album1),
    audio_url: s.audio_url ? getR2DownloadUrl(s.audio_url) : undefined,
    likes_count: s.likes_count || 0, user_id: s.user_id,
  }));
};

const BrowseSongsPage = () => {
  const navigate = useNavigate();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTracked = useRef<Set<string>>(new Set());

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["browse-songs"],
    queryFn: fetchSongs,
    staleTime: 30_000,
  });

  const songIds = songs.map(s => s.id);
  const { toggleLike, isLiked, getLikeCount } = useLikes("song", songIds);

  const handlePlay = (song: DbSong) => {
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!song.audio_url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = song.audio_url;
    audioRef.current.play().catch(() => {});
    setPlayingId(song.id);
    if (!playTracked.current.has(song.id)) {
      playTracked.current.add(song.id);
      incrementSongPlays(song.id);
    }
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
        <h1 className="text-lg font-display font-bold text-foreground">New Songs</h1>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
      ) : songs.length === 0 ? (
        <div className="py-12 text-center">
          <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No songs yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {songs.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-all">
                <button onClick={() => s.user_id ? navigate(`/profile?user=${s.user_id}`) : null} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                  <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.artist_name}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Play className="w-3 h-3" /> {s.plays}
                  </span>
                  <button onClick={() => toggleLike(s.id)} className="flex items-center gap-0.5">
                    <Heart className={`w-4 h-4 transition-colors ${isLiked(s.id) ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs text-muted-foreground">{getLikeCount(s.id)}</span>
                  </button>
                  <button onClick={() => handlePlay(s)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {playingId === s.id ? <Pause className="w-3.5 h-3.5 text-primary" /> : <Play className="w-3.5 h-3.5 text-primary fill-primary" />}
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

export default BrowseSongsPage;
