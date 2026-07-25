import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Search } from "lucide-react";
import { fetchFeedItems, isReelItem } from "@/lib/feed-items";
import { forceIosAudioSessionToPlayback, initFeedAudioUnlockOnGesture, unlockFeedAudioSession } from "@/lib/feed-video-playback";
import { primeMediaPlaybackGesture } from "@/lib/prime-media-gesture";
import FeedThumbCard from "@/components/feed/FeedThumbCard";
import FeedFullscreenViewer from "@/components/feed/FeedFullscreenViewer";
import DesktopPostDetail from "@/components/feed/DesktopPostDetail";
import DesktopReelViewer from "@/components/feed/DesktopReelViewer";
import FlagBackground from "@/components/FlagBackground";
import NotificationBell from "@/components/NotificationBell";
import IncognitoHeaderButton from "@/components/IncognitoHeaderButton";
import { useIsDesktop } from "@/hooks/use-is-desktop";
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
  const isDesktop = useIsDesktop();
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
    const nextReels: any[] = [];
    const nextPosts: any[] = [];
    feedPosts.forEach((p: any) => (isReelItem(p) ? nextReels : nextPosts).push(p));
    return { reels: nextReels, posts: nextPosts };
  }, [items]);

  const featuredReelIndex = useMemo(
    () => reels.findIndex((p: any) => p.media_type === "video" && p.media_url),
    [reels],
  );

  useEffect(() => {
    initFeedAudioUnlockOnGesture();
  }, []);

  const openItem = (rail: "reel" | "post", index: number) => {
    const list = rail === "reel" ? reels : posts;
    const item = list[index];
    primeMediaPlaybackGesture(item?.media_url);
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    setViewer({ rail, index });
  };
  const activeItems = viewer?.rail === "reel" ? reels : viewer?.rail === "post" ? posts : [];

  const trendingRow = trending.length > 0 && (
    <div className="flex max-w-full min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-hide h-scroll-isolate rounded-xl border border-border bg-card/95 px-2 py-2 shadow-sm dark:backdrop-blur-md">
      <button
        onClick={() => navigate("/profile")}
        className="flex shrink-0 flex-col items-center gap-1"
        aria-label="Pitch your profile"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg font-light text-foreground ring-2 ring-primary">+</div>
        <span className="text-[10px] font-medium leading-none text-foreground/80">Pitch</span>
      </button>
      {trending.map((c) => (
        <button
          key={c.user_id}
          onClick={() => navigate(`/artist/${c.user_id}`)}
          className="flex w-[3rem] shrink-0 flex-col items-center gap-1"
        >
          <div className="h-10 w-10 overflow-hidden rounded-full bg-muted ring-2 ring-border dark:bg-white/10 dark:ring-white/35">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-foreground">
                {(c.display_name || "?")[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <span className="w-full truncate text-center text-[10px] font-medium leading-none text-foreground/80">
            {c.display_name || "Artist"}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden overscroll-none bg-background text-foreground dark:bg-background dark:text-foreground lg:h-[calc(100dvh-3.5rem-1.5rem)] lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-sm">
      <FlagBackground className="opacity-80 dark:opacity-100 lg:opacity-40" />

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-40 border-b border-border/70 bg-background/90 px-3 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-md lg:hidden">
        <div className="pointer-events-auto flex items-center gap-1.5 text-foreground">
          <img src={yajLogo} alt="YAJ" className="-my-3 h-16 w-auto shrink-0" />
          <div className="min-w-0 flex-1" />
          <button onClick={() => navigate("/browse-songs")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/80 active:bg-muted" aria-label="Search">
            <Search className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} />
          </button>
          <IncognitoHeaderButton className="!h-8 !w-8 border border-border bg-card/80" />
          <button onClick={() => navigate("/messages")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/80 active:bg-muted" aria-label="Messages">
            <MessageCircle className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} />
          </button>
          <NotificationBell />
        </div>
      </div>

      {trending.length > 0 && (
        <div className="pointer-events-none absolute left-0 right-0 top-[calc(env(safe-area-inset-top)+3.25rem)] z-30 px-3 lg:hidden">
          <div className="pointer-events-auto">{trendingRow}</div>
        </div>
      )}

      {isLoading ? (
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="relative z-10 flex flex-1 overflow-hidden pt-[7.5rem] lg:hidden">
            <div className="h-full w-1/4 space-y-2 overflow-y-scroll overscroll-y-contain touch-pan-y px-1.5 pb-24 scrollbar-hide">
              <div className="-mx-1.5 sticky top-0 z-10 rounded-b-md border-b border-border bg-card/95 px-2 py-1 backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-foreground">Reels</p>
              </div>
              {reels.length === 0 ? (
                <p className="mt-4 rounded-lg border border-border bg-card/90 px-2 py-3 text-center text-[10px] text-muted-foreground">No reels yet</p>
              ) : (
                reels.map((post, i) => (
                  <FeedThumbCard
                    key={post.id}
                    post={post}
                    compact
                    autoPlayMuted={post.media_type === "video" && i === featuredReelIndex}
                    onOpen={() => openItem("reel", i)}
                  />
                ))
              )}
            </div>

            <div className="h-full w-3/4 space-y-3 overflow-y-scroll overscroll-y-contain touch-pan-y border-l border-border/70 px-2 pb-24 scrollbar-hide dark:border-white/10">
              <div className="-mx-2 sticky top-0 z-10 rounded-b-md border-b border-border bg-card/95 px-3 py-1 backdrop-blur-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-foreground">Posts</p>
              </div>
              {posts.length === 0 ? (
                <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">No posts yet</p>
                  <button
                    onClick={() => window.dispatchEvent(new Event("open-create-post"))}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Create first post
                  </button>
                </div>
              ) : (
                posts.map((post, i) => (
                  <FeedThumbCard key={post.id} post={post} onOpen={() => openItem("post", i)} />
                ))
              )}
            </div>
          </div>

          <div className="relative z-10 hidden min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain touch-pan-y p-4 scrollbar-hide lg:flex">
            {trending.length > 0 && <div className="mb-4 shrink-0">{trendingRow}</div>}
            {reels.length > 0 && (
              <div className="mb-4 shrink-0">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Reels</p>
                <div className="h-scroll-isolate flex max-w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain touch-pan-x pb-1 scrollbar-hide">
                  {reels.slice(0, 12).map((post, i) => (
                    <div key={post.id} className="w-28 shrink-0">
                      <FeedThumbCard
                        post={post}
                        compact
                        autoPlayMuted={post.media_type === "video" && i === featuredReelIndex}
                        onOpen={() => openItem("reel", i)}
                        pressHoldMs={350}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-3 pb-6">
              <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Posts</p>
              {posts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6">
                  <p className="text-sm text-muted-foreground">No posts yet</p>
                  <button
                    onClick={() => window.dispatchEvent(new Event("open-create-post"))}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Create first post
                  </button>
                </div>
              ) : (
                posts.map((post, i) => (
                  <FeedThumbCard
                    key={post.id}
                    post={post}
                    onOpen={() => openItem("post", i)}
                    pressHoldMs={350}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      {viewer && activeItems.length > 0 && (
        isDesktop ? (
          viewer.rail === "reel" ? (
            <DesktopReelViewer items={activeItems} startIndex={viewer.index} onClose={() => setViewer(null)} />
          ) : (
            <DesktopPostDetail items={activeItems} startIndex={viewer.index} onClose={() => setViewer(null)} />
          )
        ) : (
          <FeedFullscreenViewer
            items={activeItems}
            startIndex={viewer.index}
            currentUserId={user?.id}
            onClose={() => setViewer(null)}
          />
        )
      )}
    </div>
  );
};

export default FeedPage;
