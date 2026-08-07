import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";

import localHelpBanner from "@/assets/explore-v2/local-help.png";
import postGigAsset from "@/assets/explore-v3/post-gig.png.asset.json";
import battlesAsset from "@/assets/explore-v3/battles.png.asset.json";
import dealsAsset from "@/assets/explore-v3/deals.png.asset.json";
import marketplaceAsset from "@/assets/explore-v3/marketplace.png.asset.json";
import yajTvAsset from "@/assets/explore-v3/yaj-tv.png.asset.json";
import radioAsset from "@/assets/explore-v3/radio.png.asset.json";
import wellnessAsset from "@/assets/explore-v3/wellness.png.asset.json";
import careersAsset from "@/assets/explore-v3/careers.png.asset.json";
import gamesAsset from "@/assets/explore-v3/games.png.asset.json";
import eventsAsset from "@/assets/explore-v3/events.png.asset.json";
import servicesAsset from "@/assets/explore-v3/services.png.asset.json";


type ExploreItem = {
  label: string;
  subtitle: string;
  route?: string;
  image: string;
  keywords?: string[];
};

const EXPLORE_ITEMS: ExploreItem[] = [
  {
    label: "Post a Gig",
    subtitle: "Let local helpers come to you.",
    route: "/gigs",
    image: postGigAsset.url,
    keywords: ["gig", "post", "hire", "request", "helper"],
  },
  {
    label: "Careers",
    subtitle: "Jobs, internships & opportunities.",
    route: "/jobs",
    image: careersAsset.url,
    keywords: ["career", "jobs", "internship", "work", "opportunity"],
  },
  {
    label: "Services",
    subtitle: "Advertise your craft.",
    route: "/services",
    image: servicesAsset.url,
    keywords: ["service", "business", "flyer", "advertise"],
  },
  {
    label: "Deals",
    subtitle: "Local savings & limited offers.",
    route: "/deals",
    image: dealsAsset.url,
    keywords: ["deal", "coupon", "discount", "offer", "local"],
  },
  {
    label: "Marketplace",
    subtitle: "Buy. Sell. Discover.",
    route: "/marketplace",
    image: marketplaceAsset.url,
    keywords: ["market", "marketplace", "buy", "sell", "items", "shopping"],
  },
  {
    label: "Battles",
    subtitle: "Compete. Rank. Win.",
    route: "/battles",
    image: battlesAsset.url,
    keywords: ["battle", "creator", "music", "competition", "vote"],
  },
  {
    label: "YAJ TV",
    subtitle: "Watch. Enjoy. Share.",
    route: "/tv/watch",
    image: yajTvAsset.url,
    keywords: ["tv", "video", "live", "watch", "stream"],
  },
  {
    label: "Radio",
    subtitle: "Listen. Vibe. Connect.",
    route: "/radio",
    image: radioAsset.url,
    keywords: ["radio", "music", "listen", "audio"],
  },
  {
    label: "Wellness",
    subtitle: "Move. Breathe. Live better.",
    route: "/wellness",
    image: wellnessAsset.url,
    keywords: ["wellness", "sleep", "move", "relax", "health"],
  },
  {
    label: "Games",
    subtitle: "Play, compete and discover.",
    image: gamesAsset.url,
    keywords: ["game", "games", "play", "gaming"],
  },
  {
    label: "Events",
    subtitle: "What's happening near you.",
    image: eventsAsset.url,
    keywords: ["event", "events", "happening", "party"],
  },
];

export default function ExplorePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return EXPLORE_ITEMS;

    return EXPLORE_ITEMS.filter((item) => {
      const text = [item.label, item.subtitle, ...(item.keywords ?? [])].join(" ").toLowerCase();
      return text.includes(needle);
    });
  }, [query]);

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 pb-2.5 pt-2 backdrop-blur-xl">
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
            className="h-9 w-full rounded-full border border-border bg-muted/70 pl-9 pr-9 text-[13px] outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
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

      <main className="px-3 pt-3">
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

        <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">🔥 Top picks</h2>

        {filteredItems.length ? (
          <div className="grid grid-cols-3 gap-2">
            {filteredItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.route) navigate(item.route);
                }}
                className="group relative aspect-square overflow-hidden rounded-[18px] border border-border/60 bg-card shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition active:scale-[0.97]"
                aria-label={`Open ${item.label}`}
              >
                <img
                  src={item.image}
                  alt={`${item.label} — ${item.subtitle}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
            <p className="font-bold">Nothing matched that search.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try jobs, deals, marketplace, gigs, battles, wellness, or local help.</p>
          </div>
        )}
      </main>
    </div>
  );
}
