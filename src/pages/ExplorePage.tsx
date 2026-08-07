import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Radio, BriefcaseBusiness, Gamepad2, HeartPulse, MapPin, ShoppingBag, Tag, Tv, Swords } from "lucide-react";
import battlesImage from "@/assets/card-battles.jpg";
import marketplaceImage from "@/assets/card-store.jpg";
import dealsImage from "@/assets/deals/deals-lifestyle-shop.jpg";
import tvImage from "@/assets/musicvideo-1.jpg";
import radioImage from "@/assets/card-radio.jpg";
import wellnessImage from "@/assets/wellness/coach-stills/brisk_walk.webp";
import careersImage from "@/assets/studio-3.jpg";
import localHelpImage from "@/assets/profile-banner.jpg";
import gamesImage from "@/assets/genre-futurepop.jpg";

type ExploreItem = {
  label: string;
  subtitle: string;
  route?: string;
  image: string;
  eyebrow?: string;
  badge?: string;
  layout: "hero" | "tile" | "wide";
  icon: ComponentType<{ className?: string }>;
};

const EXPLORE_ITEMS: ExploreItem[] = [
  {
    label: "Battles",
    subtitle: "Compete. Rank. Win.",
    route: "/battles",
    image: battlesImage,
    eyebrow: "Trending now",
    badge: "LIVE",
    layout: "hero",
    icon: Swords,
  },
  {
    label: "Local Help",
    subtitle: "Find trusted help nearby.",
    route: "/local-help",
    image: localHelpImage,
    eyebrow: "Near you",
    badge: "OPEN",
    layout: "hero",
    icon: MapPin,
  },
  {
    label: "Deals",
    subtitle: "Local savings & limited offers.",
    route: "/deals",
    image: dealsImage,
    eyebrow: "Featured offer",
    layout: "tile",
    icon: Tag,
  },
  {
    label: "Marketplace",
    subtitle: "Buy. Sell. Discover.",
    route: "/marketplace",
    image: marketplaceImage,
    eyebrow: "Fresh listings",
    layout: "tile",
    icon: ShoppingBag,
  },
  {
    label: "YAJ TV",
    subtitle: "Watch. Enjoy. Share.",
    route: "/tv/watch",
    image: tvImage,
    eyebrow: "Playing now",
    badge: "LIVE",
    layout: "tile",
    icon: Tv,
  },
  {
    label: "Radio",
    subtitle: "Listen. Vibe. Connect.",
    route: "/radio",
    image: radioImage,
    eyebrow: "On air",
    layout: "tile",
    icon: Radio,
  },
  {
    label: "Wellness",
    subtitle: "Sleep · Move · Relax",
    route: "/wellness",
    image: wellnessImage,
    eyebrow: "Feel better",
    layout: "tile",
    icon: HeartPulse,
  },
  {
    label: "Careers",
    subtitle: "Jobs, internships & opportunities.",
    route: "/jobs",
    image: careersImage,
    eyebrow: "New opportunities",
    layout: "tile",
    icon: BriefcaseBusiness,
  },
  {
    label: "Games",
    subtitle: "Play, compete and discover what's next.",
    image: gamesImage,
    eyebrow: "Featured games",
    layout: "wide",
    icon: Gamepad2,
  },
];

function ExploreCard({ item, onOpen }: { item: ExploreItem; onOpen: () => void }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative overflow-hidden rounded-[22px] border border-black/5 bg-card text-left shadow-[0_8px_24px_rgba(20,25,35,0.10)] transition-all duration-200 active:scale-[0.985] ${
        item.layout === "hero"
          ? "col-span-3 min-h-[190px]"
          : item.layout === "wide"
            ? "col-span-6 min-h-[118px]"
            : "col-span-2 min-h-[158px]"
      }`}
      aria-label={`Open ${item.label}`}
    >
      <img
        src={item.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 to-transparent" />

      <div className="relative flex h-full min-h-[inherit] flex-col justify-between p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur-md">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.eyebrow}</span>
          </span>
          {item.badge && (
            <span className="rounded-full bg-white/92 px-2 py-1 text-[10px] font-black tracking-wide text-foreground shadow-sm">
              {item.badge}
            </span>
          )}
        </div>

        <div>
          <h3 className={`${item.layout === "hero" ? "text-[22px]" : "text-[17px]"} font-black leading-tight text-white drop-shadow-sm`}>
            {item.label}
          </h3>
          <p className={`mt-1 line-clamp-2 text-white/90 ${item.layout === "wide" ? "text-sm" : "text-[11px]"}`}>
            {item.subtitle}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return EXPLORE_ITEMS;

    return EXPLORE_ITEMS.filter((item) => {
      const haystack = `${item.label} ${item.subtitle} ${item.eyebrow ?? ""}`.toLowerCase();
      if (haystack.includes(needle)) return true;
      if (item.label === "Wellness" && ["sleep", "move", "relax", "health"].some((term) => needle.includes(term))) return true;
      if (item.label === "Local Help" && ["gig", "services", "handyman", "local"].some((term) => needle.includes(term))) return true;
      if (item.label === "Deals" && ["coupon", "discount", "offer", "promo"].some((term) => needle.includes(term))) return true;
      return false;
    });
  }, [query]);

  return (
    <div className="flex h-[calc(100dvh-133px)] flex-col overflow-hidden bg-background text-foreground lg:h-auto">
      <header className="shrink-0 border-b border-border/60 bg-background/95 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Discover what’s happening</p>
          <h1 className="mt-0.5 text-[28px] font-black tracking-tight">Explore</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Live activity, local finds and things worth checking out.</p>
        </div>

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

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3">
        <div className="mb-3">
          <h2 className="text-lg font-black">🔥 Top picks</h2>
          <p className="text-xs text-muted-foreground">A quick look at the best of YAJ right now.</p>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-6 gap-2.5">
            {items.map((item) => (
              <ExploreCard
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
            <p className="mt-1 text-sm text-muted-foreground">Try jobs, deals, wellness, marketplace, battles, or local help.</p>
          </div>
        )}
      </main>
    </div>
  );
}
