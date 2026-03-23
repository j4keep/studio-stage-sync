import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Plus } from "lucide-react";
import FeedPostCard from "@/components/feed/FeedPostCard";
import CreatePostSheet from "@/components/feed/CreatePostSheet";
import BattleCard from "@/components/BattleCard";
import { fetchFeedItems } from "@/lib/feed-items";

const FeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
  });

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-display font-bold text-foreground">Feed</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/messages")}
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Create Post Button */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-sm text-muted-foreground">What's on your mind?</span>
        </button>
      </div>

      {/* Posts Feed - no gaps, Facebook style */}
      <div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">No posts yet. Be the first to share!</p>
          </div>
        ) : (
          items.map((item: any) => (
            item.itemType === "battle" ? (
              <div key={`battle-${item.id}`} className="px-4 py-2">
                <BattleCard battle={item} />
              </div>
            ) : (
              <FeedPostCard key={`post-${item.id}`} post={item} currentUserId={user?.id} />
            )
          ))
        )}
      </div>

      <CreatePostSheet open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
};

export default FeedPage;
