import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";

import localHelpBanner from "@/assets/explore-v2/local-help.png";
import connectionsImage from "@/assets/explore-v4/connections.png";
import battlesImage from "@/assets/explore-v4/battles.png";
import careersImage from "@/assets/explore-v6/opportunities.png";
import gamesImage from "@/assets/explore-v4/games.png";
import dealsAsset from "@/assets/explore-v3/deals.png.asset.json";
import marketplaceImage from "@/assets/explore-v5/marketplace.png";
import yajTvAsset from "@/assets/explore-v3/yaj-tv.png.asset.json";
import radioAsset from "@/assets/explore-v3/radio.png.asset.json";
import wellnessAsset from "@/assets/explore-v3/wellness.png.asset.json";

type ExploreItem = {
  id: string;
  label: string;
  subtitle: string;
  route?: string;
  image: string;
  keywords?: string[];
};

const EXPLORE_ITEMS: ExploreItem[] = [
  {
    id: "connections",
    label: "Connections",
    subtitle: "Find people nearby with similar interests.",
    route: "/connections",
    image: connectionsImage,
    keywords: ["connect", "connections", "people", "dating", "friends", "meet", "networking", "nearby"],
  },
  {
    id: "careers",
    label: "Opportunities",
    subtitle: "Jobs, internships & opportunities.",
    route: "/jobs",
    image: careersImage,
    keywords: ["career", "careers", "opportunity", "opportunities", "jobs", "internship", "work"],
  },
  {
    id: "deals",
    label: "Deals",
    subtitle: "Local savings & limited offers.",
    route: "/deals",
    image: dealsAsset.url,
    keywords: ["deal", "coupon", "discount", "offer", "local"],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    subtitle: "Buy. Sell. Discover.",
    route: "/marketplace",
    image: marketplaceImage,
    keywords: ["market", "marketplace", "buy", "sell", "items", "shopping"],
  },
  {
    id: "battles",
    label: "Battles",
    subtitle: "Compete. Rank. Win.",
    route: "/battles",
    image: battlesImage,
    keywords: ["battle", "creator", "music", "competition", "vote"],
  },
  {
    id: "tv",
    label: "YAJ TV",
    subtitle: "Watch. Enjoy. Share.",
    route: "/tv/watch",
    image: yajTvAsset.url,
    keywords: ["tv", "video", "live", "watch", "stream"],
  },
  {
    id: "radio",
    label: "Radio",
    subtitle: "Listen. Vibe. Connect.",
    route: "/radio",
    image: radioAsset.url,
    keywords: ["radio", "music", "listen", "audio"],
  },
  {
    id: "wellness",
    label: "Wellness",
    subtitle: "Move. Breathe. Live better.",
    route: "/wellness",
    image: wellnessAsset.url,
    keywords: ["wellness", "sleep", "move", "relax", "health"],
  },
  {
    id: "games",
    label: "Games",
    subtitle: "Play together.",
    image: gamesImage,
    keywords: ["game", "games", "play", "domino", "pool"],
  },
];

const ORDER_KEY = "yaj.explore.card-order.v5";

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return EXPLORE_ITEMS.map((i) => i.id);
    const known = parsed.filter((id): id is string => EXPLORE_ITEMS.some((i) => i.id === id));
    const missing = EXPLORE_ITEMS.map((i) => i.id).filter((id) => !known.includes(id));
    return [...known, ...missing];
  } catch {
    return EXPLORE_ITEMS.map((i) => i.id);
  }
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [dragId, setDragId] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const holdTimer = useRef<number | null>(null);
  const movedRef = useRef(false);

  // App-like behaviour: no page scroll on this screen only. Always fully reset on leave.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = "";
      html.style.overscrollBehavior = "";
      body.style.overflow = "";
      body.style.position = "";
      body.style.width = "";
    };
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }, [order]);

  const orderedItems = useMemo(
    () =>
      order
        .map((id) => EXPLORE_ITEMS.find((i) => i.id === id))
        .filter((i): i is ExploreItem => Boolean(i)),
    [order],
  );

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orderedItems;
    return orderedItems.filter((item) => {
      const text = [item.label, item.subtitle, ...(item.keywords ?? [])].join(" ").toLowerCase();
      return text.includes(needle);
    });
  }, [orderedItems, query]);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const endDrag = useCallback(() => {
    clearHold();
    setDragId(null);
  }, [clearHold]);

  const handlePointerDown = (id: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (query) return;
    movedRef.current = false;
    const target = event.currentTarget;
    clearHold();
    holdTimer.current = window.setTimeout(() => {
      setDragId(id);
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      if ("vibrate" in navigator) navigator.vibrate?.(12);
    }, 380);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragId) {
      clearHold();
      return;
    }
    movedRef.current = true;
    event.preventDefault();
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const tile = el?.closest?.("[data-tile-id]") as HTMLElement | null;
    const overId = tile?.dataset.tileId;
    if (!overId || overId === dragId) return;
    setOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(overId);
      if (from < 0 || to < 0) return prev;
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };

  const handleClick = (item: ExploreItem) => () => {
    if (dragId || movedRef.current) return;
    if (item.route) navigate(item.route);
  };

  return (
    <div className="flex h-[100dvh] touch-none flex-col overflow-hidden overscroll-none bg-background pb-20 text-foreground">
      <header className="shrink-0 border-b border-border/60 bg-background/95 px-4 pb-2.5 pt-2 backdrop-blur-xl">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[22px] font-black tracking-tight">Explore</h1>
          <p className="truncate text-[11px] text-muted-foreground">Local finds & live activity</p>
        </div>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs, deals, marketplace…"
            className="h-9 w-full touch-auto rounded-full border border-border bg-muted/70 pl-9 pr-9 text-[13px] outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden px-3 pt-3">
        {!query && (
          <button
            type="button"
            onClick={() => navigate("/local-help")}
            className="mb-3 block w-full overflow-hidden rounded-[20px] border border-border/60 bg-card shadow-[0_6px_18px_rgba(15,23,42,0.08)] active:scale-[0.99]"
            aria-label="Open Find Local Help"
          >
            <img
              src={localHelpBanner}
              alt="Find local help — trusted pros near you"
              className="block h-auto w-full"
              draggable={false}
            />
          </button>
        )}

        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            ⭐ Pick your fav
          </h2>
          <p className="shrink-0 text-[10px] font-medium text-muted-foreground/80">
            Press &amp; hold to move
          </p>
        </div>

        {filteredItems.length ? (
          <div ref={gridRef} className="grid grid-cols-3 gap-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                data-tile-id={item.id}
                onPointerDown={handlePointerDown(item.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onContextMenu={(e) => e.preventDefault()}
                onClick={handleClick(item)}
                className={`group relative aspect-[4/3] select-none overflow-hidden rounded-[16px] border border-border/60 bg-card shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition ${
                  dragId === item.id
                    ? "z-10 scale-[1.06] opacity-90 shadow-[0_10px_26px_rgba(15,23,42,0.22)]"
                    : "active:scale-[0.97]"
                }`}
                aria-label={`Open ${item.label}`}
              >
                <img
                  src={item.image}
                  alt={`${item.label} — ${item.subtitle}`}
                  className="pointer-events-none h-full w-full object-cover"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
            <p className="font-bold">Nothing matched that search.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try jobs, deals, marketplace, gigs, battles, wellness, or local help.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
