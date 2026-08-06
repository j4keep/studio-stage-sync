import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import yajLogo from "@/assets/yaj-logo.png";
import battlesCard from "@/assets/explore/battles.jpeg.asset.json";
import wellnessCard from "@/assets/explore/wellness.jpeg.asset.json";
import radioCard from "@/assets/explore/radio.jpeg.asset.json";
import careersCard from "@/assets/explore/careers.jpeg.asset.json";
import marketplaceCard from "@/assets/explore/marketplace.jpeg.asset.json";
import dealsCard from "@/assets/explore/deals.jpeg.asset.json";
import localHelpCard from "@/assets/explore/local-help.jpeg.asset.json";
import postGigCard from "@/assets/explore/post-a-gig.jpeg.asset.json";
import servicesCard from "@/assets/explore/services.jpeg.asset.json";
import yajTvCard from "@/assets/explore/yaj-tv.jpeg.asset.json";
import gamesCard from "@/assets/explore/games.jpeg.asset.json";
import eventsCard from "@/assets/explore/events.jpeg.asset.json";

type ExploreItem = {
  label: string;
  subtitle?: string;
  image: string;
  route?: string;
};

const TOP_PICKS: ExploreItem[] = [
  { label: "Battles", subtitle: "Compete. Rank. Win.", image: battlesCard.url, route: "/battles" },
  { label: "Wellness", subtitle: "Sleep · Move · Relax", image: wellnessCard.url, route: "/wellness" },
  { label: "Radio", subtitle: "Listen. Vibe. Connect.", image: radioCard.url, route: "/radio" },
  { label: "Careers", subtitle: "Find your path.", image: careersCard.url, route: "/jobs" },
  { label: "Marketplace", subtitle: "Buy. Sell. Discover.", image: marketplaceCard.url, route: "/marketplace" },
  { label: "Deals", subtitle: "Local savings & limited offers.", image: dealsCard.url, route: "/deals" },
  { label: "Find Local Help", subtitle: "Help nearby. Fast.", image: localHelpCard.url, route: "/local-help" },
  { label: "Post a Gig", subtitle: "Offer your skills.", image: postGigCard.url, route: "/gigs" },
  { label: "Services", subtitle: "Book trusted professionals.", image: servicesCard.url, route: "/services" },
  { label: "YAJ TV", subtitle: "Watch. Enjoy. Share.", image: yajTvCard.url, route: "/tv/watch" },
  { label: "Games", subtitle: "Play. Earn. Level up.", image: gamesCard.url },
  { label: "Events", subtitle: "Local events you'll love.", image: eventsCard.url, route: "/events" },
];

const ORDER_KEY = "yaj.explore.card-order.v1";

function loadOrder(): ExploreItem[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return TOP_PICKS;
    const labels: string[] = JSON.parse(raw);
    const byLabel = new Map(TOP_PICKS.map((i) => [i.label, i]));
    const ordered = labels.map((l) => byLabel.get(l)).filter(Boolean) as ExploreItem[];
    const missing = TOP_PICKS.filter((i) => !labels.includes(i.label));
    return [...ordered, ...missing];
  } catch {
    return TOP_PICKS;
  }
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<ExploreItem[]>(loadOrder);
  const [editing, setEditing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const longPress = useRef<number | null>(null);
  const movedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);


  useEffect(() => {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order.map((i) => i.label)));
    } catch {
      /* ignore */
    }
  }, [order]);

  const items = useMemo(() => {
    const n = query.trim().toLowerCase();
    if (!n) return order;
    return order.filter((i) => {
      if (i.label.toLowerCase().includes(n)) return true;
      if (i.subtitle?.toLowerCase().includes(n)) return true;
      if (i.label === "Wellness" && (n.includes("sleep") || n.includes("move") || n.includes("relax"))) return true;
      if (
        i.label === "Deals" &&
        (n.includes("coupon") || n.includes("discount") || n.includes("offer") || n.includes("promo"))
      ) {
        return true;
      }
      return false;
    });
  }, [query, order]);

  const isSearching = query.trim().length > 0;

  const cardIndexAtPoint = useCallback((x: number, y: number) => {
    const grid = gridRef.current;
    if (!grid) return null;
    const tiles = Array.from(grid.querySelectorAll<HTMLElement>("[data-tile-index]"));
    for (const tile of tiles) {
      const r = tile.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return Number(tile.dataset.tileIndex);
      }
    }
    return null;
  }, []);

  const clearLongPress = () => {
    if (longPress.current) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    if (isSearching) return;
    movedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (editing) {
      setDragIndex(index);
      return;
    }
    longPress.current = window.setTimeout(() => {
      longPress.current = null;
      setEditing(true);
      setDragIndex(index);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 550);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (start) {
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (dist < 12) return;
      movedRef.current = true;
    }
    if (dragIndex === null) {
      clearLongPress();
      return;
    }
    const over = cardIndexAtPoint(e.clientX, e.clientY);
    if (over === null || over === dragIndex) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(over, 0, moved);
      return next;
    });
    setDragIndex(over);
  };

  const onPointerUp = (item: ExploreItem) => () => {
    const wasLongPress = longPress.current === null && dragIndex !== null;
    const moved = movedRef.current;
    clearLongPress();
    setDragIndex(null);
    startRef.current = null;
    if (!editing && !moved && !wasLongPress && item.route) navigate(item.route);
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">Discover people, opportunities & circles</p>
            <h1 className="text-2xl font-black tracking-tight">Explore</h1>
          </div>
          <img src={yajLogo} alt="YAJ" className="h-14 w-auto -my-3" />
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search interests, people, jobs, deals"
            className="w-full h-11 rounded-xl bg-muted border border-border pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <section className="px-4 pb-24">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">🔥 Top picks</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {editing ? "Drag cards to reorder" : "Hold a card to rearrange"}
            </p>
          </div>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDragIndex(null);
              }}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
            >
              Done
            </button>
          )}
        </div>

        {items.length ? (
          <div ref={gridRef} className="grid grid-cols-3 gap-2">
            {items.map((item, index) => (
              <button
                key={item.label}
                type="button"
                data-tile-index={index}
                aria-label={item.label}
                onPointerDown={onPointerDown(index)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp(item)}
                onPointerCancel={() => {
                  clearLongPress();
                  setDragIndex(null);
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`text-left touch-none select-none transition-transform ${
                  dragIndex === index
                    ? "scale-105 opacity-80 z-10"
                    : editing
                      ? ""
                      : "active:scale-[0.97]"
                }`}
                style={editing && dragIndex !== index ? { animation: "yaj-wiggle 0.5s ease-in-out infinite" } : undefined}
              >
                <img
                  src={item.image}
                  alt={`${item.label}${item.subtitle ? ` — ${item.subtitle}` : ""}`}
                  className="w-full rounded-2xl shadow-sm pointer-events-none"
                  draggable={false}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">No results</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search.</p>
          </div>
        )}
      </section>
    </div>
  );
}
