import { useState, useEffect, useCallback } from "react";
import { Home, User, Compass } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import { useCreatePostSheet } from "@/hooks/use-create-post-sheet";
import CreatePostSheet from "@/components/feed/CreatePostSheet";
import CreateNavIcon from "@/components/CreateNavIcon";
import YajAiGeneratorIcon from "@/components/YajAiGeneratorIcon";
import { useModerationStatus } from "@/hooks/use-moderation-status";
import { toast } from "sonner";

const CREATE_WAVE_MS = 720;

type Tab = {
  path: string;
  label: string;
  kind: "lucide" | "ai";
  icon?: typeof Home;
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const [hidden, setHidden] = useState(false);
  const [waving, setWaving] = useState(false);
  const { open: showCreate, cameraStream, openCreate, closeCreate } = useCreatePostSheet();
  const { canPublish } = useModerationStatus();
  const isFeed = location.pathname === "/feed" || location.pathname === "/";

  const tryOpenCreate = useCallback(async () => {
    if (!canPublish) {
      toast.message("Community Timeout", {
        description: "Posting is paused until your cooldown ends.",
      });
      navigate("/community-timeout");
      return;
    }
    await openCreate();
  }, [canPublish, navigate, openCreate]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHidden(detail?.hidden ?? false);
    };
    const openCreateHandler = () => void tryOpenCreate();
    window.addEventListener("feed-nav-toggle", handler);
    window.addEventListener("open-create-post", openCreateHandler);
    return () => {
      window.removeEventListener("feed-nav-toggle", handler);
      window.removeEventListener("open-create-post", openCreateHandler);
    };
  }, [tryOpenCreate]);

  useEffect(() => {
    if (location.pathname !== "/feed" && location.pathname !== "/") setHidden(false);
  }, [location.pathname]);

  const tabs: Tab[] = [
    { path: "/", label: "Home", kind: "lucide", icon: Home },
    { path: "/explore", label: "Explore", kind: "lucide", icon: Compass },
    { path: "/ask-yaj", label: "YAJ AI", kind: "ai" },
    { path: "/profile", label: "Profile", kind: "lucide", icon: User },
  ];

  const isActive = (tab: Tab) => {
    if (tab.path === "/ask-yaj") {
      return location.pathname === "/ask-yaj" || location.pathname.startsWith("/ask-yaj/");
    }
    return location.pathname === tab.path;
  };

  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  const handleCreate = async () => {
    if (waving || showCreate) return;
    setWaving(true);
    await tryOpenCreate();
    window.setTimeout(() => setWaving(false), CREATE_WAVE_MS);
  };

  const renderTab = (tab: Tab) => {
    const active = isActive(tab);
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
            ? isFeed
              ? "text-foreground"
              : "text-primary"
            : isFeed
              ? "text-muted-foreground hover:text-foreground"
              : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {tab.kind === "ai" ? (
          <YajAiGeneratorIcon
            className={`w-[1.55rem] h-[1.55rem] transition-all ${
              active
                ? isFeed
                  ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.35)]"
                  : "drop-shadow-[0_0_8px_hsl(var(--primary)/0.55)]"
                : ""
            }`}
            active={active}
          />
        ) : (
          tab.icon && (
            <tab.icon
              className={`w-[1.35rem] h-[1.35rem] transition-all ${
                active
                  ? isFeed
                    ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.35)]"
                    : "drop-shadow-[0_0_8px_hsl(var(--primary)/0.55)]"
                  : ""
              }`}
              strokeWidth={active ? 2.5 : 2}
            />
          )
        )}
        <span className={`text-[10px] font-semibold leading-tight ${active && !isFeed ? "text-glow" : ""}`}>
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <>
      <nav
        className={`lg:hidden ${
          isFeed ? "absolute inset-x-0 bottom-0 w-full" : "fixed bottom-0 left-0 right-0"
        } z-50 border-t backdrop-blur-2xl safe-area-bottom transition-transform duration-300 ${
          isFeed
            ? "border-border bg-background/90 supports-[backdrop-filter]:bg-background/80"
            : "border-border bg-background/90"
        } ${hidden ? "translate-y-full" : "translate-y-0"}`}
      >
        <div className="flex items-end py-1.5 px-2 max-w-lg mx-auto gap-0.5">
          {left.map(renderTab)}

          <div className="flex-1 flex items-center justify-center pb-0.5">
            <button
              onClick={() => void handleCreate()}
              disabled={waving}
              aria-label="Create"
              className="relative flex items-center justify-center w-12 h-12 shrink-0 rounded-full bg-transparent p-0 border-0 shadow-[0_0_8px_rgba(168,85,247,0.35)] hover:shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-shadow active:scale-95 disabled:opacity-90"
            >
              {waving ? (
                <span
                  className="text-[1.65rem] leading-none select-none animate-create-wave origin-[70%_90%]"
                  role="img"
                  aria-hidden
                >
                  👋
                </span>
              ) : (
                <CreateNavIcon className="w-12 h-12" />
              )}
            </button>
          </div>

          {right.map(renderTab)}
        </div>
      </nav>
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
      <CreatePostSheet open={showCreate} onClose={closeCreate} cameraStream={cameraStream} />
    </>
  );
};

export default BottomNav;
