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

const AppLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const isPodcastWorkspace =
    (location.pathname.startsWith("/tv/podcast/") && location.pathname !== "/tv/podcast") ||
    location.pathname.startsWith("/podcast/room/");
  const isPodcastLobby = location.pathname === "/tv/podcast";
  const isFullScreenPage = ["/feed"].includes(location.pathname) || isPodcastWorkspace || isPodcastLobby;
  const showTopBar = !["/auth", "/feed"].includes(location.pathname) && !isPodcastWorkspace && !isPodcastLobby;

  const handleAskJhi = () => {
    if (!isPro) {
      requirePro("Ask Jhi");
    } else {
      navigate("/ask-jhi");
    }
  };

  if (isFullScreenPage) {
    if (isPodcastWorkspace || isPodcastLobby) {
      return (
        <div className="min-h-screen bg-background text-foreground relative">
          {children}
          <IncognitoFeedWindow />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-black text-foreground max-w-lg mx-auto relative">
        {children}
        <GlobalRadioPlayer />
        <GlobalPlaylistPlayer />
        <PlaylistPlayerSheet />
        <BottomNav />
        <IncognitoFeedWindow />
      </div>
    );
  }

  const containerWidthClass = "max-w-lg";

  return (
    <div className={`min-h-screen bg-background text-foreground ${containerWidthClass} mx-auto relative`}>

      {showTopBar && (
        <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-2 flex items-center justify-end gap-2">
          <button
            onClick={handleAskJhi}
            className="relative w-9 h-9 rounded-full bg-muted flex items-center justify-center"
          >
            <JhiIcon className="w-4.5 h-4.5" active={location.pathname === "/ask-jhi"} />
            {!isPro && (
              <span className="absolute -top-0.5 -right-0.5 text-[6px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full font-bold leading-none">PRO</span>
            )}
          </button>
          <button onClick={() => navigate("/messages")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-foreground" />
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
  );
};

export default AppLayout;
