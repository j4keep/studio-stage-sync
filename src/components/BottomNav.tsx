import { useState, useEffect } from "react";
import { Home, User, Plus, Mic2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import JhiIcon from "@/components/JhiIcon";
import CreatePostSheet from "@/components/feed/CreatePostSheet";
import { useTakeABreak } from "@/hooks/use-take-a-break";
import { toast } from "@/hooks/use-toast";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPro, showProModal, gatedFeature, requirePro, closeProModal, activatePro } = useProGate();
  const [hidden, setHidden] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { onBreak } = useTakeABreak();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHidden(detail?.hidden ?? false);
    };
    window.addEventListener("feed-nav-toggle", handler);
    return () => window.removeEventListener("feed-nav-toggle", handler);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/feed" && location.pathname !== "/") setHidden(false);
  }, [location.pathname]);

  const isActive = (path: string, prefix?: string) =>
    prefix ? location.pathname.startsWith(prefix) : location.pathname === path;

  const handleCreate = () => {
    if (onBreak) {
      toast({ title: "You're on a break", description: "Posting is paused. Turn off Take a Break in Settings." });
      return;
    }
    setShowCreate(true);
  };

  const handleJhi = () => {
    if (!isPro) requirePro("Ask Jhi");
    else navigate("/ask-jhi");
  };

  const TabButton = ({ active, onClick, Icon, label, badge }: any) => (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className={`w-5 h-5 transition-all ${active ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.55)]" : ""}`} />
      <span className={`text-[10px] font-medium ${active ? "text-glow" : ""}`}>{label}</span>
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 text-[6px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full font-bold leading-none">{badge}</span>
      )}
    </button>
  );

  return (
    <>
      <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl safe-area-bottom transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}>
        <div className="flex items-end justify-around py-2 px-1 max-w-lg mx-auto gap-0 relative">
          <TabButton active={isActive("/")} onClick={() => navigate("/")} Icon={Home} label="Home" />
          <TabButton active={isActive("/tv", "/tv")} onClick={() => navigate("/tv")} Icon={Mic2} label="W.Studio" />

          {/* Center + create button */}
          <button
            onClick={handleCreate}
            className="relative -mt-7 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-primary/40 ring-4 ring-background"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)",
            }}
            aria-label="Create post"
          >
            <span className="absolute inset-0 rounded-full bg-primary/40 blur-md -z-10" />
            <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
          </button>

          <TabButton active={isActive("/profile")} onClick={() => navigate("/profile")} Icon={User} label="Profile" />
          <button
            onClick={handleJhi}
            className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 ${
              isActive("/ask-jhi") ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <JhiIcon className="w-5 h-5" active={isActive("/ask-jhi")} />
            <span className={`text-[10px] font-medium ${isActive("/ask-jhi") ? "text-glow" : ""}`}>J-Hi</span>
            {!isPro && (
              <span className="absolute -top-0.5 -right-0.5 text-[6px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full font-bold leading-none">PRO</span>
            )}
          </button>
        </div>
      </nav>
      <CreatePostSheet open={showCreate} onClose={() => setShowCreate(false)} />
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </>
  );
};

export default BottomNav;
