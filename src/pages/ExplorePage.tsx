import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search, X } from "lucide-react";
import yajLogo from "@/assets/yaj-logo.png";

type ExploreItem = {
  label: string;
  subtitle: string;
  emoji: string;
  background: string;
  border: string;
  route: string;
};

/** Exact Explore card set from the YAJ design (no YAJ AI card). */
const TOP_PICKS: ExploreItem[] = [
  {
    label: "Battles",
    subtitle: "Compete. Rank. Win.",
    emoji: "⚔️",
    background: "from-amber-100 via-yellow-100 to-amber-200",
    border: "border-amber-300/70",
    route: "/battles",
  },
  {
    label: "Wellness",
    subtitle: "Sleep • Move • Relax",
    emoji: "🌿",
    background: "from-emerald-100 via-green-100 to-teal-100",
    border: "border-emerald-300/70",
    route: "/wellness",
  },
  {
    label: "Radio",
    subtitle: "Listen. Vibe. Connect.",
    emoji: "🎵",
    background: "from-violet-100 via-fuchsia-100 to-purple-200",
    border: "border-violet-300/70",
    route: "/radio",
  },
  {
    label: "Careers",
    subtitle: "Find your path.",
    emoji: "💼",
    background: "from-indigo-100 via-violet-100 to-blue-100",
    border: "border-indigo-300/70",
    route: "/jobs",
  },
  {
    label: "Marketplace",
    subtitle: "Buy. Sell. Discover.",
    emoji: "🛍️",
    background: "from-pink-100 via-rose-100 to-pink-200",
    border: "border-pink-300/70",
    route: "/marketplace",
  },
  {
    label: "Deals",
    subtitle: "Local savings & limited offers.",
    emoji: "🏷️",
    background: "from-orange-100 via-amber-100 to-orange-200",
    border: "border-orange-300/70",
    route: "/deals",
  },
  {
    label: "Find Local Help",
    subtitle: "Help nearby. Fast.",
    emoji: "📍",
    background: "from-teal-100 via-cyan-100 to-sky-100",
    border: "border-teal-300/70",
    route: "/local-help",
  },
  {
    label: "Post a Gig",
    subtitle: "Offer your skills.",
    emoji: "➕",
    background: "from-yellow-50 via-amber-100 to-orange-100",
    border: "border-amber-300/70",
    route: "/gigs",
  },
  {
    label: "Services",
    subtitle: "Book trusted professionals.",
    emoji: "📋",
    background: "from-slate-100 via-sky-100 to-indigo-100",
    border: "border-slate-300/70",
    route: "/services",
  },
  {
    label: "YAJ TV",
    subtitle: "Watch. Enjoy. Share.",
    emoji: "📺",
    background: "from-rose-100 via-pink-100 to-orange-100",
    border: "border-rose-300/70",
    route: "/tv/watch",
  },
  {
    label: "Games",
    subtitle: "Play. Earn. Level up.",
    emoji: "🎮",
    background: "from-violet-100 via-purple-100 to-indigo-200",
    border: "border-violet-300/70",
    route: "/games",
  },
  {
    label: "Events",
    subtitle: "Local events you'll love.",
    emoji: "🎪",
    background: "from-yellow-100 via-amber-100 to-orange-200",
    border: "border-amber-300/70",
    route: "/events",
  },
];

function ExploreCard({ item }: { item: ExploreItem }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(item.route)}
      className={`relative flex h-[150px] flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-left shadow-sm transition-transform active:scale-[0.98] ${item.background} ${item.border}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.7),transparent_45%)]" />
      <div className="relative flex flex-1 items-center justify-center">
        <span className="text-4xl drop-shadow-[0_5px_7px_rgba(0,0,0,0.2)]" aria-hidden>
          {item.emoji}
        </span>
      </div>
      <div className="relative flex items-end gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-neutral-900">{item.label}</p>
          <p className="line-clamp-2 text-[10px] leading-tight text-neutral-600">{item.subtitle}</p>
        </div>
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-black/10 bg-white/70">
          <ChevronRight className="h-3 w-3 text-neutral-700" />
        </span>
      </div>
    </button>
  );
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const n = query.trim().toLowerCase();
    if (!n) return TOP_PICKS;
    return TOP_PICKS.filter((i) => {
      if (i.label.toLowerCase().includes(n)) return true;
      if (i.subtitle.toLowerCase().includes(n)) return true;
      if (i.label === "Wellness" && (n.includes("sleep") || n.includes("move") || n.includes("relax"))) {
        return true;
      }
      if (
        i.label === "Deals" &&
        (n.includes("coupon") || n.includes("discount") || n.includes("offer") || n.includes("promo"))
      ) {
        return true;
      }
      return false;
    });
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">Discover people, opportunities & circles</p>
            <h1 className="text-2xl font-black tracking-tight">Explore</h1>
          </div>
          <img src={yajLogo} alt="YAJ" className="my-[-0.75rem] h-14 w-auto" />
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search interests, people, jobs, deals"
            className="h-11 w-full rounded-xl border border-border bg-muted pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      <section className="px-4 pb-24">
        <div className="mb-2">
          <h2 className="text-base font-bold text-foreground">🔥 Top picks</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">This section helps people improve</p>
        </div>
        {items.length ? (
          <div className="grid grid-cols-3 gap-3">
            {items.map((item) => (
              <ExploreCard key={item.label} item={item} />
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
