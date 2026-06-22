import { motion } from "framer-motion";
import { TrendingUp, Heart, Search, Radio as RadioIcon, Swords, Tv, Music2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import whetuatLogo from "@/assets/wheuat-logo.png";
import artistNiaVox from "@/assets/artist-nia-vox.jpg";
import artistKingMelo from "@/assets/artist-king-melo.jpg";
import artistZaraBeats from "@/assets/artist-zara-beats.jpg";
import artistDjOnyx from "@/assets/artist-dj-onyx.jpg";
import artistLyricSoul from "@/assets/artist-lyric-soul.jpg";
import artistNovaWave from "@/assets/artist-nova-wave.jpg";
import ProfilePostCard from "@/components/ProfilePostCard";
import { fetchFeedItems } from "@/lib/feed-items";

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

const FEED_TABS = [
  { id: "radio", label: "Radio", icon: RadioIcon, route: "/radio" },
  { id: "battle", label: "Battle", icon: Swords, route: "/battles" },
  { id: "wheuat-tv", label: "WHEUAT.TV", icon: Tv, route: "/feed" },
  { id: "songs", label: "Songs", icon: Music2, route: "/browse-songs" },
  { id: "shop", label: "Shop", icon: ShoppingBag, route: "/store" },
];

interface TrendingCreator {
  id: string;
  name: string;
  img: string;
  score: number;
}

const PLACEHOLDER_CREATORS: TrendingCreator[] = [
  { id: "placeholder-1", name: "Nia Vox", img: artistNiaVox, score: 0 },
  { id: "placeholder-2", name: "King Melo", img: artistKingMelo, score: 0 },
  { id: "placeholder-3", name: "Zara Beats", img: artistZaraBeats, score: 0 },
  { id: "placeholder-4", name: "DJ Onyx", img: artistDjOnyx, score: 0 },
  { id: "placeholder-5", name: "Lyric Soul", img: artistLyricSoul, score: 0 },
  { id: "placeholder-6", name: "Nova Wave", img: artistNovaWave, score: 0 },
];

const fetchTrendingCreators = async (userId?: string): Promise<TrendingCreator[]> => {
  const real: TrendingCreator[] = [];
  try {
    const { data: posts } = await (supabase as any)
      .from("posts")
      .select("user_id, like_count, view_count")
      .order("created_at", { ascending: false })
      .limit(200);

    if (posts && posts.length > 0) {
      const scoreMap = new Map<string, number>();
      for (const p of posts as any[]) {
        const s = (p.like_count || 0) + (p.view_count || 0);
        scoreMap.set(p.user_id, (scoreMap.get(p.user_id) || 0) + s);
      }
      const ids = [...scoreMap.keys()];
      if (ids.length) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", ids);
        const pmap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        for (const uid of ids) {
          const p = pmap.get(uid) as any;
          if (p?.display_name) {
            real.push({ id: p.user_id, name: p.display_name, img: p.avatar_url || "", score: scoreMap.get(uid) || 0 });
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  if (userId && !real.find((c) => c.id === userId)) {
    try {
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (profile?.display_name) {
        real.push({ id: profile.user_id, name: profile.display_name, img: profile.avatar_url || "", score: 0 });
      }
    } catch {
      /* ignore */
    }
  }

  real.sort((a, b) => b.score - a.score);
  const needed = Math.max(0, 6 - real.length);
  return [...real, ...PLACEHOLDER_CREATORS.slice(0, needed)].slice(0, 12);
};

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: trendingCreators = [] } = useQuery({
    queryKey: ["homepage-trending-creators", user?.id],
    queryFn: () => fetchTrendingCreators(user?.id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["home-feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
  });
  const feedPosts = (items as any[]).filter((item: any) => item.itemType === "post");

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-4 flex items-center justify-center mb-3">
        <img src={whetuatLogo} alt="WHEUAT" className="h-8 mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Trending Creators row */}
      <motion.section {...fadeUp} className="mb-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">
              Trending Creators
            </h2>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {trendingCreators.length > 0 ? (
            trendingCreators.map((c) => (
              <button
                key={c.id}
                onClick={() => !c.id.startsWith("placeholder") && navigate(`/profile?user=${c.id}`)}
                className="flex flex-col items-center gap-2 min-w-[72px] group"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all bg-muted">
                  {c.img ? (
                    <img src={c.img} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                      {c.name[0]}
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-medium text-foreground truncate w-full text-center">{c.name}</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No creators yet</p>
          )}
        </div>
      </motion.section>

      {/* Normal long social-media feed */}
      <div className="px-3 space-y-4">
        {/* Feed tabs — inside the feed content, not pinned to the page top */}
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {FEED_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.route)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/80 border border-border text-foreground text-[12px] font-semibold hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => navigate("/dollar-club")}
            title="Support Creators"
            aria-label="Support Creators"
            className="w-8 h-8 shrink-0 rounded-full bg-card border border-border flex items-center justify-center text-primary hover:border-primary/50"
          >
            <Heart className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/browse-songs")}
            title="Search"
            aria-label="Search"
            className="w-8 h-8 shrink-0 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        {isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground text-sm">No posts yet</p>
            <button
              onClick={() => window.dispatchEvent(new Event("open-create-post"))}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
            >
              Create first post
            </button>
          </div>
        ) : (
          feedPosts.map((item: any) => <ProfilePostCard key={item.id} post={item} />)
        )}
      </div>
    </div>
  );
};

export default HomePage;
