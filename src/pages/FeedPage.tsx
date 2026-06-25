import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, MoreVertical, Radio as RadioIcon, Swords, Tv, Music2, Heart } from "lucide-react";
import FeedPostCard from "@/components/feed/FeedPostCard";
import { useCreatePostSheet } from "@/hooks/use-create-post-sheet";
import CreatePostSheet from "@/components/feed/CreatePostSheet";
import { fetchFeedItems } from "@/lib/feed-items";

type TabId = "radio" | "battle" | "songs" | "wheuat-tv" | "support";
const TABS: { id: TabId; label: string; route: string; icon: typeof RadioIcon }[] = [
  { id: "radio", label: "Radio", route: "/radio", icon: RadioIcon },
  { id: "battle", label: "Battle", route: "/battles", icon: Swords },
  { id: "songs", label: "Songs", route: "/browse-songs", icon: Music2 },
  { id: "wheuat-tv", label: "WHEUAT.TV", route: "/tv/watch", icon: Tv },
  { id: "support", label: "Support", route: "/my-projects", icon: Heart },
];

interface TrendingCreator {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

const FeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open: showCreate, cameraStream, openCreate, closeCreate } = useCreatePostSheet();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chromeHidden, setChromeHidden] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
  });

  const { data: trending = [] } = useQuery<TrendingCreator[]>({
    queryKey: ["trending-creators"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .order("created_at", { ascending: false })
        .limit(12);
      return (data as TrendingCreator[]) || [];
    },
  });

  const feedPosts = items.filter((item: any) => item.itemType === "post");

  useEffect(() => {
    const container = scrollRef.current;
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

  useEffect(() => {
    if (currentIndex >= feedPosts.length) setCurrentIndex(0);
  }, [currentIndex, feedPosts.length]);

  useEffect(() => {
    const resetToTop = () => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setCurrentIndex(0);
      setChromeHidden(false);
    };
    window.addEventListener("feed-scroll-top", resetToTop);
    return () => window.removeEventListener("feed-scroll-top", resetToTop);
  }, []);

  return (
    <div className="h-[100dvh] w-full bg-black flex flex-col overflow-hidden relative overscroll-none">
      {/* Header overlay */}
      <div className={`absolute top-0 left-0 right-0 z-50 px-4 pt-[calc(env(safe-area-inset-top)+0.625rem)] pb-3 bg-gradient-to-b from-black/85 via-black/50 to-transparent pointer-events-none transition-all duration-300 ${chromeHidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}>
        <div className="flex items-center justify-between text-white pointer-events-auto">
          <h1 className="text-xl font-black tracking-tight leading-none">WHEUAT</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate("/browse-songs")} className="w-9 h-9 flex items-center justify-center rounded-full active:bg-white/10" aria-label="Search">
              <Search className="w-[1.35rem] h-[1.35rem]" strokeWidth={2.25} />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-full active:bg-white/10" aria-label="More">
              <MoreVertical className="w-[1.35rem] h-[1.35rem]" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {/* Trending creators strip */}
        {trending.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2.5 overflow-x-auto scrollbar-hide pointer-events-auto -mx-1 px-1 pb-0.5">
            <button
              onClick={() => navigate("/profile")}
              className="shrink-0 flex flex-col items-center gap-1"
              aria-label="Pitch your profile"
            >
              <div className="w-11 h-11 rounded-full ring-2 ring-primary flex items-center justify-center bg-black/50 text-white text-lg font-light">+</div>
              <span className="text-[10px] text-white/85 leading-none font-medium">Pitch</span>
            </button>
            {trending.map((c) => (
              <button
                key={c.user_id}
                onClick={() => navigate(`/artist/${c.user_id}`)}
                className="shrink-0 flex flex-col items-center gap-1 w-[3.25rem]"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/35 bg-white/10">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                      {(c.display_name || "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-white/85 leading-none truncate w-full text-center font-medium">
                  {c.display_name || "Artist"}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Category pills */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide pointer-events-auto pb-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.route)}
                className="feed-glass-pill shrink-0 min-w-[4.25rem]"
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={2.25} />
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide overscroll-y-contain"
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
        onScroll={() => { if (!chromeHidden) setChromeHidden(true); }}
      >
        {isLoading ? (
          <div className="h-[100dvh] flex items-center justify-center snap-start">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="h-[100dvh] flex flex-col items-center justify-center snap-start gap-3">
            <p className="text-white/60 text-sm">No posts yet</p>
            <button
              onClick={() => void openCreate()}
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
              className="h-[100dvh] w-full snap-start snap-always relative"
              style={{ scrollSnapAlign: "start" }}
            >
              <FeedPostCard post={item} currentUserId={user?.id} isActive={index === currentIndex} chromeHidden={chromeHidden} onChromeHiddenChange={setChromeHidden} />
            </div>
          ))
        )}
      </div>

      <CreatePostSheet open={showCreate} onClose={closeCreate} cameraStream={cameraStream} />
    </div>
  );
};

export default FeedPage;
