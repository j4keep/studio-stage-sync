import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import BattleCard from "@/components/BattleCard";
import ProfilePostCard from "@/components/ProfilePostCard";
import { fetchFeedItems } from "@/lib/feed-items";

interface Props {
  userId: string;
  isOwner: boolean;
}

const ProfileFeedSection = ({ userId }: Props) => {
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
    return <p className="text-center text-muted-foreground text-sm py-8">No posts yet</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item: any) =>
        item.itemType === "battle" ? (
          <BattleCard key={`battle-${item.id}`} battle={item} />
        ) : (
          <ProfilePostCard key={`post-${item.id}`} post={item} />
        )
      )}
    </div>
  );
};

export default ProfileFeedSection;
