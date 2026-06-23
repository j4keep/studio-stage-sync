import { useState, useEffect } from "react";
import { Home, User, MessageCircle, AtSign, Mic2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import CreatePostSheet from "@/components/feed/CreatePostSheet";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const [hidden, setHidden] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const isFeed = location.pathname === "/feed" || location.pathname === "/";

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
    { path: "/tv", label: "W.STUDIO", icon: Mic2 },
    { path: "/ask-jhi", label: "JiHi", icon: MessageCircle },
    { path: "/profile", label: "Profile", icon: User },
  ] as const;

  const isActive = (tab: typeof tabs[number]) => location.pathname === tab.path;

  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  const renderTab = (tab: typeof tabs[number]) => {
    const active = isActive(tab);
    const Icon = tab.icon;
    const handleClick = () => {
      if (tab.path === "/" && isFeed) {
        window.dispatchEvent(new Event("feed-scroll-top"));
        window.dispatchEvent(new CustomEvent("feed-nav-toggle", { detail: { hidden: false } }));
        return;
      }
      navigate(tab.path);
    };
    return (
      <button
        key={tab.path}
        onClick={handleClick}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 min-h-[3rem] rounded-lg transition-all duration-200 ${
          active
            ? isFeed ? "text-white" : "text-primary"
            : isFeed ? "text-white/55 hover:text-white/80" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon
          className={`w-[1.35rem] h-[1.35rem] transition-all ${
            active ? (isFeed ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]" : "drop-shadow-[0_0_8px_hsl(var(--primary)/0.55)]") : ""
          }`}
          strokeWidth={active ? 2.5 : 2}
        />
        <span className={`text-[10px] font-semibold leading-tight ${active && !isFeed ? "text-glow" : ""}`}>{tab.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-2xl safe-area-bottom transition-transform duration-300 ${
          isFeed
            ? "border-white/10 bg-black/75 supports-[backdrop-filter]:bg-black/55"
            : "border-border bg-background/90"
        } ${hidden ? "translate-y-full" : "translate-y-0"}`}
      >
        <div className="flex items-end py-1.5 px-2 max-w-lg mx-auto gap-0.5">
          {left.map(renderTab)}

          <div className="flex-1 flex items-center justify-center pb-0.5">
            <button
              onClick={() => setShowCreate(true)}
              aria-label="Create"
              className="relative flex items-center justify-center w-12 h-12 rounded-full bg-black/80 border-2 border-violet-400 text-violet-300 shadow-[0_0_20px_rgba(168,85,247,0.75),0_0_40px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(168,85,247,0.95)] transition-shadow active:scale-95"
            >
              <AtSign className="w-5 h-5 drop-shadow-[0_0_8px_rgba(196,181,253,0.9)]" strokeWidth={2.5} />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-violet-400/50 animate-pulse" />
            </button>
          </div>

          {right.map(renderTab)}
        </div>
      </nav>
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
      <CreatePostSheet open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
};

export default BottomNav;
