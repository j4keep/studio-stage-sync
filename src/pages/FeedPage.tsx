import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, Heart } from "lucide-react";
import FeedPostCard from "@/components/feed/FeedPostCard";
import CreatePostSheet from "@/components/feed/CreatePostSheet";
import { fetchFeedItems } from "@/lib/feed-items";

type TabId = "radio" | "battle" | "wheuat-tv" | "songs" | "shop";
const TABS: { id: TabId; label: string; route?: string }[] = [
  { id: "radio", label: "Radio", route: "/radio" },
  { id: "battle", label: "Battle", route: "/battles" },
  { id: "wheuat-tv", label: "WHEUAT.TV" },
  { id: "songs", label: "Songs", route: "/browse-songs" },
  { id: "shop", label: "Shop", route: "/store" },
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
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-50 pt-10 pb-2 px-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="w-9 h-9 shrink-0 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>

          <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.route) navigate(tab.route);
                    else setActiveTab(tab.id);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                    active ? "text-white border-b-2 border-white" : "text-white/60"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => navigate("/dollar-club")}
            title="Support Creators"
            className="w-9 h-9 shrink-0 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-primary"
          >
            <Heart className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate("/browse-songs")}
            className="w-9 h-9 shrink-0 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
          >
            <Search className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {isLoading ? (
          <div className="h-screen flex items-center justify-center snap-start">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="h-screen flex flex-col items-center justify-center snap-start gap-3">
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
              className="h-screen w-full snap-start snap-always relative"
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
