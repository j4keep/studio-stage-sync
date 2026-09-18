import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgePercent,
  BookOpen,
  BriefcaseBusiness,
  Gamepad2,
  HeartPulse,
  Radio,
  Search,
  ShoppingBag,
  Swords,
  Tv,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";

type ExploreItem = {
  id: string;
  label: string;
  subtitle: string;
  route?: string;
  icon: LucideIcon;
  surface: string;
  iconSurface: string;
  iconColor: string;
  keywords?: string[];
  adultsOnly?: boolean;
};

const EXPLORE_ITEMS: ExploreItem[] = [
  {
    id: "books",
    label: "Books",
    subtitle: "Read, discover & share stories",
    route: "/books",
    icon: BookOpen,
    surface: "bg-sky-50 dark:bg-sky-950/30",
    iconSurface: "bg-sky-100 dark:bg-sky-900/60",
    iconColor: "text-sky-700 dark:text-sky-300",
    keywords: ["book", "books", "read", "reading", "library", "kids", "ebook", "story"],
  },
  {
    id: "careers",
    label: "Opportunities",
    subtitle: "Jobs, internships & new paths",
    route: "/jobs",
    icon: BriefcaseBusiness,
    surface: "bg-violet-50 dark:bg-violet-950/30",
    iconSurface: "bg-violet-100 dark:bg-violet-900/60",
    iconColor: "text-violet-700 dark:text-violet-300",
    keywords: ["career", "careers", "opportunity", "opportunities", "jobs", "internship", "work"],
  },
  {
    id: "deals",
    label: "Deals",
    subtitle: "Local savings & limited offers",
    route: "/deals",
    icon: BadgePercent,
    surface: "bg-amber-50 dark:bg-amber-950/30",
    iconSurface: "bg-amber-100 dark:bg-amber-900/60",
    iconColor: "text-amber-700 dark:text-amber-300",
    keywords: ["deal", "coupon", "discount", "offer", "local"],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    subtitle: "Buy, sell & discover nearby",
    route: "/marketplace",
    icon: ShoppingBag,
    surface: "bg-emerald-50 dark:bg-emerald-950/30",
    iconSurface: "bg-emerald-100 dark:bg-emerald-900/60",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    keywords: ["market", "marketplace", "buy", "sell", "items", "shopping"],
  },
  {
    id: "battles",
    label: "Battles",
    subtitle: "Compete, rank & win",
    route: "/battles",
    icon: Swords,
    surface: "bg-rose-50 dark:bg-rose-950/30",
    iconSurface: "bg-rose-100 dark:bg-rose-900/60",
    iconColor: "text-rose-700 dark:text-rose-300",
    keywords: ["battle", "creator", "music", "competition", "vote"],
  },
  {
    id: "tv",
    label: "YAJ TV",
    subtitle: "Watch creators & original content",
    route: "/tv/watch",
    icon: Tv,
    surface: "bg-indigo-50 dark:bg-indigo-950/30",
    iconSurface: "bg-indigo-100 dark:bg-indigo-900/60",
    iconColor: "text-indigo-700 dark:text-indigo-300",
    keywords: ["tv", "video", "live", "watch", "stream"],
  },
  {
    id: "radio",
    label: "Radio",
    subtitle: "Listen, vibe & discover music",
    route: "/radio",
    icon: Radio,
    surface: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    iconSurface: "bg-fuchsia-100 dark:bg-fuchsia-900/60",
    iconColor: "text-fuchsia-700 dark:text-fuchsia-300",
    keywords: ["radio", "music", "listen", "audio"],
  },
  {
    id: "wellness",
    label: "Wellness",
    subtitle: "Move, breathe & feel better",
    route: "/wellness",
    icon: HeartPulse,
    surface: "bg-teal-50 dark:bg-teal-950/30",
    iconSurface: "bg-teal-100 dark:bg-teal-900/60",
    iconColor: "text-teal-700 dark:text-teal-300",
    keywords: ["wellness", "sleep", "move", "relax", "health"],
  },
  {
    id: "games",
    label: "Games",
    subtitle: "Play solo or together",
    route: "/games",
    icon: Gamepad2,
    surface: "bg-orange-50 dark:bg-orange-950/30",
    iconSurface: "bg-orange-100 dark:bg-orange-900/60",
    iconColor: "text-orange-700 dark:text-orange-300",
    keywords: ["game", "games", "play", "domino", "pool", "trivia", "tic tac toe", "boxing", "battleship"],
  },
  {
    id: "circle",
    label: "My Circle",
    subtitle: "Your people, groups & community",
    route: "/circle",
    icon: UsersRound,
    surface: "bg-blue-50 dark:bg-blue-950/30",
    iconSurface: "bg-blue-100 dark:bg-blue-900/60",
    iconColor: "text-blue-700 dark:text-blue-300",
    keywords: ["circle", "community", "friends", "groups", "people", "network"],
  },
];

const ORDER_KEY = "yaj.explore.card-order.v9";

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
    <div className="flex min-h-[100dvh] flex-col bg-background pb-20 text-foreground lg:min-h-0 lg:pb-8">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-background/95 px-4 pb-3 pt-3 backdrop-blur-xl lg:rounded-t-3xl lg:px-6 lg:pt-5">
        <h1 className="text-[26px] font-bold tracking-[-0.025em] text-foreground">Explore</h1>
        <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">
          Discover everything YAJ brings together.
        </p>

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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-4 lg:max-w-none lg:px-6 lg:pb-14 lg:pt-6">
        {!query && (
          <section className="mb-5">
            <button
              type="button"
              onClick={() => navigate("/local-help")}
              className="flex w-full items-center gap-4 rounded-[22px] border border-border/70 bg-card px-4 py-4 text-left shadow-sm transition hover:shadow-md active:scale-[0.99]"
              aria-label="Open Local Help"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 shadow-inner dark:bg-cyan-900/60 dark:text-cyan-300">
                <Wrench className="h-7 w-7" strokeWidth={2.15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold tracking-tight text-foreground">Local Help</p>
                <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-muted-foreground">
                  Find trusted people and services near you.
                </p>
              </div>
              <span className="text-lg font-semibold text-muted-foreground">›</span>
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
                {query
                  ? `${filteredItems.length} ${filteredItems.length === 1 ? "result" : "results"}`
                  : "Quick access to the main areas of YAJ."}
              </p>
            </div>
            {!query && <p className="shrink-0 text-[11px] font-medium text-muted-foreground">Hold to reorder</p>}
          </div>

          {filteredItems.length ? (
            <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                return (
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
                    className={`group min-h-[154px] select-none rounded-[20px] border border-border/70 ${item.surface} p-3.5 text-left shadow-sm transition lg:min-h-[170px] lg:p-4 ${
                      dragId === item.id
                        ? "z-10 scale-[1.035] opacity-95 shadow-lg"
                        : "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.985]"
                    }`}
                    aria-label={`Open ${item.label}`}
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconSurface} ${item.iconColor} shadow-sm ring-1 ring-black/5 dark:ring-white/5`}>
                      <Icon className="h-6 w-6" strokeWidth={2.2} />
                    </div>
                    <div className="mt-4">
                      <p className="text-[15px] font-bold leading-tight tracking-[-0.015em] text-foreground">{item.label}</p>
                      <p className="mt-1.5 line-clamp-2 text-[11.5px] font-medium leading-[1.4] text-muted-foreground">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
              <p className="text-[15px] font-bold text-foreground">Nothing matched that search.</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                Try books, jobs, deals, marketplace, battles, wellness, games, or My Circle.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
