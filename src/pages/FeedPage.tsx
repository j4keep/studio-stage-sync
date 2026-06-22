import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Search, MoreVertical, Volume2, Radio as RadioIcon, Swords, Tv, Music2, Heart } from "lucide-react";
import FeedPostCard from "@/components/feed/FeedPostCard";
import CreatePostSheet from "@/components/feed/CreatePostSheet";
import { fetchFeedItems } from "@/lib/feed-items";

type TabId = "radio" | "battle" | "songs" | "wheuat-tv" | "support";
const TABS: { id: TabId; label: string; route?: string; icon: typeof RadioIcon }[] = [
  { id: "radio", label: "Radio", route: "/radio", icon: RadioIcon },
  { id: "battle", label: "Battle", route: "/battles", icon: Swords },
  { id: "songs", label: "Songs", route: "/browse-songs", icon: Music2 },
  { id: "wheuat-tv", label: "WHEUAT.TV", icon: Tv },
  { id: "support", label: "Creator Support", route: "/dollar-club", icon: Heart },
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
      <div className="absolute top-0 left-0 right-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
        <div className="flex items-center justify-between text-white pointer-events-auto">
          <h1 className="text-[20px] font-extrabold tracking-tight">WHEUAT</h1>
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 flex items-center justify-center" aria-label="Volume">
              <Volume2 className="w-6 h-6" />
            </button>
            <button onClick={() => navigate("/browse-songs")} className="w-9 h-9 flex items-center justify-center" aria-label="Search">
              <Search className="w-6 h-6" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center" aria-label="More">
              <MoreVertical className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide pointer-events-auto -mx-1 px-1">
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
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold backdrop-blur-md border border-white/15 transition-all ${
                  active ? "bg-white/30 text-white" : "bg-white/15 text-white/95"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">{tab.label}</span>
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
