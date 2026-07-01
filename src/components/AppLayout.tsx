import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import GlobalRadioPlayer from "./GlobalRadioPlayer";
import GlobalPlaylistPlayer from "./GlobalPlaylistPlayer";
import PlaylistPlayerSheet from "./PlaylistPlayerSheet";
import NotificationBell from "./NotificationBell";
import JhiIcon from "./JhiIcon";
import { MessageCircle } from "lucide-react";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "./ProGateModal";
import IncognitoFeedWindow from "./IncognitoFeedWindow";
import FeedPage from "@/pages/FeedPage";
import BreakGuard, { useTakeABreak } from "./BreakGuard";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const onBreak = useTakeABreak();
  const isFeedRoute = location.pathname === "/" || location.pathname === "/feed";
  const feedPlaybackActive = isFeedRoute && !onBreak;
  const isPodcastWorkspace =
    (location.pathname.startsWith("/tv/podcast/") && location.pathname !== "/tv/podcast") ||
    location.pathname.startsWith("/podcast/room/");
  const isPodcastLobby = location.pathname === "/tv/podcast";
  const isFullScreenPage = isFeedRoute || isPodcastWorkspace || isPodcastLobby;
  const showTopBar = !["/auth", "/", "/feed"].includes(location.pathname) && !isPodcastWorkspace && !isPodcastLobby;

  const handleAskJhi = () => {
    if (!isPro) {
      requirePro("Ask Jhi");
    } else {
      navigate("/ask-jhi");
    }
  };

  const persistentFeed =
    location.pathname !== "/auth" ? (
      <div
        className={`fixed top-0 left-1/2 z-[1] h-[100dvh] w-full max-w-[440px] -translate-x-1/2 overflow-hidden bg-black ${
          feedPlaybackActive ? "" : "pointer-events-none invisible"
        }`}
        aria-hidden={!feedPlaybackActive}
      >
        <BreakGuard>
          <FeedPage feedVisible={feedPlaybackActive} />
        </BreakGuard>
      </div>
    ) : null;

  if (isFullScreenPage) {
    if (isPodcastWorkspace || isPodcastLobby) {
      return (
        <>
          {persistentFeed}
          <div className="min-h-screen bg-background text-foreground relative">
            {children}
            {location.pathname !== "/" && <IncognitoFeedWindow />}
          </div>
        </>
      );
    }

    return (
      <>
        {persistentFeed}
        <div className="fixed inset-0 z-[3] flex items-center justify-center overflow-hidden bg-black text-foreground">
          <div className="pointer-events-none relative h-[100dvh] w-full max-w-[440px] overflow-hidden bg-transparent shadow-2xl">
            {!isFeedRoute ? <div className="pointer-events-auto h-full">{children}</div> : null}
            <div className="pointer-events-auto">
              <BottomNav />
            </div>
          </div>
          <GlobalRadioPlayer />
          <GlobalPlaylistPlayer />
          <PlaylistPlayerSheet />
          {location.pathname !== "/" && <IncognitoFeedWindow />}
        </div>
      </>
    );
  }

  const containerWidthClass = "max-w-lg";

  return (
    <>
      {persistentFeed}
      <div className={`relative z-10 min-h-screen overflow-x-hidden bg-background text-foreground ${containerWidthClass} mx-auto`}>
        {showTopBar && (
          <div className="sticky top-0 z-40 flex items-center justify-end gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-xl">
            <button
              onClick={handleAskJhi}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            >
              <JhiIcon className="w-4.5 h-4.5" active={location.pathname === "/ask-jhi"} />
              {!isPro && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1 py-0.5 text-[6px] font-bold leading-none text-primary-foreground">
                  PRO
                </span>
              )}
            </button>
            <button onClick={() => navigate("/messages")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-4 w-4 text-foreground" />
            </button>
            <NotificationBell />
          </div>
        )}
        <main className="pb-20">{children}</main>
        <GlobalRadioPlayer />
        <GlobalPlaylistPlayer />
        <PlaylistPlayerSheet />
        <BottomNav />
        <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
        {location.pathname !== "/auth" && <IncognitoFeedWindow />}
      </div>
    </>
  );
};

export default AppLayout;
