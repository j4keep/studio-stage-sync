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

type CardSize = "gig" | "wide" | "feature" | "tile";

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
    size: "gig",
    keywords: ["gig", "post", "hire", "request", "helper"],
  },
  {
    label: "Find Local Help",
    subtitle: "Trusted pros near you.",
    route: "/local-help",
    image: localHelpImage,
    size: "wide",
    keywords: ["local", "help", "services", "handyman", "mover", "cleaner", "electrician"],
  },
  {
    label: "Battles",
    subtitle: "Compete. Rank. Win.",
    route: "/battles",
    image: battlesImage,
    size: "feature",
    keywords: ["battle", "creator", "music", "podcast", "competition", "vote"],
  },
  {
    label: "Deals",
    subtitle: "Local savings & limited offers.",
    route: "/deals",
    image: dealsImage,
    size: "tile",
    keywords: ["deal", "coupon", "discount", "offer", "local"],
  },
  {
    label: "Marketplace",
    subtitle: "Buy. Sell. Discover.",
    route: "/marketplace",
    image: marketplaceImage,
    size: "tile",
    keywords: ["market", "marketplace", "buy", "sell", "items", "shopping"],
  },
  {
    label: "YAJ TV",
    subtitle: "Watch. Enjoy. Share.",
    route: "/tv/watch",
    image: yajTvImage,
    size: "tile",
    keywords: ["tv", "video", "live", "watch", "stream"],
  },
  {
    label: "Radio",
    subtitle: "Listen. Vibe. Connect.",
    route: "/radio",
    image: radioImage,
    size: "tile",
    keywords: ["radio", "music", "listen", "audio"],
  },
  {
    label: "Wellness",
    subtitle: "Move. Breathe. Live better.",
    route: "/wellness",
    image: wellnessImage,
    size: "tile",
    keywords: ["wellness", "sleep", "move", "relax", "health", "exercise"],
  },
  {
    label: "Careers",
    subtitle: "Jobs, internships & opportunities.",
    route: "/jobs",
    image: careersImage,
    size: "tile",
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
  const sizing =
    item.size === "gig"
      ? "col-span-6 h-[88px]"
      : item.size === "wide"
        ? "col-span-6"
        : item.size === "feature"
          ? "col-span-6"
          : "col-span-2";

  const aspect =
    item.size === "gig"
      ? "h-full"
      : item.size === "feature"
        ? "aspect-[3.64/1]"
        : item.size === "wide"
          ? item.label === "Find Local Help"
            ? "aspect-[2.44/1]"
            : "aspect-[4.6/1]"
          : "aspect-[1.1/1]";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${sizing} group relative overflow-hidden rounded-[22px] border border-black/5 bg-white text-left shadow-[0_10px_28px_rgba(15,23,42,0.10)] transition duration-200 active:scale-[0.985]`}
      aria-label={`Open ${item.label}`}
    >
      <img
        src={item.image}
        alt={`${item.label} preview`}
        className={`block w-full ${aspect} object-cover transition-transform duration-500 group-hover:scale-[1.01]`}
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
      <header className="shrink-0 border-b border-border/60 bg-background/95 px-4 pb-3 pt-3 backdrop-blur-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Discover what's happening</p>
        <h1 className="mt-0.5 text-[30px] font-black tracking-tight">Explore</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Live activity, local finds and things worth checking out.</p>

        <div className="relative mt-3">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, jobs, deals, marketplace…"
            className="h-12 w-full rounded-2xl border border-border bg-muted/70 pl-10 pr-10 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
        <div className="mb-3">
          <h2 className="text-lg font-black">🔥 Top picks</h2>
          <p className="text-xs text-muted-foreground">Explore live activity, useful local tools and trending YAJ features.</p>
        </div>

        {filteredItems.length ? (
          <div className="grid grid-cols-6 gap-2.5">
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
