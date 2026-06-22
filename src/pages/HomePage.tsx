import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Heart, MoreVertical, Radio as RadioIcon, Search, ShoppingBag, Swords, TrendingUp, Tv, Music2 } from "lucide-react";
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
import FeedPostCard from "@/components/feed/FeedPostCard";
import { fetchFeedItems } from "@/lib/feed-items";

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

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

type FeedTabId = "radio" | "battle" | "wheuat-tv" | "songs" | "shop";

const FEED_TABS: { id: FeedTabId; label: string; route?: string; icon: typeof RadioIcon }[] = [
  { id: "radio", label: "Radio", route: "/radio", icon: RadioIcon },
  { id: "battle", label: "Battle", route: "/battles", icon: Swords },
  { id: "wheuat-tv", label: "WHEUAT.TV", route: "/tv/wheuat", icon: Tv },
  { id: "songs", label: "Songs", route: "/browse-songs", icon: Music2 },
  { id: "shop", label: "Shop", route: "/store", icon: ShoppingBag },
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
  const [activeTab, setActiveTab] = useState<FeedTabId>("wheuat-tv");
  const [currentIndex, setCurrentIndex] = useState(0);
  const feedScrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const container = feedScrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!Number.isNaN(index)) setCurrentIndex(index);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    container.querySelectorAll("[data-index]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [feedPosts.length]);

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

      {/* Full-screen swipe feed */}
      <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[100dvh] w-screen overflow-hidden bg-black">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-40 h-32 bg-gradient-to-b from-black/75 via-black/35 to-transparent" />
        <div className="absolute left-0 right-0 top-0 z-50 px-3 pt-3">
          <div className="mb-3 flex items-center justify-end gap-3 text-white">
            <button onClick={() => navigate("/dollar-club")} className="flex h-9 w-9 items-center justify-center" aria-label="Support Creators">
              <Heart className="h-6 w-6" />
            </button>
            <button onClick={() => navigate("/browse-songs")} className="flex h-9 w-9 items-center justify-center" aria-label="Search">
              <Search className="h-7 w-7" />
            </button>
            <button className="flex h-9 w-8 items-center justify-center" aria-label="More">
              <MoreVertical className="h-6 w-6" />
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FEED_TABS.map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.route) navigate(tab.route);
                  }}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold text-white backdrop-blur-md transition-all ${
                    active ? "bg-white/30 shadow-lg" : "bg-white/18"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={feedScrollRef} className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" style={{ scrollSnapType: "y mandatory" }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center snap-start">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center snap-start">
            <p className="text-white/70 text-sm">No posts yet</p>
            <button
              onClick={() => window.dispatchEvent(new Event("open-create-post"))}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
            >
              Create first post
            </button>
          </div>
        ) : (
          feedPosts.map((item: any, index: number) => (
            <div key={item.id} data-index={index} className="relative h-[100dvh] w-full snap-start snap-always" style={{ scrollSnapAlign: "start" }}>
              <FeedPostCard post={item} currentUserId={user?.id} isActive={index === currentIndex} />
            </div>
          ))
        )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
