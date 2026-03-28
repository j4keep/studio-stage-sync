import { useState, useEffect } from "react";
import { Home, ImagePlus, User, Music } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPro, showProModal, gatedFeature, requirePro, closeProModal, activatePro } = useProGate();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHidden(detail?.hidden ?? false);
    };
    window.addEventListener("feed-nav-toggle", handler);
    return () => window.removeEventListener("feed-nav-toggle", handler);
  }, []);

  // Reset visibility when leaving feed
  useEffect(() => {
    if (location.pathname !== "/feed") setHidden(false);
  }, [location.pathname]);

  const tabs = [
    { path: "/", label: "Home", icon: Home, pro: false },
    { path: "/feed", label: "Feed", icon: ImagePlus, pro: false },
    { path: "/ai-studio", label: "W.Studio", icon: Music, pro: true },
    { path: "/profile", label: "Profile", icon: User, pro: false },
  ];

  const handleTabClick = (tab: typeof tabs[0]) => {
    if (tab.pro && !isPro) {
      requirePro("AI Music Studio");
    } else {
      navigate(tab.path);
    }
  };

  return (
    <>
      <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl safe-area-bottom transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}>
        <div className="flex items-center justify-around py-2 px-1 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                onClick={() => handleTabClick(tab)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 transition-all ${isActive ? "drop-shadow-[0_0_8px_hsl(204,100%,50%,0.6)]" : ""}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-glow" : ""}`}>{tab.label}</span>
                {tab.pro && !isPro && (
                  <span className="absolute -top-0.5 -right-0.5 text-[6px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full font-bold leading-none">PRO</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </>
  );
};

export default BottomNav;
