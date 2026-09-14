import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";

import localHelpBanner from "@/assets/explore-v2/local-help.png";
import booksImage from "@/assets/explore-v6/books.svg";
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
  /** Hide from Youth / when dating_allowed is false */
  adultsOnly?: boolean;
};

const EXPLORE_ITEMS: ExploreItem[] = [
  {
    id: "books",
    label: "Books",
    subtitle: "Read, discover & share stories",
    route: "/books",
    image: booksImage,
    keywords: ["book", "books", "read", "reading", "library", "kids", "ebook", "story"],
  },
  {
    id: "careers",
    label: "Opportunities",
    subtitle: "Jobs, internships & new paths",
    route: "/jobs",
    image: careersImage,
    keywords: ["career", "careers", "opportunity", "opportunities", "jobs", "internship", "work"],
  },
  {
    id: "deals",
    label: "Deals",
    subtitle: "Local savings & limited offers",
    route: "/deals",
    image: dealsAsset.url,
    keywords: ["deal", "coupon", "discount", "offer", "local"],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    subtitle: "Buy, sell & discover nearby",
    route: "/marketplace",
    image: marketplaceImage,
    keywords: ["market", "marketplace", "buy", "sell", "items", "shopping"],
  },
  {
    id: "battles",
    label: "Battles",
    subtitle: "Compete, rank & win",
    route: "/battles",
    image: battlesImage,
    keywords: ["battle", "creator", "music", "competition", "vote"],
  },
  {
    id: "tv",
    label: "YAJ TV",
    subtitle: "Watch creators & original content",
    route: "/tv/watch",
    image: yajTvAsset.url,
    keywords: ["tv", "video", "live", "watch", "stream"],
  },
  {
    id: "radio",
    label: "Radio",
    subtitle: "Listen, vibe & discover music",
    route: "/radio",
    image: radioAsset.url,
    keywords: ["radio", "music", "listen", "audio"],
  },
  {
    id: "wellness",
    label: "Wellness",
    subtitle: "Move, breathe & feel better",
    route: "/wellness",
    image: wellnessAsset.url,
    keywords: ["wellness", "sleep", "move", "relax", "health"],
  },
  {
    id: "games",
    label: "Games",
    subtitle: "Play solo or together",
    route: "/games",
    image: gamesImage,
    keywords: ["game", "games", "play", "domino", "pool", "trivia", "tic tac toe", "boxing", "battleship"],
  },
];

const ORDER_KEY = "yaj.explore.card-order.v8";

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
  const { policy } = useSafetyBalance();
  const datingAllowed = policy?.dating_allowed !== false;
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [dragId, setDragId] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const holdTimer = useRef<number | null>(null);
  const movedRef = useRef(false);

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
        .filter((i): i is ExploreItem => Boolean(i))
        .filter((i) => (i.adultsOnly ? datingAllowed : true)),
    [order, datingAllowed],
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
    <div className="flex min-h-[100dvh] flex-col bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-background/95 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.025em] text-foreground">Explore</h1>
          <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">
            Discover more of what YAJ has to offer.
          </p>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Explore"
            className="h-11 w-full rounded-2xl border border-border/80 bg-muted/60 pl-10 pr-10 text-[14px] font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:ring-2 focus:ring-primary/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-6 pt-4">
        {!query && (
          <section className="mb-5">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold tracking-tight text-foreground">Local help</p>
                <p className="text-[12px] font-medium text-muted-foreground">Find trusted people and services near you.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/local-help")}
              className="block w-full overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm transition active:scale-[0.99]"
              aria-label="Open Find Local Help"
            >
              <img
                src={localHelpBanner}
                alt="Find local help — trusted pros near you"
                className="block h-auto w-full"
                draggable={false}
              />
            </button>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-bold tracking-tight text-foreground">
                {query ? "Search results" : "Discover"}
              </h2>
              <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">
                {query ? `${filteredItems.length} ${filteredItems.length === 1 ? "result" : "results"}` : "Your shortcuts to everything happening on YAJ."}
              </p>
            </div>
            {!query && (
              <p className="shrink-0 text-[11px] font-medium text-muted-foreground">
                Hold to reorder
              </p>
            )}
          </div>

          {filteredItems.length ? (
            <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  className={`group select-none overflow-hidden rounded-[20px] border border-border/70 bg-card text-left shadow-sm transition ${
                    dragId === item.id
                      ? "z-10 scale-[1.035] opacity-95 shadow-lg"
                      : "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.985]"
                  }`}
                  aria-label={`Open ${item.label}`}
                >
                  <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                    <img
                      src={item.image}
                      alt=""
                      className="pointer-events-none h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      draggable={false}
                    />
                  </div>
                  <div className="px-3 pb-3 pt-2.5">
                    <p className="text-[14px] font-bold leading-tight tracking-[-0.01em] text-foreground">{item.label}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-[1.35] text-muted-foreground">{item.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
              <p className="text-[15px] font-bold text-foreground">Nothing matched that search.</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                Try books, jobs, deals, marketplace, battles, wellness, games, or local help.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
