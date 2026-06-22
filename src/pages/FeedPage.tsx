import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, Search, Heart, MoreVertical, Radio as RadioIcon, Swords, Tv, Music2, ShoppingBag } from "lucide-react";
import FeedPostCard from "@/components/feed/FeedPostCard";
import CreatePostSheet from "@/components/feed/CreatePostSheet";
import { fetchFeedItems } from "@/lib/feed-items";

type TabId = "radio" | "battle" | "wheuat-tv" | "songs" | "shop";
const TABS: { id: TabId; label: string; route?: string; icon: typeof RadioIcon }[] = [
  { id: "radio", label: "Radio", route: "/radio", icon: RadioIcon },
  { id: "battle", label: "Battle", route: "/battles", icon: Swords },
  { id: "wheuat-tv", label: "WHEUAT.TV", icon: Tv },
  { id: "songs", label: "Songs", route: "/browse-songs", icon: Music2 },
  { id: "shop", label: "Shop", route: "/store", icon: ShoppingBag },
];

const FeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("wheuat-tv");
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
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
            if (!Number.isNaN(index)) {
              setCurrentIndex(index);
            }
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    container.querySelectorAll("[data-index]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [feedPosts.length]);

  useEffect(() => {
    if (currentIndex >= feedPosts.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, feedPosts.length]);

  return (
    <div className="h-[100dvh] w-full bg-black flex flex-col overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-6 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
        <div className="flex items-center gap-3 text-white">
          <button onClick={() => navigate("/")} className="w-9 h-9 shrink-0 flex items-center justify-center" aria-label="Back home">
            <ChevronLeft className="w-8 h-8" />
          </button>
          <h1 className="flex-1 text-[22px] font-bold tracking-normal">WHEUAT.TV</h1>
          <button
            onClick={() => navigate("/dollar-club")}
            title="Support Creators"
            className="w-9 h-9 shrink-0 flex items-center justify-center"
          >
            <Heart className="w-6 h-6" />
          </button>
          <button onClick={() => navigate("/browse-songs")} className="w-9 h-9 shrink-0 flex items-center justify-center" aria-label="Search">
            <Search className="w-7 h-7" />
          </button>
          <button className="w-8 h-9 shrink-0 flex items-center justify-center" aria-label="More">
            <MoreVertical className="w-6 h-6" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.route) navigate(tab.route);
                    else setActiveTab(tab.id);
                  }}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold backdrop-blur-md transition-all ${
                    active ? "bg-white/30 text-white shadow-lg" : "bg-white/18 text-white/90"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {isLoading ? (
          <div className="h-[100dvh] flex items-center justify-center snap-start">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="h-[100dvh] flex flex-col items-center justify-center snap-start gap-3">
            <p className="text-white/60 text-sm">No posts yet</p>
            <button
              onClick={() => setShowCreate(true)}
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
              <FeedPostCard post={item} currentUserId={user?.id} isActive={index === currentIndex} />
            </div>
          ))
        )}
      </div>


      <CreatePostSheet open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
};

export default FeedPage;
