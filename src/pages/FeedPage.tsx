import { useMemo, useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Search } from "lucide-react";
import { fetchFeedItems } from "@/lib/feed-items";
import { fetchHappeningItems, type HappeningItem } from "@/lib/happening-items";
import { clearFeedVideosOnce } from "@/lib/clear-feed-videos";
import { forceIosAudioSessionToPlayback, initFeedAudioUnlockOnGesture, unlockFeedAudioSession } from "@/lib/feed-video-playback";
import { stopAllPageMedia } from "@/lib/stop-page-media";
import FeedThumbCard from "@/components/feed/FeedThumbCard";
import HappeningThumbCard from "@/components/feed/HappeningThumbCard";
import FeedFullscreenViewer from "@/components/feed/FeedFullscreenViewer";
import DesktopPostDetail from "@/components/feed/DesktopPostDetail";
import BattleCard from "@/components/BattleCard";
import FlagBackground from "@/components/FlagBackground";
import NotificationBell from "@/components/NotificationBell";
import IncognitoHeaderButton from "@/components/IncognitoHeaderButton";
import YajAiGeneratorIcon from "@/components/YajAiGeneratorIcon";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import yajLogo from "@/assets/yaj-logo.png";

interface TrendingCreator {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

type ViewerState = { rail: "post"; index: number } | null;

const FeedPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [viewer, setViewer] = useState<ViewerState>(null);
  const openBattleId = searchParams.get("battle");
  const openPostId = searchParams.get("post");
  /** Prevent deep-link reopen loops that call stopAllPageMedia mid-playback. */
  const openedBattleDeepLinkRef = useRef<string | null>(null);
  const openedPostDeepLinkRef = useRef<string | null>(null);

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
  });

  const { data: happening = [], isLoading: happeningLoading } = useQuery({
    queryKey: ["happening-feed"],
    queryFn: () => fetchHappeningItems({ currentUserId: user?.id }),
    refetchInterval: 60_000,
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

  // Posts rail: every regular post + battles (create flow no longer splits reels).
  const posts = useMemo(() => {
    const nextPosts: any[] = [];
    items.forEach((it: any) => {
      if (it.itemType === "battle" || it.itemType === "post") nextPosts.push(it);
    });
    return nextPosts;
  }, [items]);

  useEffect(() => {
    initFeedAudioUnlockOnGesture();
  }, []);

  useEffect(() => {
    void clearFeedVideosOnce(user?.id).then((cleared) => {
      if (cleared) void refetch();
    });
  }, [refetch, user?.id]);

  const openPostItem = (index: number) => {
    // Soft-pause grid previews only — do NOT detach LiveKit/srcObject streams
    // or battle autoplay on Posts glitches hard right after open.
    stopAllPageMedia({ detachStreams: false });
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    setViewer({ rail: "post", index });
  };

  const closeViewer = () => {
    stopAllPageMedia({ detachStreams: true });
    openedBattleDeepLinkRef.current = null;
    openedPostDeepLinkRef.current = null;
    setViewer(null);
  };

  // Leaving the homepage must kill any escaped post/battle audio.
  useEffect(() => {
    return () => {
      stopAllPageMedia({ detachStreams: true });
    };
  }, []);

  const openHappeningItem = (item: HappeningItem) => {
    if (item.openInPostsViewer) {
      const idx = posts.findIndex(
        (p: any) => p.itemType === "post" && p.id === item.sourceId,
      );
      if (idx >= 0) {
        openPostItem(idx);
        return;
      }
    }
    if (item.route) {
      navigate(item.route);
    }
  };

  // Deep-link battles: /?battle=<id> — open once, never re-stop media on refetch.
  useEffect(() => {
    if (!openBattleId || isLoading) return;
    if (openedBattleDeepLinkRef.current === openBattleId) {
      // Param still present after a refetch — just clear it.
      const next = new URLSearchParams(searchParams);
      if (next.has("battle")) {
        next.delete("battle");
        setSearchParams(next, { replace: true });
      }
      return;
    }
    const idx = posts.findIndex((p: any) => p.itemType === "battle" && p.id === openBattleId);
    if (idx < 0) return;
    openedBattleDeepLinkRef.current = openBattleId;
    openPostItem(idx);
    const next = new URLSearchParams(searchParams);
    next.delete("battle");
    setSearchParams(next, { replace: true });
  }, [openBattleId, isLoading, posts, searchParams, setSearchParams]);

  // Deep-link a post from Happening: /?post=<id>
  useEffect(() => {
    if (!openPostId || isLoading) return;
    if (openedPostDeepLinkRef.current === openPostId) {
      const next = new URLSearchParams(searchParams);
      if (next.has("post")) {
        next.delete("post");
        setSearchParams(next, { replace: true });
      }
      return;
    }
    const idx = posts.findIndex((p: any) => p.itemType === "post" && p.id === openPostId);
    if (idx < 0) return;
    openedPostDeepLinkRef.current = openPostId;
    openPostItem(idx);
    const next = new URLSearchParams(searchParams);
    next.delete("post");
    setSearchParams(next, { replace: true });
  }, [openPostId, isLoading, posts, searchParams, setSearchParams]);

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

  const happeningColumn = (compact: boolean) => (
    <>
      <div className={`${compact ? "-mx-1.5 px-2 py-1" : "-mx-2 px-3 py-1.5"} sticky top-0 z-10 rounded-b-md border-b border-border bg-card/95 backdrop-blur-sm`}>
        <p className={`${compact ? "text-[10px]" : "text-[11px]"} font-black uppercase tracking-wider text-foreground`}>
          Happening
        </p>
      </div>
      {happeningLoading ? (
        <p className="mt-4 rounded-lg border border-border bg-card/90 px-2 py-3 text-center text-[10px] text-muted-foreground">
          Loading…
        </p>
      ) : happening.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-card/90 px-2 py-3 text-center text-[10px] text-muted-foreground">
          Nothing happening yet
        </p>
      ) : (
        happening.map((item) => (
          <HappeningThumbCard
            key={item.id}
            item={item}
            compact={compact}
            onOpen={() => openHappeningItem(item)}
          />
        ))
      )}
    </>
  );

  const postsColumn = () => (
    <>
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
        posts.map((item: any, i: number) =>
          item.itemType === "battle" ? (
            <BattleCard
              key={`battle-${item.id}`}
              battle={item}
              onOpen={() => openPostItem(i)}
            />
          ) : (
            <FeedThumbCard
              key={item.id}
              post={item}
              onOpen={() => openPostItem(i)}
              pressHoldMs={isDesktop ? 350 : undefined}
            />
          ),
        )
      )}
    </>
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
          <button onClick={() => navigate("/ask-yaj")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/80 active:bg-muted" aria-label="Ask YAJ">
            <YajAiGeneratorIcon className="h-[1.15rem] w-[1.15rem]" />
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
              {happeningColumn(true)}
            </div>

            <div className="h-full w-3/4 space-y-3 overflow-y-scroll overscroll-y-contain touch-pan-y border-l border-border/70 px-2 pb-24 scrollbar-hide dark:border-white/10">
              <div className="-mx-2 sticky top-0 z-10 rounded-b-md border-b border-border bg-card/95 px-3 py-1 backdrop-blur-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-foreground">Posts</p>
              </div>
              {postsColumn()}
            </div>
          </div>

          <div className="relative z-10 hidden min-h-0 flex-1 flex-col overflow-hidden p-3 lg:flex">
            {trending.length > 0 && <div className="mb-3 shrink-0">{trendingRow}</div>}
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-background/40">
              <div className="h-full w-[32%] min-w-[180px] max-w-[280px] space-y-2 overflow-y-scroll overscroll-y-contain touch-pan-y px-2 pb-4 scrollbar-hide">
                {happeningColumn(false)}
              </div>

              <div className="h-full min-w-0 flex-1 space-y-3 overflow-y-scroll overscroll-y-contain touch-pan-y border-l border-border px-3 pb-4 scrollbar-hide">
                <div className="-mx-3 sticky top-0 z-10 border-b border-border bg-card/95 px-3 py-1.5 backdrop-blur-sm">
                  <p className="text-[11px] font-black uppercase tracking-wider text-foreground">Posts</p>
                </div>
                {postsColumn()}
              </div>
            </div>
          </div>
        </>
      )}

      {viewer && posts.length > 0 && (
        isDesktop ? (
          <DesktopPostDetail items={posts} startIndex={viewer.index} onClose={closeViewer} />
        ) : (
          <FeedFullscreenViewer
            items={posts}
            startIndex={viewer.index}
            currentUserId={user?.id}
            onClose={closeViewer}
          />
        )
      )}
    </div>
  );
};

export default FeedPage;
