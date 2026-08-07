import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";

import postGigImage from "@/assets/explore-v2/post-gig.png";
import localHelpImage from "@/assets/explore-v2/local-help.png";
import battlesImage from "@/assets/explore-v2/battles.png";
import dealsImage from "@/assets/explore-v2/deals.png";
import marketplaceImage from "@/assets/explore-v2/marketplace.png";
import yajTvImage from "@/assets/explore-v2/yaj-tv.png";
import radioImage from "@/assets/explore-v2/radio.png";
import wellnessImage from "@/assets/explore-v2/wellness.png";
import careersImage from "@/assets/explore-v2/careers.png";
import gamesImage from "@/assets/explore-v2/games.png";

type CardSize = "square" | "wide";

type ExploreItem = {
  label: string;
  subtitle: string;
  route?: string;
  image: string;
  size: CardSize;
  keywords?: string[];
};

const EXPLORE_ITEMS: ExploreItem[] = [
  {
    label: "Post a Gig",
    subtitle: "Let local helpers come to you.",
    route: "/gigs",
    image: postGigImage,
    size: "square",
    keywords: ["gig", "post", "hire", "request", "helper"],
  },
  {
    label: "Find Local Help",
    subtitle: "Trusted pros near you.",
    route: "/local-help",
    image: localHelpImage,
    size: "square",
    keywords: ["local", "help", "services", "handyman", "mover", "cleaner", "electrician"],
  },
  {
    label: "Battles",
    subtitle: "Compete. Rank. Win.",
    route: "/battles",
    image: battlesImage,
    size: "square",
    keywords: ["battle", "creator", "music", "podcast", "competition", "vote"],
  },
  {
    label: "Deals",
    subtitle: "Local savings & limited offers.",
    route: "/deals",
    image: dealsImage,
    size: "square",
    keywords: ["deal", "coupon", "discount", "offer", "local"],
  },
  {
    label: "Marketplace",
    subtitle: "Buy. Sell. Discover.",
    route: "/marketplace",
    image: marketplaceImage,
    size: "square",
    keywords: ["market", "marketplace", "buy", "sell", "items", "shopping"],
  },
  {
    label: "YAJ TV",
    subtitle: "Watch. Enjoy. Share.",
    route: "/tv/watch",
    image: yajTvImage,
    size: "square",
    keywords: ["tv", "video", "live", "watch", "stream"],
  },
  {
    label: "Radio",
    subtitle: "Listen. Vibe. Connect.",
    route: "/radio",
    image: radioImage,
    size: "square",
    keywords: ["radio", "music", "listen", "audio"],
  },
  {
    label: "Wellness",
    subtitle: "Move. Breathe. Live better.",
    route: "/wellness",
    image: wellnessImage,
    size: "square",
    keywords: ["wellness", "sleep", "move", "relax", "health", "exercise"],
  },
  {
    label: "Careers",
    subtitle: "Jobs, internships & opportunities.",
    route: "/jobs",
    image: careersImage,
    size: "square",
    keywords: ["career", "jobs", "internship", "work", "opportunity"],
  },
  {
    label: "Games",
    subtitle: "Play, compete and discover what's next.",
    image: gamesImage,
    size: "wide",
    keywords: ["game", "games", "play", "gaming"],
  },
];

function Card({ item, onOpen }: { item: ExploreItem; onOpen: () => void }) {
  const isWide = item.size === "wide";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${isWide ? "col-span-2 aspect-[2.9/1]" : "aspect-square"} group relative overflow-hidden rounded-[20px] border border-border/60 bg-card shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition duration-200 active:scale-[0.98]`}
      aria-label={`Open ${item.label}`}
    >
      {/* Blurred fill so the artwork is never cropped or cut off */}
      <img
        src={item.image}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl saturate-150"
        draggable={false}
      />
      <img
        src={item.image}
        alt={`${item.label} preview`}
        className="relative z-10 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
        draggable={false}
      />
    </button>
  );
}

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
    <div className="flex h-[calc(100dvh-133px)] flex-col overflow-hidden bg-background text-foreground lg:h-auto">
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

      <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2.5">
        <h2 className="mb-2 text-[13px] font-black uppercase tracking-[0.12em] text-muted-foreground">🔥 Top picks</h2>

        {filteredItems.length ? (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredItems.map((item) => (
              <Card
                key={item.label}
                item={item}
                onOpen={() => {
                  if (item.route) navigate(item.route);
                }}
              />
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

