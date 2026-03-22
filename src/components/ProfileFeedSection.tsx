import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import FeedPostCard from "@/components/feed/FeedPostCard";
import BattleCard from "@/components/BattleCard";
import { fetchFeedItems } from "@/lib/feed-items";

interface Props {
  userId: string;
  isOwner: boolean;
}

const ProfileFeedSection = ({ userId, isOwner }: Props) => {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["profile-posts", userId],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id, userId }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm py-8">No posts yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item: any) => (
        item.itemType === "battle" ? (
          <BattleCard key={`battle-${item.id}`} battle={item} />
        ) : (
          <FeedPostCard key={`post-${item.id}`} post={item} currentUserId={isOwner ? user?.id : undefined} />
        )
      ))}
    </div>
  );
};

export default ProfileFeedSection;
