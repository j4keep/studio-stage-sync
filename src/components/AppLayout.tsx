import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import GlobalRadioPlayer from "./GlobalRadioPlayer";
import GlobalPlaylistPlayer from "./GlobalPlaylistPlayer";
import PlaylistPlayerSheet from "./PlaylistPlayerSheet";
import NotificationBell from "./NotificationBell";
import YajBuddyIcon from "./YajBuddyIcon";
import { MessageCircle } from "lucide-react";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "./ProGateModal";
import IncognitoFeedWindow from "./IncognitoFeedWindow";
import DesktopTopBar from "./desktop/DesktopTopBar";
import DesktopLeftNav from "./desktop/DesktopLeftNav";
import DesktopRightRail from "./desktop/DesktopRightRail";

function isDesktopShellPath(pathname: string) {
  if (pathname.startsWith("/jobs/interview")) return false;
  if (
    pathname === "/" ||
    pathname === "/explore" ||
    pathname === "/jobs" ||
    pathname === "/profile" ||
    pathname === "/my-jobs" ||
    pathname === "/employer-dashboard" ||
    pathname === "/employer"
  ) {
    return true;
  }
  if (pathname.startsWith("/jobs/")) return true;
  return false;
}

/** Home keeps the desktop right rail (Trending / People / Open roles). */
function showHomeRightRail(pathname: string) {
  return pathname === "/";
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
  const withRightRail = showHomeRightRail(location.pathname);
  const showMobileTopBar =
    !["/auth", "/"].includes(location.pathname) && !isPodcastWorkspace && !isPodcastLobby;

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
        <IncognitoFeedWindow />
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
          <div className="sticky top-0 z-40 flex items-center justify-end gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-xl lg:hidden">
            <button
              onClick={handleAskYaj}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted"
              aria-label="Ask YAJ Buddy"
            >
              <YajBuddyIcon className="w-4.5 h-4.5" active={location.pathname === "/ask-yaj"} />
              {!isPro && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 py-0.5 text-[6px] font-bold leading-none text-primary-foreground">
                  PRO
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/messages")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            >
              <MessageCircle className="h-4 w-4 text-foreground" />
            </button>
            <NotificationBell />
          </div>
        )}

        <div
          className={
            withRightRail
              ? "relative mx-auto w-full max-w-lg min-w-0 overflow-x-hidden lg:grid lg:max-w-[1280px] lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:gap-4 lg:overflow-visible lg:px-4 lg:py-3"
              : "relative mx-auto w-full max-w-lg min-w-0 overflow-x-hidden lg:grid lg:max-w-[1280px] lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-4 lg:overflow-visible lg:px-4 lg:py-3"
          }
        >
          <div className="hidden lg:block">
            <DesktopLeftNav />
          </div>

          <main className="min-w-0 pb-20 lg:pb-4 lg:min-h-0">
            {children}
          </main>

          {withRightRail && (
            <div className="hidden lg:block">
              <DesktopRightRail />
            </div>
          )}

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
        <div className="sticky top-0 z-40 flex items-center justify-end gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-xl">
          <button
            onClick={handleAskYaj}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Ask YAJ Buddy"
          >
            <YajBuddyIcon className="w-4.5 h-4.5" active={location.pathname === "/ask-yaj"} />
            {!isPro && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 py-0.5 text-[6px] font-bold leading-none text-primary-foreground">
                PRO
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/messages")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          >
            <MessageCircle className="h-4 w-4 text-foreground" />
          </button>
          <NotificationBell />
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
