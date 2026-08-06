import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search, Tag, X } from "lucide-react";
import yajLogo from "@/assets/yaj-logo.png";

type ExploreItem = {
  label: string;
  subtitle?: string;
  emoji?: string;
  icon?: ReactNode;
  background: string;
  border: string;
  route?: string;
};

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
    subtitle: "Sleep · Move · Relax",
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
    emoji: "🛍",
    background: "from-pink-100 via-rose-100 to-pink-200",
    border: "border-pink-300/70",
    route: "/marketplace",
  },
  {
    label: "Deals",
    subtitle: "Local savings & limited offers.",
    icon: <Tag className="h-9 w-9 text-orange-500 drop-shadow-[0_3px_6px_rgba(0,0,0,0.18)]" strokeWidth={1.8} />,
    background: "from-orange-200 via-orange-100 to-amber-200",
    border: "border-orange-300/70",
    route: "/deals",
  },
  {
    label: "Find Local Help",
    subtitle: "Help nearby. Fast.",
    emoji: "📍",
    background: "from-teal-100 via-cyan-100 to-emerald-100",
    border: "border-teal-300/70",
    route: "/local-help",
  },
  {
    label: "Post a Gig",
    subtitle: "Offer your skills.",
    emoji: "➕",
    background: "from-amber-100 via-orange-100 to-yellow-200",
    border: "border-amber-300/70",
    route: "/gigs",
  },
  {
    label: "Services",
    subtitle: "Book trusted professionals.",
    emoji: "📋",
    background: "from-sky-100 via-blue-100 to-indigo-100",
    border: "border-sky-300/70",
    route: "/services",
  },
  {
    label: "YAJ TV",
    subtitle: "Watch. Enjoy. Share.",
    emoji: "📺",
    background: "from-rose-100 via-red-100 to-pink-200",
    border: "border-rose-300/70",
    route: "/tv/watch",
  },
  {
    label: "Games",
    subtitle: "Play. Earn. Level up.",
    emoji: "🎮",
    background: "from-violet-100 via-purple-100 to-indigo-200",
    border: "border-violet-300/70",
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
      onClick={item.route ? () => navigate(item.route!) : undefined}
      className={`relative flex flex-col justify-between text-left h-[150px] rounded-2xl overflow-hidden p-3 bg-gradient-to-br ${item.background} border ${item.border} shadow-sm active:scale-[0.98] transition-transform`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.7),transparent_45%)]" />
      <div className="relative flex-1 flex items-center justify-center">
        {item.icon ? (
          <span aria-hidden>{item.icon}</span>
        ) : (
          <span className="text-4xl drop-shadow-[0_5px_7px_rgba(0,0,0,0.2)]" aria-hidden>
            {item.emoji}
          </span>
        )}
      </div>
      <div className="relative flex items-end gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-neutral-900 leading-tight truncate">{item.label}</p>
          {item.subtitle ? (
            <p className="text-[10px] leading-tight text-neutral-600 line-clamp-2">{item.subtitle}</p>
          ) : null}
        </div>
        <span className="shrink-0 grid place-items-center h-5 w-5 rounded-full bg-white/70 border border-black/10">
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
      if (i.subtitle?.toLowerCase().includes(n)) return true;
      if (i.label === "Wellness" && (n.includes("sleep") || n.includes("move") || n.includes("relax"))) {
        return true;
      }
      if (i.label === "Deals" && (n.includes("coupon") || n.includes("discount") || n.includes("offer") || n.includes("promo"))) {
        return true;
      }
      return false;
    });
  }, [query]);

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
        <div className="mb-2">
          <h2 className="text-base font-bold text-foreground">🔥 Top picks</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">This section helps people improve</p>
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
