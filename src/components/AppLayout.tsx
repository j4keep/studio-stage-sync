import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import GlobalRadioPlayer from "./GlobalRadioPlayer";
import GlobalPlaylistPlayer from "./GlobalPlaylistPlayer";

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative">
      <main className="pb-20">{children}</main>
      <GlobalRadioPlayer />
      <GlobalPlaylistPlayer />
      <BottomNav />
    </div>
  );
};

export default AppLayout;
