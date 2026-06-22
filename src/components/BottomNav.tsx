import { useState, useEffect } from "react";
import { Home, User, Tv, MessageCircle, AtSign } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import CreatePostSheet from "@/components/feed/CreatePostSheet";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPro, showProModal, gatedFeature, requirePro, closeProModal, activatePro } = useProGate();
  const [hidden, setHidden] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHidden(detail?.hidden ?? false);
    };
    const openCreate = () => setShowCreate(true);
    window.addEventListener("feed-nav-toggle", handler);
    window.addEventListener("open-create-post", openCreate);
    return () => {
      window.removeEventListener("feed-nav-toggle", handler);
      window.removeEventListener("open-create-post", openCreate);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== "/feed" && location.pathname !== "/") setHidden(false);
  }, [location.pathname]);

  const tabs = [
    { path: "/", label: "Home", icon: Home },
    { path: "/tv", label: "W.STUDIO", icon: Tv, matchPrefix: "/tv" },
    { path: "/ask-jhi", label: "JiHi", icon: MessageCircle },
    { path: "/profile", label: "Profile", icon: User },
  ] as const;

  const isActive = (tab: typeof tabs[number]) =>
    "matchPrefix" in tab && tab.matchPrefix
      ? location.pathname.startsWith(tab.matchPrefix)
      : location.pathname === tab.path;

  // Render order: Home, W.STUDIO, [CENTER @], JiHi, Profile
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  const renderTab = (tab: typeof tabs[number]) => {
    const active = isActive(tab);
    const Icon = tab.icon;
    return (
      <button
        key={tab.path}
        onClick={() => navigate(tab.path)}
        className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 ${
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className={`w-5 h-5 transition-all ${active ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.55)]" : ""}`} />
        <span className={`text-[10px] font-medium ${active ? "text-glow" : ""}`}>{tab.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl safe-area-bottom transition-transform duration-300 ${
          hidden ? "translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="flex items-center justify-around py-2 px-1 max-w-lg mx-auto gap-0">
          {left.map(renderTab)}

          {/* Center neon @ create button */}
          <button
            onClick={() => setShowCreate(true)}
            aria-label="Create"
            className="relative -mt-5 flex items-center justify-center w-12 h-12 rounded-full bg-background border border-primary/60 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.65)] hover:shadow-[0_0_26px_hsl(var(--primary)/0.85)] transition-shadow"
          >
            <AtSign className="w-5 h-5 drop-shadow-[0_0_6px_hsl(var(--primary))]" />
            <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-primary/40 animate-pulse" />
          </button>

          {right.map(renderTab)}
        </div>
      </nav>
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
      <CreatePostSheet open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
};

export default BottomNav;
