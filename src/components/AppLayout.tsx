import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import GlobalRadioPlayer from "./GlobalRadioPlayer";
import GlobalPlaylistPlayer from "./GlobalPlaylistPlayer";
import PlaylistPlayerSheet from "./PlaylistPlayerSheet";
import NotificationBell from "./NotificationBell";
import MessagesInboxButton from "./MessagesInboxButton";
import { ArrowLeft, Users } from "lucide-react";
import IncognitoFeedWindow from "./IncognitoFeedWindow";
import DesktopTopBar from "./desktop/DesktopTopBar";
import DesktopLeftNav from "./desktop/DesktopLeftNav";
import DesktopHomeIconRail from "./desktop/DesktopHomeIconRail";
import IncognitoHeaderButton from "./IncognitoHeaderButton";
import { workoutMusic } from "@/lib/workout-music";

function isDesktopShellPath(pathname: string) {
  if (pathname.startsWith("/jobs/interview")) return false;

  if (
    pathname === "/" ||
    pathname === "/feed" ||
    pathname === "/explore" ||
    pathname === "/books" ||
    pathname.startsWith("/books/") ||
    pathname === "/meet" ||
    pathname.startsWith("/meet/") ||
    pathname === "/local-help" ||
    pathname === "/marketplace" ||
    pathname === "/wellness" ||
    pathname === "/jobs" ||
    pathname === "/ask-yaj" ||
    pathname === "/profile" ||
    pathname === "/radio" ||
    pathname === "/library" ||
    pathname === "/playlists" ||
    pathname === "/my-jobs" ||
    pathname === "/my-gigs" ||
    pathname === "/messages" ||
    pathname === "/circle" ||
    pathname.startsWith("/circle/") ||
    pathname === "/events" ||
    pathname.startsWith("/events/") ||
    pathname === "/employer-dashboard" ||
    pathname === "/employer"
  ) {
    return true;
  }

  if (pathname.startsWith("/jobs/")) return true;
  if (pathname.startsWith("/local-help/")) return true;
  if (pathname.startsWith("/marketplace/")) return true;
  if (pathname.startsWith("/wellness/")) return true;
  if (pathname.startsWith("/ask-yaj")) return true;
  return false;
}

function isMobileFeedPath(pathname: string) {
  return pathname === "/" || pathname === "/feed";
}

const AppLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCircleLive = /^\/circle\/c\/[^/]+\/live$/.test(location.pathname) || /^\/live\/[^/]+$/.test(location.pathname);
  const isYajTv = location.pathname === "/tv" || location.pathname.startsWith("/tv/");
  const desktopShell = isDesktopShellPath(location.pathname);
  const mobileFeed = isMobileFeedPath(location.pathname);
  const isMarketplace = location.pathname === "/marketplace" || location.pathname.startsWith("/marketplace/");
  const isWellness = location.pathname === "/wellness" || location.pathname.startsWith("/wellness/");
  const isBookReader = location.pathname.startsWith("/books/read/");

  useEffect(() => {
    if (location.pathname !== "/wellness/move") workoutMusic.stop();
  }, [location.pathname]);

  const showMobileTopBar =
    !["/auth", "/", "/feed"].includes(location.pathname) &&
    !isMarketplace &&
    !isWellness &&
    !isBookReader;

  const rootTabs = ["/", "/feed", "/explore", "/ask-yaj", "/profile", "/auth"];
  const showBackButton = !rootTabs.includes(location.pathname);

  const backSlot = showBackButton ? (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-sm transition active:scale-95"
      aria-label="Go back"
    >
      <ArrowLeft className="h-[18px] w-[18px]" />
    </button>
  ) : (
    <span className="h-10 w-10" />
  );

  const actionButtons = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigate("/circle")}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-sm transition active:scale-95"
        aria-label="My Circle"
      >
        <Users className={`h-[18px] w-[18px] ${location.pathname.startsWith("/circle") ? "text-primary" : "text-foreground"}`} />
      </button>
      <MessagesInboxButton />
      <NotificationBell />
      <IncognitoHeaderButton />
    </div>
  );

  if (isCircleLive || isYajTv) {
    return <>{children}</>;
  }

  if (isBookReader) {
    return <div className="relative min-h-[100dvh] overflow-hidden overscroll-none bg-background text-foreground transition-colors">{children}</div>;
  }

  if (desktopShell) {
    return (
      <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden overscroll-none bg-background text-foreground transition-colors lg:block lg:h-auto lg:min-h-screen lg:overflow-x-hidden lg:overscroll-x-none lg:bg-[hsl(var(--muted)/0.45)]">
        <div className="hidden lg:block">
          <DesktopTopBar />
        </div>

        {showMobileTopBar && (
          <div className="relative z-40 flex shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/95 px-4 py-2.5 shadow-[0_1px_0_hsl(var(--border)/0.35)] backdrop-blur-xl lg:hidden">
            {backSlot}
            {actionButtons}
          </div>
        )}

        <div
          className={
            mobileFeed
              ? "fixed inset-0 mx-auto flex w-full max-w-[440px] flex-col overflow-hidden bg-background lg:static lg:mx-auto lg:grid lg:h-auto lg:max-w-[1400px] lg:grid-cols-[280px_minmax(0,1fr)_56px] lg:gap-4 lg:overflow-visible lg:bg-transparent lg:px-4 lg:py-3"
              : "relative mx-auto flex min-h-0 w-full max-w-lg min-w-0 flex-1 flex-col overflow-hidden lg:grid lg:h-auto lg:max-w-[1400px] lg:grid-cols-[280px_minmax(0,1fr)_56px] lg:gap-4 lg:overflow-visible lg:px-4 lg:py-3"
          }
        >
          <div className="hidden lg:block">
            <DesktopLeftNav />
          </div>

          <main
            className={
              mobileFeed
                ? "min-h-0 min-w-0 flex-1 overflow-hidden lg:overflow-visible lg:pb-4"
                : "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y pb-[calc(5rem+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] lg:overflow-visible lg:pb-4"
            }
          >
            {children}
          </main>

          <div className="hidden lg:block">
            <DesktopHomeIconRail />
          </div>

          {/* The feed shell is a fixed full-screen container, so the nav is anchored
              inside it. Everywhere else the nav must live outside this wrapper so it
              stays pinned to the viewport and can never scroll up with the page. */}
          {mobileFeed && <BottomNav />}
        </div>

        {!mobileFeed && <BottomNav />}

        <GlobalRadioPlayer />
        <GlobalPlaylistPlayer />
        <PlaylistPlayerSheet />
        {location.pathname !== "/auth" && <IncognitoFeedWindow />}
      </div>

    );
  }

  return (
    <div className="relative mx-auto min-h-screen min-w-0 max-w-lg overflow-x-hidden overscroll-x-none bg-background text-foreground transition-colors lg:max-w-3xl">
      {showMobileTopBar && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border/70 bg-background/95 px-4 py-2.5 shadow-[0_1px_0_hsl(var(--border)/0.35)] backdrop-blur-xl">
          {backSlot}
          {actionButtons}
        </div>
      )}

      <main className="min-w-0 pb-20">{children}</main>
      <GlobalRadioPlayer />
      <GlobalPlaylistPlayer />
      <PlaylistPlayerSheet />
      <BottomNav />
      {location.pathname !== "/auth" && <IncognitoFeedWindow />}
    </div>
  );
};

export default AppLayout;