import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, MoreVertical } from "lucide-react";
import { fetchFeedItems, isReelItem } from "@/lib/feed-items";
import { initFeedAudioUnlockOnGesture } from "@/lib/feed-video-playback";
import FeedThumbCard from "@/components/feed/FeedThumbCard";
import FeedFullscreenViewer from "@/components/feed/FeedFullscreenViewer";
import FlagBackground from "@/components/FlagBackground";
import yajLogo from "@/assets/yaj-logo.png";

interface TrendingCreator {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

type ViewerState = { rail: "reel" | "post"; index: number } | null;

const FeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewer, setViewer] = useState<ViewerState>(null);

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

  const { reels, posts } = useMemo(() => {
    const feedPosts = items.filter((it: any) => it.itemType === "post");
    const reels: any[] = [];
    const posts: any[] = [];
    feedPosts.forEach((p: any) => (isReelItem(p) ? reels : posts).push(p));
    return { reels, posts };
  }, [items]);

  // Pick one video to autoplay muted so the feed always has visible motion on load.
  const featuredReelIndex = useMemo(
    () => reels.findIndex((p: any) => p.media_type === "video" && p.media_url),
    [reels],
  );

  useEffect(() => {
    initFeedAudioUnlockOnGesture();
  }, []);

  const activeItems = viewer?.rail === "reel" ? reels : viewer?.rail === "post" ? posts : [];

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden relative overscroll-none bg-background text-foreground dark:bg-background dark:text-foreground">
      <FlagBackground className="opacity-80 dark:opacity-100" />

      {/* Header overlay — single row: logo + tabs + search + more */}
      <div className="absolute top-0 left-0 right-0 z-40 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-1.5 bg-background/90 backdrop-blur-md border-b border-border/70 pointer-events-none">
        <div className="flex items-center gap-2 text-foreground pointer-events-auto">
          <img src={yajLogo} alt="YAJ" className="h-16 w-auto shrink-0 -my-3" />
          <div className="flex-1 min-w-0" />
          <button onClick={() => navigate("/browse-songs")} className="w-8 h-8 flex items-center justify-center rounded-full bg-card/80 border border-border active:bg-muted shrink-0" aria-label="Search">
            <Search className="w-[1.15rem] h-[1.15rem]" strokeWidth={2.25} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-card/80 border border-border active:bg-muted shrink-0" aria-label="More">
            <MoreVertical className="w-[1.15rem] h-[1.15rem]" strokeWidth={2.25} />
          </button>
        </div>
      </div>


      {trending.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(env(safe-area-inset-top)+3.25rem)] z-30 px-3 pointer-events-none">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pointer-events-auto rounded-xl border border-border bg-card/95 px-2 py-2 shadow-sm dark:backdrop-blur-md">
            <button
              onClick={() => navigate("/profile")}
              className="shrink-0 flex flex-col items-center gap-1"
              aria-label="Pitch your profile"
            >
              <div className="w-10 h-10 rounded-full ring-2 ring-primary flex items-center justify-center bg-muted text-foreground text-lg font-light">+</div>
              <span className="text-[10px] text-foreground/80 leading-none font-medium">Pitch</span>
            </button>

            {trending.map((c) => (
              <button
                key={c.user_id}
                onClick={() => navigate(`/artist/${c.user_id}`)}
                className="shrink-0 flex flex-col items-center gap-1 w-[3rem]"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-border bg-muted dark:ring-white/35 dark:bg-white/10">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-foreground text-xs font-bold">
                      {(c.display_name || "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-foreground/80 leading-none truncate w-full text-center font-medium">
                  {c.display_name || "Artist"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Split columns */}
      {isLoading ? (
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex overflow-hidden pt-[7.5rem]">
          {/* Reels — left 25% */}
          <div className="w-1/4 h-full overflow-y-scroll scrollbar-hide overscroll-y-contain touch-pan-y px-1.5 pb-24 space-y-2">
            <div className="sticky top-0 z-10 -mx-1.5 px-2 py-1 bg-card/95 border-b border-border rounded-b-md backdrop-blur-sm">
              <p className="text-[10px] font-black tracking-wider text-foreground uppercase">Reels</p>
            </div>
            {reels.length === 0 ? (
              <p className="rounded-lg bg-card/90 border border-border px-2 py-3 text-[10px] text-muted-foreground text-center mt-4">No reels yet</p>
            ) : (
              reels.map((post, i) => (
                <FeedThumbCard
                  key={post.id}
                  post={post}
                  compact
                  autoPlayMuted={post.media_type === "video" && i === featuredReelIndex}
                  onOpen={() => setViewer({ rail: "reel", index: i })}
                />
              ))
            )}
          </div>

          {/* Posts — right 75% */}
          <div className="w-3/4 h-full overflow-y-scroll scrollbar-hide overscroll-y-contain touch-pan-y px-2 pb-24 space-y-3 border-l border-border/70 dark:border-white/10">
            <div className="sticky top-0 z-10 -mx-2 px-3 py-1 bg-card/95 border-b border-border rounded-b-md backdrop-blur-sm">
              <p className="text-[11px] font-black tracking-wider text-foreground uppercase">Posts</p>
            </div>
            {posts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 mt-6 rounded-xl bg-card/95 border border-border p-4 shadow-sm">
                <p className="text-muted-foreground text-xs">No posts yet</p>
                <button
                  onClick={() => window.dispatchEvent(new Event("open-create-post"))}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-semibold"
                >
                  Create first post
                </button>
              </div>
            ) : (
              posts.map((post, i) => (
                <FeedThumbCard
                  key={post.id}
                  post={post}
                  onOpen={() => setViewer({ rail: "post", index: i })}
                />
              ))
            )}
          </div>
        </div>
      )}

      {viewer && activeItems.length > 0 && (
        <FeedFullscreenViewer
          items={activeItems}
          startIndex={viewer.index}
          currentUserId={user?.id}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
};

export default FeedPage;
