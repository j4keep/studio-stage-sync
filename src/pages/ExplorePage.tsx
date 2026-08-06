import { useMemo, useState } from "react";
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

type ExploreItem = {
  label: string;
  subtitle?: string;
  emoji?: string;
  image?: string;
  background?: string;
  route?: string;
};

const bg = {
  indigo: "from-indigo-300 to-violet-500",
  orange: "from-orange-300 to-amber-400",
} as const;

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
  { label: "Games", emoji: "🎮", background: bg.indigo },
  { label: "Events", emoji: "🎪", background: bg.orange, route: "/events" },
];

function ExploreCard({ item }: { item: ExploreItem }) {
  const navigate = useNavigate();

  if (item.image) {
    return (
      <button
        type="button"
        onClick={item.route ? () => navigate(item.route!) : undefined}
        className="text-left active:scale-[0.98] transition-transform"
        aria-label={item.label}
      >
        <img
          src={item.image}
          alt={`${item.label}${item.subtitle ? ` — ${item.subtitle}` : ""}`}
          className="w-full rounded-2xl shadow-sm"
          loading="lazy"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={item.route ? () => navigate(item.route!) : undefined}
      className="text-left active:scale-[0.98] transition-transform"
    >
      <div
        className={`relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${item.background} border border-black/5 shadow-sm flex items-center justify-center`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.6),transparent_38%)]" />
        <span className="relative text-5xl drop-shadow-[0_6px_8px_rgba(0,0,0,0.25)]" aria-hidden>
          {item.emoji}
        </span>
      </div>
      <p className="mt-1.5 px-0.5 text-xs font-semibold text-foreground truncate">{item.label}</p>
      {item.subtitle ? (
        <p className="px-0.5 text-[10px] leading-tight text-muted-foreground line-clamp-2">{item.subtitle}</p>
      ) : null}
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
          <div className="grid grid-cols-2 gap-3">
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
