import { ArrowLeft, TrendingUp, Users, Music, Eye, Play, Loader2, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: songStats, isLoading: songsLoading } = useQuery({
    queryKey: ["analytics-songs", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0, totalPlays: 0, topSongs: [] };
      const { data: songs } = await supabase
        .from("songs")
        .select("id, title, plays")
        .eq("user_id", user.id)
        .order("plays", { ascending: false });

      const allSongs = songs || [];
      const totalPlays = allSongs.reduce((sum, s) => sum + (parseInt(s.plays || "0") || 0), 0);
      return {
        count: allSongs.length,
        totalPlays,
        topSongs: allSongs.slice(0, 5).map((s) => ({
          title: s.title,
          plays: parseInt(s.plays || "0") || 0,
        })),
      };
    },
    enabled: !!user?.id,
  });

  const { data: videoStats, isLoading: videosLoading } = useQuery({
    queryKey: ["analytics-videos", user?.id],
    queryFn: async () => {
      if (!user?.id) return { totalViews: 0 };
      const { data: videos } = await supabase
        .from("videos")
        .select("views")
        .eq("user_id", user.id);
      const totalViews = (videos || []).reduce((sum, v) => sum + (parseInt(v.views || "0") || 0), 0);
      return { totalViews };
    },
    enabled: !!user?.id,
  });

  const { data: followerCount, isLoading: followersLoading } = useQuery({
    queryKey: ["analytics-followers", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", user.id);
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const isLoading = songsLoading || videosLoading || followersLoading;

  const formatNumber = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const stats = [
    { label: "Total Plays", value: formatNumber(songStats?.totalPlays || 0), icon: Play },
    { label: "Followers", value: formatNumber(followerCount || 0), icon: Users },
    { label: "Video Views", value: formatNumber(videoStats?.totalViews || 0), icon: Eye },
    { label: "Songs", value: (songStats?.count || 0).toString(), icon: Music },
  ];

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Analytics</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {stats.map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="w-4 h-4 text-primary" />
                  <span className="text-[10px] text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-lg font-display font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Performing Songs</p>
          {(songStats?.topSongs || []).length === 0 ? (
            <div className="text-center py-10">
              <Music className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No songs yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">Upload songs to start tracking performance</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {songStats!.topSongs.map((s, i) => (
                <div key={s.title} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                  <span className="text-sm font-bold text-primary w-5 text-center">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground">{formatNumber(s.plays)} plays</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
