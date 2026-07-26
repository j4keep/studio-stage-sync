import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import yajLogo from "@/assets/yaj-logo.png";

type ExploreItem = {
  label: string;
  emoji: string;
  background: string;
  route?: string;
};

const bg = {
  green: "from-emerald-300 to-green-400",
  purple: "from-violet-300 to-fuchsia-400",
  pink: "from-pink-300 to-rose-400",
  blue: "from-sky-300 to-cyan-400",
  yellow: "from-amber-200 to-yellow-400",
  orange: "from-orange-300 to-amber-400",
  slate: "from-slate-300 to-slate-500",
  red: "from-red-300 to-rose-500",
  teal: "from-teal-300 to-emerald-500",
  indigo: "from-indigo-300 to-violet-500",
} as const;

const TOP_PICKS: ExploreItem[] = [
  { label: "Radio", emoji: "🎵", background: bg.purple, route: "/radio" },
  { label: "Marketplace", emoji: "🛍", background: bg.pink, route: "/store" },
  { label: "Careers", emoji: "💼", background: bg.indigo, route: "/jobs" },
  { label: "Wellness", emoji: "💪", background: bg.green },
  { label: "Community", emoji: "🏠", background: bg.blue, route: "/circle" },
  { label: "Find Local Help", emoji: "🛠", background: bg.teal, route: "/local-help" },
  { label: "Post a Gig", emoji: "➕", background: bg.orange, route: "/gigs" },
  { label: "Services", emoji: "🟰", background: bg.slate },
  { label: "YAJ TV", emoji: "📺", background: bg.red, route: "/tv/watch" },
  { label: "Games", emoji: "🎮", background: bg.indigo },
  { label: "Battles", emoji: "⚔️", background: bg.yellow, route: "/battles" },
  { label: "Events", emoji: "🎪", background: bg.orange },
];

function ExploreCard({ item }: { item: ExploreItem }) {
  const navigate = useNavigate();
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
    </button>
  );
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const n = query.trim().toLowerCase();
    if (!n) return TOP_PICKS;
    return TOP_PICKS.filter((i) => i.label.toLowerCase().includes(n));
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">Discover people, opportunities & communities</p>
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
