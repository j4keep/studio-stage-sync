import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Heart, Eye, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLikes, incrementVideoViews } from "@/hooks/use-likes";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import musicvideo1 from "@/assets/musicvideo-1.jpg";

interface VideoItem {
  id: string;
  title: string;
  subtitle: string;
  cover_url: string;
  video_url?: string;
  views: string;
  likes_count: number;
  user_id?: string;
}

const fetchVideos = async (): Promise<VideoItem[]> => {
  const { data, error } = await (supabase as any)
    .from("videos")
    .select("id, title, cover_url, video_url, views, likes_count, user_id")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data || data.length === 0) return [];
  const userIds = [...new Set(data.map((v: any) => v.user_id).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await (supabase as any).from("profiles").select("user_id, display_name").in("user_id", userIds);
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.display_name || ""; });
  }
  return data.map((v: any) => ({
    id: v.id, title: v.title, subtitle: profileMap[v.user_id] || "",
    cover_url: v.cover_url || musicvideo1,
    video_url: v.video_url ? getR2DownloadUrl(v.video_url) : undefined,
    views: v.views || "0", likes_count: v.likes_count || 0, user_id: v.user_id,
  }));
};

const BrowseVideosPage = () => {
  const navigate = useNavigate();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["browse-videos"],
    queryFn: fetchVideos,
    staleTime: 30_000,
  });

  const videoIds = videos.map(v => v.id);
  const { toggleLike, isLiked, getLikeCount } = useLikes("video", videoIds);

  const togglePlay = (video: VideoItem) => {
    if (!video.video_url) return;
    if (playingId === video.id) {
      setPlayingId(null);
    } else {
      setPlayingId(video.id);
      incrementVideoViews(video.id);
    }
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Music Videos</h1>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
      ) : videos.length === 0 ? (
        <div className="py-12 text-center">
          <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No videos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {videos.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="relative rounded-xl overflow-hidden bg-card border border-border group"
            >
              <div className="relative aspect-video">
                {playingId === v.id && v.video_url ? (
                  <video src={v.video_url} className="w-full h-full object-cover" autoPlay playsInline controls onEnded={() => setPlayingId(null)} />
                ) : (
                  <>
                    <img src={v.cover_url} alt={v.title} className="w-full h-full object-cover" />
                    <button onClick={() => togglePlay(v)} className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <Play className="w-8 h-8 text-white fill-white drop-shadow-lg" />
                    </button>
                  </>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-foreground truncate">{v.title}</p>
                {v.subtitle && <p className="text-[10px] text-muted-foreground truncate">{v.subtitle}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Eye className="w-3.5 h-3.5" /> {v.views}
                  </span>
                  <button onClick={() => toggleLike(v.id)} className="flex items-center gap-0.5">
                    <Heart className={`w-3.5 h-3.5 transition-colors ${isLiked(v.id) ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                    <span className="text-[10px] text-muted-foreground">{getLikeCount(v.id)}</span>
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

export default BrowseVideosPage;
