import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import GlobalRadioPlayer from "./GlobalRadioPlayer";

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative">
      <main className="pb-20">{children}</main>
      <GlobalRadioPlayer />
      <BottomNav />
    </div>
  );
};

export default AppLayout;
