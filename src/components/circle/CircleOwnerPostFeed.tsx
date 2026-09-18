import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchFeedItems } from "@/lib/feed-items";
import FeedThumbCard from "@/components/feed/FeedThumbCard";

type Props = {
  ownerUserId: string;
  currentUserId?: string;
  limit?: number;
};

export default function CircleOwnerPostFeed({ ownerUserId, currentUserId, limit = 20 }: Props) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    try {
      const items = await fetchFeedItems({ currentUserId, userId: ownerUserId });
      setPosts(items.filter((item: any) => item.itemType === "post").slice(0, limit));
    } catch {
      setPosts([]);
    }
  }, [currentUserId, limit, ownerUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (posts === null) {
    return <p className="px-4 py-5 text-center text-[12px] text-muted-foreground">Loading posts…</p>;
  }

  if (!posts.length) return null;

  return (
    <div className="space-y-4 px-4 pb-4">
      {posts.map((post) => (
        <FeedThumbCard
          key={post.id}
          post={post}
          onOpen={() => navigate(`/feed?post=${encodeURIComponent(post.id)}`)}
        />
      ))}
    </div>
  );
}
