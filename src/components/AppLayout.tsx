import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import GlobalRadioPlayer from "./GlobalRadioPlayer";
import GlobalPlaylistPlayer from "./GlobalPlaylistPlayer";
import PlaylistPlayerSheet from "./PlaylistPlayerSheet";
import NotificationBell from "./NotificationBell";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const showTopBar = !["/auth"].includes(location.pathname);

  return (
    <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative">
      {showTopBar && (
        <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-2 flex items-center justify-end gap-2">
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
    </div>
  );
};

export default AppLayout;
