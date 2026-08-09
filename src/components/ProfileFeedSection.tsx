import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import FeedThumbCard from "@/components/feed/FeedThumbCard";
import FeedFullscreenViewer from "@/components/feed/FeedFullscreenViewer";
import { fetchFeedItems } from "@/lib/feed-items";

interface Props {
  userId: string;
  isOwner: boolean;
}

/**
 * Profile feed = only what this user posted (posts + their battles).
 * Tapping a tile opens the same fullscreen swipe viewer as the home feed,
 * so every action icon and auto-advance behaviour matches exactly.
 */
const ProfileFeedSection = ({ userId }: Props) => {
  const { user } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
    <>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item: any, index: number) => (
          <FeedThumbCard
            key={`${item.itemType}-${item.id}`}
            post={item}
            compact
            onOpen={() => setOpenIndex(index)}
          />
        ))}
      </div>

      {openIndex !== null && (
        <FeedFullscreenViewer
          items={items}
          startIndex={openIndex}
          currentUserId={user?.id}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
};

export default ProfileFeedSection;
