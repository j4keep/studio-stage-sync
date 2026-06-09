import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Minus, Eye, GripHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchFeedItems } from "@/lib/feed-items";
import FeedPostCard from "@/components/feed/FeedPostCard";

const STORAGE_KEY = "incognito-feed-window-pos";

interface Pos {
  x: number;
  y: number;
}

const IncognitoFeedWindow = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState<Pos>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { x: Math.max(16, window.innerWidth - 340), y: Math.max(60, window.innerHeight - 600) };
  });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
    enabled: open,
  });
  const feedPosts = items.filter((it: any) => it.itemType === "post");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {}
  }, [pos]);

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
    dragRef.current = { dx: clientX - rect.left, dy: clientY - rect.top };
  };

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const point = "touches" in e ? e.touches[0] : (e as MouseEvent);
      const w = windowRef.current?.offsetWidth ?? 320;
      const h = windowRef.current?.offsetHeight ?? 560;
      const x = Math.min(Math.max(0, point.clientX - dragRef.current.dx), window.innerWidth - w);
      const y = Math.min(Math.max(0, point.clientY - dragRef.current.dy), window.innerHeight - h);
      setPos({ x, y });
    };
    const stop = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  if (!user) return null;

  // Floating bubble (closed)
  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        className="fixed z-[60] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
        style={{ right: 16, bottom: 96 }}
        aria-label="Open incognito feed"
      >
        <Eye className="w-5 h-5" />
      </button>
    );
  }

  const width = 320;
  const height = minimized ? 44 : 560;

  return (
    <div
      ref={windowRef}
      className="fixed z-[60] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col"
      style={{ left: pos.x, top: pos.y, width, height }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/80 backdrop-blur cursor-grab active:cursor-grabbing select-none"
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <Eye className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-[11px] font-semibold text-foreground truncate">Incognito Feed</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="w-6 h-6 rounded-full hover:bg-background/60 flex items-center justify-center"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 rounded-full hover:bg-background/60 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
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
            feedPosts.map((item: any, index: number) => (
              <div
                key={item.id}
                data-index={index}
                className="h-full w-full snap-start snap-always relative"
                style={{ scrollSnapAlign: "start", height: height - 44 }}
              >
                <FeedPostCard post={item} currentUserId={user?.id} isActive={index === currentIndex} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default IncognitoFeedWindow;
