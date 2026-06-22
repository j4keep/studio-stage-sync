import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Heart, Search } from "lucide-react";
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

// Trending Score = Likes + Views, computed across the user's recent posts.
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
    /* fall through to placeholders */
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

type TabId = "radio" | "battle" | "wheuat-tv" | "songs" | "shop";
const TABS: { id: TabId; label: string; route?: string }[] = [
  { id: "radio", label: "Radio", route: "/radio" },
  { id: "battle", label: "Battle", route: "/battles" },
  { id: "wheuat-tv", label: "WHEUAT.TV" }, // inline vertical feed
  { id: "songs", label: "Songs", route: "/browse-songs" },
  { id: "shop", label: "Shop", route: "/store" },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: trendingCreators = [] } = useQuery({
    queryKey: ["homepage-trending-creators", user?.id],
    queryFn: () => fetchTrendingCreators(user?.id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const [activeTab, setActiveTab] = useState<TabId>("wheuat-tv");
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["home-feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
  });
  const feedPosts = (items as any[]).filter((item: any) => item.itemType === "post");

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!Number.isNaN(idx)) setCurrentIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );
    container.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [feedPosts.length, activeTab]);

  const handleTab = (tab: typeof TABS[number]) => {
    if (tab.route) {
      navigate(tab.route);
      return;
    }
    setActiveTab(tab.id);
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-4 pt-4 flex items-center justify-center mb-4">
        <img src={whetuatLogo} alt="WHEUAT" className="h-8 mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Trending Creators row (UNCHANGED behavior — name only) */}
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

      {/* Top tabs (mirrors Feed top-tab UI; swipe area unchanged) */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-3 py-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTab(tab)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                  active ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => navigate("/dollar-club")}
              title="Support Creators"
              className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-primary hover:border-primary/50"
            >
              <Heart className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/browse-songs")}
              title="Search"
              className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* WHEUAT.TV inline vertical feed — TikTok-style swipe */}
      {activeTab === "wheuat-tv" && (
        <div
          ref={scrollRef}
          className="h-[calc(100vh-260px)] overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-black"
          style={{ scrollSnapType: "y mandatory" }}
        >
          {isLoading ? (
            <div className="h-full flex items-center justify-center snap-start">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedPosts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center snap-start gap-3">
              <p className="text-white/60 text-sm">No videos yet</p>
              <button
                onClick={() => window.dispatchEvent(new Event("open-create-post"))}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold"
              >
                Create first post
              </button>
            </div>
          ) : (
            feedPosts.map((item: any, index: number) => (
              <div
                key={item.id}
                data-index={index}
                className="h-full w-full snap-start snap-always relative"
                style={{ scrollSnapAlign: "start" }}
              >
                <FeedPostCard post={item} currentUserId={user?.id} isActive={index === currentIndex} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default HomePage;
