import { useState, useEffect } from "react";
import { Home, User, Mic2, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import CreatePostSheet from "@/components/feed/CreatePostSheet";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const [hidden, setHidden] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHidden(detail?.hidden ?? false);
    };
    window.addEventListener("feed-nav-toggle", handler);
    return () => window.removeEventListener("feed-nav-toggle", handler);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/feed") setHidden(false);
  }, [location.pathname]);

  const leftTabs = [
    { path: "/", label: "Home", icon: Home },
  ];
  const rightTabs = [
    { path: "/tv", label: "W.STUDIO", icon: Mic2, matchPrefix: "/tv" },
    { path: "/profile", label: "Profile", icon: User },
  ];

  const renderTab = (tab: any) => {
    const isActive =
      tab.matchPrefix
        ? location.pathname.startsWith(tab.matchPrefix)
        : location.pathname === tab.path;
    const Icon = tab.icon;
    return (
      <button
        key={tab.path}
        onClick={() => navigate(tab.path)}
        className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className={`w-5 h-5 transition-all ${isActive ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.55)]" : ""}`} />
        <span className={`text-[10px] font-medium ${isActive ? "text-glow" : ""}`}>{tab.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl safe-area-bottom transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}>
        <div className="flex items-center justify-around py-2 px-1 max-w-lg mx-auto gap-0 relative">
          {leftTabs.map(renderTab)}

          {/* Neon center create button */}
          <button
            onClick={() => setShowCreate(true)}
            aria-label="Create"
            className="relative -mt-7 w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.7),0_0_48px_hsl(var(--primary)/0.4)] ring-2 ring-primary/60 hover:scale-105 active:scale-95 transition-transform"
          >
            <span className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" />
            <Plus className="relative w-7 h-7" strokeWidth={2.5} />
          </button>

          {rightTabs.map(renderTab)}
        </div>
      </nav>
      <CreatePostSheet open={showCreate} onClose={() => setShowCreate(false)} />
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </>
  );
};

export default BottomNav;
