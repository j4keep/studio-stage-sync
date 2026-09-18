import { useMemo, useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Search, Users } from "lucide-react";
import { fetchFeedItems } from "@/lib/feed-items";
import { fetchHappeningItems, type HappeningItem } from "@/lib/happening-items";
import { clearFeedVideosOnce } from "@/lib/clear-feed-videos";
import { forceIosAudioSessionToPlayback, initFeedAudioUnlockOnGesture, unlockFeedAudioSession } from "@/lib/feed-video-playback";
import { stopAllPageMedia } from "@/lib/stop-page-media";
import { listActivePublicLiveSessions } from "@/lib/circle-live";
import FeedThumbCard from "@/components/feed/FeedThumbCard";
import LiveNowCard from "@/components/feed/LiveNowCard";
import HappeningThumbCard from "@/components/feed/HappeningThumbCard";
import FeedFullscreenViewer from "@/components/feed/FeedFullscreenViewer";
import DesktopPostDetail from "@/components/feed/DesktopPostDetail";
import BattleCard from "@/components/BattleCard";
import LiveGamesRail from "@/components/games/live/LiveGamesRail";
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

type ViewerState = { rail: "post"; index: number } | null;

const FeedPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [viewer, setViewer] = useState<ViewerState>(null);
  const openBattleId = searchParams.get("battle");
  const openPostId = searchParams.get("post");
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

  const { data: liveNow = [], refetch: refetchLiveNow } = useQuery({
    queryKey: ["live-now"],
    queryFn: () => listActivePublicLiveSessions(20),
  });

  useEffect(() => {
    const channel = supabase
      .channel("feed-live-now")
      .on("postgres_changes", { event: "*", schema: "public", table: "circle_live_sessions" }, () => void refetchLiveNow())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetchLiveNow]);

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
    stopAllPageMedia();
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

  useEffect(() => {
    return () => {
      stopAllPageMedia({ detachStreams: true });
    };
  }, []);

  const openHappeningItem = (item: HappeningItem) => {
    if (item.openInPostsViewer) {
      const idx = posts.findIndex((p: any) => p.itemType === "post" && p.id === item.sourceId);
      if (idx >= 0) {
        openPostItem(idx);
        return;
      }
    }
    if (item.route) navigate(item.route);
  };

  useEffect(() => {
    if (!openBattleId || isLoading) return;
    if (openedBattleDeepLinkRef.current === openBattleId) {
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

  const peopleRow = (trending.length > 0 || liveNow.length > 0) && (
    <div className="flex max-w-full min-w-0 items-start gap-3 overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-hide">
      <button
        onClick={() => navigate("/profile")}
        className="flex w-[3.65rem] shrink-0 flex-col items-center gap-1.5"
        aria-label="Open your profile"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-xl font-light text-foreground shadow-sm ring-2 ring-primary/70 ring-offset-2 ring-offset-background">+</div>
        <span className="w-full truncate text-center text-[10px] font-semibold leading-none text-foreground/80">You</span>
      </button>

      {liveNow.map((s) => (
        <button
          key={s.id}
          onClick={() => navigate(`/live/${s.id}`)}
          className="flex w-[3.65rem] shrink-0 flex-col items-center gap-1.5"
        >
          <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted ring-2 ring-red-500 ring-offset-2 ring-offset-background">
            {s.host_avatar_url ? (
              <img src={s.host_avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-foreground">
                {(s.host_display_name || "?")[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white">Live</span>
        </button>
      ))}

      {trending.map((c) => (
        <button
          key={c.user_id}
          onClick={() => navigate(`/artist/${c.user_id}`)}
          className="flex w-[3.65rem] shrink-0 flex-col items-center gap-1.5"
        >
          <div className="h-12 w-12 overflow-hidden rounded-full bg-muted ring-1 ring-border ring-offset-2 ring-offset-background">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-foreground">
                {(c.display_name || "?")[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <span className="w-full truncate text-center text-[10px] font-semibold leading-none text-foreground/80">
            {c.display_name || "Artist"}
          </span>
        </button>
      ))}
    </div>
  );

  const happeningRail = (compact: boolean) => (
    <>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className={`${compact ? "text-sm" : "text-[15px]"} font-bold tracking-tight text-foreground`}>Happening now</h2>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Live moments, updates and community activity</p>
        </div>
      </div>
      {happeningLoading ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-5 text-center text-xs font-medium text-muted-foreground shadow-sm">Loading activity…</div>
      ) : happening.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-5 text-center text-xs font-medium text-muted-foreground shadow-sm">Nothing happening yet</div>
      ) : compact ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
          {happening.map((item) => (
            <HappeningThumbCard key={item.id} item={item} compact onOpen={() => openHappeningItem(item)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {happening.map((item) => (
            <HappeningThumbCard key={item.id} item={item} onOpen={() => openHappeningItem(item)} />
          ))}
        </div>
      )}
    </>
  );

  const postsColumn = () => (
    <>
      <LiveGamesRail />
      {liveNow.map((s) => (
        <LiveNowCard key={s.id} session={s} onOpen={() => navigate(`/live/${s.id}`)} />
      ))}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div>
            <p className="text-sm font-bold text-foreground">Your feed is ready</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Create the first post and start the conversation.</p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new Event("open-create-post"))}
            className="rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition active:scale-[0.98]"
          >
            Create post
          </button>
        </div>
      ) : (
        posts.map((item: any, i: number) =>
          item.itemType === "battle" ? (
            <BattleCard key={`battle-${item.id}`} battle={item} onOpen={() => openPostItem(i)} />
          ) : (
            <FeedThumbCard key={item.id} post={item} onOpen={() => openPostItem(i)} pressHoldMs={isDesktop ? 350 : undefined} />
          ),
        )
      )}
    </>
  );

  return (
    <div className="relative flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden overscroll-none bg-background text-foreground lg:h-[calc(100dvh-3.5rem-1.5rem)] lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:shadow-sm">
      <FlagBackground className="opacity-35 dark:opacity-45 lg:opacity-20" />

      <header className="absolute left-0 right-0 top-0 z-40 border-b border-border/80 bg-background/95 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.55rem)] shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2 text-foreground">
          <img src={yajLogo} alt="YAJ" className="-my-3 h-16 w-auto shrink-0" />
          <div className="min-w-0 flex-1" />
          <button onClick={() => navigate("/browse-songs")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80 transition active:scale-95 active:bg-muted" aria-label="Search">
            <Search className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.3} />
          </button>
          <button onClick={() => navigate("/circle")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80 transition active:scale-95 active:bg-muted" aria-label="My Circle">
            <Users className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.3} />
          </button>
          <IncognitoHeaderButton className="!h-9 !w-9 !border-0 !bg-muted/80" />
          <button onClick={() => navigate("/messages")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80 transition active:scale-95 active:bg-muted" aria-label="Messages">
            <MessageCircle className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.3} />
          </button>
          <NotificationBell />
        </div>
      </header>

      {isLoading ? (
        <div className="relative z-10 flex h-full items-center justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        </div>
      ) : (
        <>
          <div className="relative z-10 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-24 pt-[calc(env(safe-area-inset-top)+4.4rem)] scrollbar-hide lg:hidden">
            {(trending.length > 0 || liveNow.length > 0) && (
              <section className="mb-5 rounded-2xl border border-border/80 bg-card/95 px-3 py-3 shadow-sm backdrop-blur-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h1 className="text-[15px] font-bold tracking-tight text-foreground">Your community</h1>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">People and live rooms to check in on</p>
                  </div>
                </div>
                {peopleRow}
              </section>
            )}

            <section className="mb-5 rounded-2xl border border-border/80 bg-card/95 p-3 shadow-sm backdrop-blur-sm">
              {happeningRail(true)}
            </section>

            <section>
              <div className="mb-3 flex items-end justify-between px-0.5">
                <div>
                  <h2 className="text-[15px] font-bold tracking-tight text-foreground">Latest posts</h2>
                  <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Updates from the YAJ community</p>
                </div>
              </div>
              <div className="space-y-4">{postsColumn()}</div>
            </section>
          </div>

          <div className="relative z-10 hidden min-h-0 flex-1 flex-col overflow-hidden p-4 lg:flex">
            {(trending.length > 0 || liveNow.length > 0) && (
              <section className="mb-4 shrink-0 rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h1 className="text-base font-bold tracking-tight text-foreground">Your community</h1>
                    <p className="text-xs font-medium text-muted-foreground">People and live rooms to check in on</p>
                  </div>
                </div>
                {peopleRow}
              </section>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(210px,280px)_minmax(0,1fr)] gap-4 overflow-hidden">
              <aside className="overflow-y-auto rounded-2xl border border-border/70 bg-background/70 p-3 scrollbar-hide">
                {happeningRail(false)}
              </aside>

              <main className="min-w-0 overflow-y-auto rounded-2xl border border-border/70 bg-background/55 p-4 scrollbar-hide">
                <div className="mb-4">
                  <h2 className="text-base font-bold tracking-tight text-foreground">Latest posts</h2>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">Updates from the YAJ community</p>
                </div>
                <div className="space-y-4">{postsColumn()}</div>
              </main>
            </div>
          </div>
        </>
      )}

      {viewer && posts.length > 0 && (
        isDesktop ? (
          <DesktopPostDetail
            items={posts}
            startIndex={viewer.index}
            onClose={closeViewer}
            happeningItems={happening}
            onOpenHappening={openHappeningItem}
          />
        ) : (
          <FeedFullscreenViewer
            items={posts}
            startIndex={viewer.index}
            currentUserId={user?.id}
            onClose={closeViewer}
            happeningItems={happening}
            onOpenHappening={openHappeningItem}
          />
        )
      )}
    </div>
  );
};

export default FeedPage;
