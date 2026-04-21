import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import GlobalRadioPlayer from "./GlobalRadioPlayer";
import GlobalPlaylistPlayer from "./GlobalPlaylistPlayer";
import PlaylistPlayerSheet from "./PlaylistPlayerSheet";
import NotificationBell from "./NotificationBell";
import JhiIcon from "./JhiIcon";
import UnratedSessionPopup from "./UnratedSessionPopup";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "./ProGateModal";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const isStudioPage =
    location.pathname.startsWith("/wstudio") || location.pathname === "/ai-studio";
  const isWStudioJoinPage = location.pathname === "/wstudio/session/join";
  const isFullScreenPage = ["/feed"].includes(location.pathname);
  const showTopBar = !isStudioPage && !["/auth", "/feed", "/ai-studio"].includes(location.pathname);

  useEffect(() => {
    if (!isWStudioJoinPage) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [isWStudioJoinPage]);

  const handleAskJhi = () => {
    if (!isPro) {
      requirePro("Ask Jhi");
    } else {
      navigate("/ask-jhi");
    }
  };

  if (isFullScreenPage) {
    return (
      <div className="min-h-screen bg-black text-foreground max-w-lg mx-auto relative">
        {children}
        <GlobalRadioPlayer />
        <GlobalPlaylistPlayer />
        <PlaylistPlayerSheet />
        <BottomNav />
      </div>
    );
  }

  // W.Studio pages get full width (no max-w-lg) so DAW fills the screen
  const containerClass = isStudioPage
    ? `bg-background text-foreground relative ${isWStudioJoinPage ? "h-dvh overflow-hidden" : "min-h-screen"}`
    : "min-h-screen bg-background text-foreground max-w-lg mx-auto relative";

  return (
    <div
      className={`${containerClass}${isStudioPage ? " wstudio-app-backdrop" : ""}`}
      {...(isStudioPage ? { "data-wstudio-app": "true" as const } : {})}
    >
      {showTopBar && (
        <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-2 flex items-center justify-end gap-2 wstudio-nav">
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
      <main className={isStudioPage ? `wstudio-main ${isWStudioJoinPage ? "h-full overflow-hidden" : ""}` : "pb-20"}>{children}</main>
      <GlobalRadioPlayer />
      <GlobalPlaylistPlayer />
      <PlaylistPlayerSheet />
      <div className="wstudio-nav">
        <BottomNav />
      </div>
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
      <UnratedSessionPopup />
    </div>
  );
};

export default AppLayout;
