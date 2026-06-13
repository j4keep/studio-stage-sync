import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Minus, Eye, GripHorizontal, Home, ImagePlus, Music, User, Maximize2, Minimize2, ExternalLink } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchFeedItems, type FeedItem } from "@/lib/feed-items";
import FeedPostCard from "@/components/feed/FeedPostCard";

const STORAGE_KEY = "incognito-feed-window-pos";
const SIZE_KEY = "incognito-feed-window-size";
const OPEN_KEY = "incognito-feed-window-open";
const MINIMIZED_KEY = "incognito-feed-window-minimized";
const LAST_STUDIO_ROUTE_KEY = "wheuat-last-wstudio-route";
const DEFAULT_STUDIO_ROUTE = "/wstudio/session/join";

interface Pos {
  x: number;
  y: number;
}

type SizeMode = "small" | "large";

const SIZE_DIMS: Record<SizeMode, { w: number; h: number }> = {
  small: { w: 220, h: 360 },
  large: { w: 320, h: 560 },
};

const getStoredStudioRoute = () => {
  try {
    return localStorage.getItem(LAST_STUDIO_ROUTE_KEY) || DEFAULT_STUDIO_ROUTE;
  } catch {
    return DEFAULT_STUDIO_ROUTE;
  }
};

const IncognitoFeedWindow = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [minimized, setMinimized] = useState(() => {
    try {
      return sessionStorage.getItem(MINIMIZED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [sizeMode, setSizeMode] = useState<SizeMode>(() => {
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      if (raw === "small" || raw === "large") return raw;
    } catch (error) {
      void error;
    }
    return "large";
  });
  const [pos, setPos] = useState<Pos>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      void error;
    }
    return { x: Math.max(16, window.innerWidth - 340), y: Math.max(60, window.innerHeight - 600) };
  });
  const dragRef = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);
  const draggedRecentlyRef = useRef(false);
  const dragResetTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
    enabled: open,
  });
  const feedPosts = items.filter((it): it is Extract<FeedItem, { itemType: "post" }> => it.itemType === "post");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch (error) {
      void error;
    }
  }, [pos]);

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, sizeMode);
    } catch (error) {
      void error;
    }
  }, [sizeMode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(OPEN_KEY, String(open));
      sessionStorage.setItem(MINIMIZED_KEY, String(minimized));
    } catch (error) {
      void error;
    }
  }, [open, minimized]);

  useEffect(() => {
    if (location.pathname.startsWith("/wstudio")) {
      try {
        localStorage.setItem(LAST_STUDIO_ROUTE_KEY, `${location.pathname}${location.search}${location.hash}`);
      } catch (error) {
        void error;
      }
    }
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!open || minimized) return;
    const container = scrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).getAttribute("data-index"));
            if (!Number.isNaN(idx)) setCurrentIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );
    container.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [open, minimized, feedPosts.length]);

  const startDrag = (clientX: number, clientY: number) => {
    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    dragRef.current = { dx: clientX - rect.left, dy: clientY - rect.top, startX: clientX, startY: clientY, moved: false };
  };

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (!dragRef.current) return;
      if ("preventDefault" in e) e.preventDefault();
      const point = "touches" in e ? e.touches[0] : (e as MouseEvent | PointerEvent);
      if (Math.hypot(point.clientX - dragRef.current.startX, point.clientY - dragRef.current.startY) > 4) {
        dragRef.current.moved = true;
      }
      const x = point.clientX - dragRef.current.dx;
      const y = point.clientY - dragRef.current.dy;
      setPos({ x, y });
    };
    const stop = () => {
      if (dragRef.current?.moved) {
        draggedRecentlyRef.current = true;
        if (dragResetTimerRef.current) window.clearTimeout(dragResetTimerRef.current);
        dragResetTimerRef.current = window.setTimeout(() => {
          draggedRecentlyRef.current = false;
        }, 120);
      }
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
      if (dragResetTimerRef.current) window.clearTimeout(dragResetTimerRef.current);
    };
  }, []);

  if (!user) return null;

  // Floating bubble (closed)
  if (!open) {
    return createPortal(
      <button
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        className="fixed z-[9999] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
        style={{ right: 16, bottom: 96 }}
        aria-label="Open incognito feed"
      >
        <Eye className="w-5 h-5" />
      </button>,
      document.body
    );
  }

  const dims = SIZE_DIMS[sizeMode];
  const width = dims.w;
  const height = minimized ? 44 : dims.h;

  const navTabs = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/feed", icon: ImagePlus, label: "Feed" },
    { path: getStoredStudioRoute, icon: Music, label: "W.Studio", matchPrefix: "/wstudio" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  const openStandaloneWindow = () => {
    try {
      sessionStorage.setItem(OPEN_KEY, "true");
      sessionStorage.setItem(MINIMIZED_KEY, "false");
    } catch (error) {
      void error;
    }
    window.open(window.location.href, "wheuat-incognito-window", "popup=yes,width=360,height=640,left=80,top=80");
  };

  return createPortal(
    <div
      ref={windowRef}
      className="fixed z-[9999] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col"
      style={{ left: pos.x, top: pos.y, width, height }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5 bg-muted/80 backdrop-blur cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
          startDrag(e.clientX, e.clientY);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
          startDrag(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
      >
        <GripHorizontal className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <div className="flex items-center gap-0.5 flex-1 justify-center">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const path = typeof tab.path === "function" ? tab.path() : tab.path;
            const isActive = tab.matchPrefix
              ? location.pathname.startsWith(tab.matchPrefix)
              : location.pathname === path;
            return (
              <button
                key={tab.label}
                onClick={(event) => {
                  if (draggedRecentlyRef.current) {
                    event.preventDefault();
                    return;
                  }
                  navigate(path);
                }}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-0.5" data-no-drag>
          <button
            onClick={openStandaloneWindow}
            className="w-6 h-6 rounded-full hover:bg-background/60 flex items-center justify-center"
            aria-label="Open standalone"
            title="Open standalone"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={() => setSizeMode((m) => (m === "small" ? "large" : "small"))}
            className="w-6 h-6 rounded-full hover:bg-background/60 flex items-center justify-center"
            aria-label={sizeMode === "small" ? "Expand" : "Shrink"}
            title={sizeMode === "small" ? "Expand" : "Shrink"}
          >
            {sizeMode === "small" ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setMinimized((m) => !m)}
            className="w-6 h-6 rounded-full hover:bg-background/60 flex items-center justify-center"
            aria-label="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 rounded-full hover:bg-background/60 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory bg-black"
          style={{ scrollSnapType: "y mandatory" }}
        >
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedPosts.length === 0 ? (
            <div className="h-full flex items-center justify-center px-4">
              <p className="text-white/60 text-xs text-center">No posts yet</p>
            </div>
          ) : (
            feedPosts.map((item, index) => (
              <div
                key={item.id}
                data-index={index}
                className="h-full w-full snap-start snap-always relative"
                style={{ scrollSnapAlign: "start", height: height - 40 }}
              >
                <FeedPostCard post={item} currentUserId={user?.id} isActive={index === currentIndex} />
              </div>
            ))
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

export default IncognitoFeedWindow;
