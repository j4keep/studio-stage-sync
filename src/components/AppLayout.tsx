import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import GlobalRadioPlayer from "./GlobalRadioPlayer";
import GlobalPlaylistPlayer from "./GlobalPlaylistPlayer";
import PlaylistPlayerSheet from "./PlaylistPlayerSheet";
import NotificationBell from "./NotificationBell";
import YajAiGeneratorIcon from "./YajAiGeneratorIcon";
import MessagesInboxButton from "./MessagesInboxButton";
import { ArrowLeft } from "lucide-react";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "./ProGateModal";
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
    pathname === "/local-help" ||
    pathname === "/marketplace" ||
    pathname === "/wellness" ||
    pathname === "/jobs" ||
    pathname === "/ask-yaj" ||
    pathname === "/profile" ||
    pathname === "/radio" ||
    pathname === "/library" ||
    pathname === "/playlists" ||
    pathname === "/my-songs" ||
    pathname === "/my-jobs" ||
    pathname === "/my-gigs" ||
    pathname === "/messages" ||
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
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const isPodcastWorkspace =
    (location.pathname.startsWith("/tv/podcast/") && location.pathname !== "/tv/podcast") ||
    location.pathname.startsWith("/podcast/room/");
  const isPodcastLobby = location.pathname === "/tv/podcast";
  const desktopShell = isDesktopShellPath(location.pathname);
  const mobileFeed = isMobileFeedPath(location.pathname);
  const isMarketplace = location.pathname === "/marketplace" || location.pathname.startsWith("/marketplace/");
  const isWellness = location.pathname === "/wellness" || location.pathname.startsWith("/wellness/");

  // Workout music belongs only to the Move screen. This route-level guard
  // also covers exits through bottom navigation, browser history, and links.
  useEffect(() => {
    if (location.pathname !== "/wellness/move") workoutMusic.stop();
  }, [location.pathname]);
  // Marketplace / Wellness use their own headers (back → Explore); keep YAJ BottomNav for integration.
  const showMobileTopBar =
    !["/auth", "/", "/feed"].includes(location.pathname) &&
    !isPodcastWorkspace &&
    !isPodcastLobby &&
    !isMarketplace &&
    !isWellness;
  const rootTabs = ["/", "/feed", "/explore", "/ask-yaj", "/profile", "/auth"];
  const showBackButton = !rootTabs.includes(location.pathname);

  const backSlot = showBackButton ? (
    <button
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4 text-foreground" />
    </button>
  ) : (
    <span />
  );


  const handleAskYaj = () => {
    if (!isPro) {
      requirePro("Ask YAJ");
    } else {
      navigate("/ask-yaj");
    }
  };

  if (isPodcastWorkspace || isPodcastLobby) {
    return (
      <div className="relative min-h-screen overflow-x-hidden overscroll-x-none bg-background text-foreground">
        {children}
        {location.pathname !== "/" && <IncognitoFeedWindow />}
      </div>
    );
  }

  if (desktopShell) {
    return (
      <div className="min-h-screen overflow-x-hidden overscroll-x-none touch-pan-y bg-background text-foreground lg:bg-[hsl(var(--muted)/0.45)]">
        <div className="hidden lg:block">
          <DesktopTopBar />
        </div>

        {showMobileTopBar && (
          <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-xl lg:hidden">
            {backSlot}
            <div className="flex items-center gap-2">

            <button
              onClick={handleAskYaj}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted"
              aria-label="Ask YAJ"
            >
              <YajAiGeneratorIcon className="h-5 w-5" active={location.pathname === "/ask-yaj"} />
              {!isPro && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 py-0.5 text-[6px] font-bold leading-none text-primary-foreground">
                  PRO
                </span>
              )}
            </button>
            <MessagesInboxButton />
            <NotificationBell />
            <IncognitoHeaderButton />
            </div>
          </div>

        )}

        <div
          className={
            mobileFeed
              ? // Phone feed frame. Desktop: left nav | content | icon rail
                "fixed inset-0 mx-auto flex w-full max-w-[440px] flex-col overflow-hidden bg-background lg:static lg:mx-auto lg:grid lg:h-auto lg:max-w-[1400px] lg:grid-cols-[280px_minmax(0,1fr)_56px] lg:gap-4 lg:overflow-visible lg:bg-transparent lg:px-4 lg:py-3"
              : "relative mx-auto w-full max-w-lg min-w-0 overflow-x-hidden lg:grid lg:max-w-[1400px] lg:grid-cols-[280px_minmax(0,1fr)_56px] lg:gap-4 lg:overflow-visible lg:px-4 lg:py-3"
          }
        >
          <div className="hidden lg:block">
            <DesktopLeftNav />
          </div>

          <main
            className={
              mobileFeed
                ? "min-h-0 min-w-0 flex-1 overflow-hidden lg:overflow-visible lg:pb-4"
                : "min-w-0 pb-20 lg:pb-4"
            }
          >
            {children}
          </main>

          {/* Vertical menu icons on all desktop shell pages (same as Home) */}
          <div className="hidden lg:block">
            <DesktopHomeIconRail />
          </div>

          <BottomNav />
        </div>

        <GlobalRadioPlayer />
        <GlobalPlaylistPlayer />
        <PlaylistPlayerSheet />
        <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
        {location.pathname !== "/auth" && <IncognitoFeedWindow />}
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-screen min-w-0 max-w-lg overflow-x-hidden overscroll-x-none bg-background text-foreground lg:max-w-3xl">
      {showMobileTopBar && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-xl">
          {backSlot}
          <div className="flex items-center gap-2">
          <button

            onClick={handleAskYaj}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Ask YAJ"
          >
            <YajAiGeneratorIcon className="h-5 w-5" active={location.pathname === "/ask-yaj"} />
            {!isPro && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 py-0.5 text-[6px] font-bold leading-none text-primary-foreground">
                PRO
              </span>
            )}
          </button>
          <MessagesInboxButton />
          <NotificationBell />
          <IncognitoHeaderButton />
          </div>
        </div>

      )}
      <main className="min-w-0 pb-20">{children}</main>
      <GlobalRadioPlayer />
      <GlobalPlaylistPlayer />
      <PlaylistPlayerSheet />
      <BottomNav />
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
      {location.pathname !== "/auth" && <IncognitoFeedWindow />}
    </div>
  );
};

export default AppLayout;
