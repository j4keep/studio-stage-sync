import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import yajLogo from "@/assets/yaj-logo.png";

import cardBattles from "@/assets/explore/cards/battles.webp";
import cardWellness from "@/assets/explore/cards/wellness.webp";
import cardRadio from "@/assets/explore/cards/radio.webp";
import cardCareers from "@/assets/explore/cards/careers.webp";
import cardMarketplace from "@/assets/explore/cards/marketplace.webp";
import cardDeals from "@/assets/explore/cards/deals.webp";
import cardFindLocalHelp from "@/assets/explore/cards/find-local-help.webp";
import cardPostAGig from "@/assets/explore/cards/post-a-gig.webp";
import cardServices from "@/assets/explore/cards/services.webp";
import cardYajTv from "@/assets/explore/cards/yaj-tv.webp";
import cardGames from "@/assets/explore/cards/games.webp";
import cardEvents from "@/assets/explore/cards/events.webp";

type ExploreItem = {
  label: string;
  subtitle: string;
  image: string;
  route: string;
};

/** Square Explore tiles — image only, no layered card chrome underneath. */
const TOP_PICKS: ExploreItem[] = [
  { label: "Battles", subtitle: "Compete. Rank. Win.", image: cardBattles, route: "/battles" },
  { label: "Wellness", subtitle: "Sleep • Move • Relax", image: cardWellness, route: "/wellness" },
  { label: "Radio", subtitle: "Listen. Vibe. Connect.", image: cardRadio, route: "/radio" },
  { label: "Careers", subtitle: "Find your path.", image: cardCareers, route: "/jobs" },
  { label: "Marketplace", subtitle: "Buy. Sell. Discover.", image: cardMarketplace, route: "/marketplace" },
  { label: "Deals", subtitle: "Local savings & limited offers.", image: cardDeals, route: "/deals" },
  { label: "Find Local Help", subtitle: "Help nearby. Fast.", image: cardFindLocalHelp, route: "/local-help" },
  { label: "Post a Gig", subtitle: "Offer your skills.", image: cardPostAGig, route: "/gigs" },
  { label: "Services", subtitle: "Book trusted professionals.", image: cardServices, route: "/services" },
  { label: "YAJ TV", subtitle: "Watch. Enjoy. Share.", image: cardYajTv, route: "/tv/watch" },
  { label: "Games", subtitle: "Play. Earn. Level up.", image: cardGames, route: "/games" },
  { label: "Events", subtitle: "Local events you'll love.", image: cardEvents, route: "/events" },
];

function ExploreCard({ item }: { item: ExploreItem }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(item.route)}
      aria-label={`${item.label}. ${item.subtitle}`}
      className="relative m-0 aspect-square w-full overflow-hidden rounded-2xl border-0 bg-transparent p-0 shadow-none outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{
        backgroundImage: `url(${item.image})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
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
          <div className="grid grid-cols-3 gap-2.5">
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
