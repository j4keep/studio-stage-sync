import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search, Sparkles, X } from "lucide-react";
import yajLogo from "@/assets/yaj-logo.png";

type ExploreItem = {
  label: string;
  emoji: string;
  background: string;
  route?: string;
};

type ExploreSection = {
  title: string;
  subtitle?: string;
  items: ExploreItem[];
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

// Top-priority row — the "front door" to YAJ
const TOP_PICKS: ExploreItem[] = [
  { label: "Trending", emoji: "🔥", background: bg.orange },
  { label: "Find Local Help", emoji: "🛠", background: bg.teal, route: "/local-help" },
  { label: "Careers", emoji: "💼", background: bg.indigo, route: "/jobs" },
  { label: "Marketplace", emoji: "🛍", background: bg.pink },
  { label: "Deals", emoji: "💰", background: bg.green, route: "/store" },
  { label: "Live", emoji: "🎤", background: bg.red },
  { label: "Battles", emoji: "🏆", background: bg.yellow, route: "/battles" },
  { label: "Communities", emoji: "❤️", background: bg.purple, route: "/circle" },
];

const SECTIONS: ExploreSection[] = [
  {
    title: "Create",
    subtitle: "Make something, share it with the world",
    items: [
      { label: "Music", emoji: "🎵", background: bg.purple, route: "/radio" },
      { label: "Gaming", emoji: "🎮", background: bg.indigo },
      { label: "Entertainment", emoji: "🎬", background: bg.pink },
      { label: "Fashion & Beauty", emoji: "💄", background: bg.red },
      { label: "Food", emoji: "🍔", background: bg.orange },
      { label: "Cars", emoji: "🚗", background: bg.slate },
    ],
  },
  {
    title: "Connect",
    subtitle: "Find your people",
    items: [
      { label: "Find Local Help", emoji: "🛠", background: bg.teal, route: "/local-help" },
      { label: "Communities", emoji: "❤️", background: bg.purple, route: "/circle" },
      { label: "Live Now", emoji: "🎤", background: bg.red },
      { label: "Battles", emoji: "🏆", background: bg.yellow, route: "/battles" },
      { label: "Networking", emoji: "🤝", background: bg.blue },
      { label: "Events", emoji: "🎟", background: bg.orange },
    ],
  },
  {
    title: "Elevate",
    subtitle: "Level up your life",
    items: [
      { label: "Careers", emoji: "💼", background: bg.indigo, route: "/jobs" },
      { label: "Find Local Help", emoji: "🤝", background: bg.teal, route: "/local-help" },
      { label: "Business", emoji: "💡", background: bg.yellow },
      { label: "Education", emoji: "📚", background: bg.blue },
      { label: "Tech", emoji: "💻", background: bg.slate },
      { label: "Fitness", emoji: "🏋️", background: bg.green },
      { label: "Travel", emoji: "✈️", background: bg.orange },
    ],
  },
  {
    title: "Shop & Save",
    items: [
      { label: "Marketplace", emoji: "🛍", background: bg.pink },
      { label: "Deals", emoji: "💰", background: bg.green, route: "/store" },
      { label: "Flash Sales", emoji: "⚡", background: bg.yellow },
      { label: "Local Spots", emoji: "📍", background: bg.orange },
    ],
  },
];

function ExploreCard({ item }: { item: ExploreItem }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={item.route ? () => navigate(item.route!) : undefined}
      className="w-[8.75rem] shrink-0 snap-start text-left active:scale-[0.98] transition-transform"
    >
      <div
        className={`relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${item.background} border border-black/5 shadow-sm flex items-center justify-center`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.6),transparent_38%)]" />
        <span className="relative text-6xl drop-shadow-[0_6px_8px_rgba(0,0,0,0.25)]" aria-hidden>
          {item.emoji}
        </span>
      </div>
      <p className="mt-1.5 px-0.5 text-xs font-semibold text-foreground truncate">{item.label}</p>
    </button>
  );
}

function SectionRow({ section }: { section: ExploreSection }) {
  return (
    <section className="mb-6">
      <div className="px-4 mb-2">
        <h2 className="text-base font-bold text-foreground">{section.title}</h2>
        {section.subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{section.subtitle}</p>
        )}
      </div>
      <div className="h-scroll-isolate flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
        {section.items.map((item) => (
          <ExploreCard key={`${section.title}-${item.label}`} item={item} />
        ))}
        <button
          type="button"
          className="w-12 shrink-0 snap-start rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground"
          aria-label={`See more ${section.title}`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(normalized) ||
          section.title.toLowerCase().includes(normalized),
      ),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  const filteredTop = useMemo(() => {
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

      {/* Featured — Local Help discovery */}
      {!query && (
        <section className="px-4 mt-2 mb-5 space-y-3">
          <button
            type="button"
            onClick={() => navigate("/local-help")}
            className="relative w-full h-36 rounded-2xl overflow-hidden text-left bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 shadow-sm"
          >
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_30%,white,transparent_25%),radial-gradient(circle_at_80%_70%,white,transparent_22%)]" />
            <div className="absolute left-4 top-4 z-10 max-w-[70%]">
              <div className="inline-flex items-center gap-1 rounded-full bg-black/50 text-white px-2 py-1 text-[10px] font-bold">
                <Sparkles className="w-3 h-3" />
                LOCAL SERVICES
              </div>
              <h2 className="mt-3 text-xl font-black text-white leading-tight">Need a handyman?</h2>
              <p className="mt-1 text-xs font-medium text-white/90">
                Cleaners, DJs, photographers & neighbors ready to help.
              </p>
            </div>
            <div className="absolute -right-2 -bottom-2 text-[6.5rem] leading-none opacity-90" aria-hidden>
              🛠
            </div>
          </button>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {[
              { label: "House cleaning", emoji: "🧹", id: "cleaning" },
              { label: "Photographers", emoji: "📸", id: "photography" },
              { label: "DJs this weekend", emoji: "🎧", id: "dj" },
              { label: "Mobile mechanics", emoji: "🚗", id: "auto" },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => navigate(`/local-help/${chip.id}`)}
                className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold"
              >
                {chip.emoji} {chip.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Top picks — the priority row */}
      {filteredTop.length > 0 && (
        <section className="mb-6">
          <div className="px-4 mb-2">
            <h2 className="text-base font-bold text-foreground">Top Picks</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Your front door to YAJ</p>
          </div>
          <div className="h-scroll-isolate flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
            {filteredTop.map((item) => (
              <ExploreCard key={`top-${item.label}`} item={item} />
            ))}
          </div>
        </section>
      )}

      <div>
        {sections.length ? (
          sections.map((section) => <SectionRow key={section.title} section={section} />)
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">No results</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
