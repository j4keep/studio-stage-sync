import { useMemo, useState } from "react";
import { ChevronRight, Info, Search, Sparkles, X } from "lucide-react";
import { EMOJI_MAP } from "@/lib/emoji-characters";
import yajLogo from "@/assets/yaj-logo.png";

type ExploreItem = {
  label: string;
  emojiId: string;
  background: string;
};

type ExploreSection = {
  title: string;
  items: ExploreItem[];
};

const backgrounds = {
  green: "from-emerald-300 to-green-400",
  purple: "from-violet-300 to-fuchsia-400",
  pink: "from-pink-300 to-rose-400",
  blue: "from-sky-300 to-cyan-400",
  yellow: "from-amber-200 to-yellow-400",
  orange: "from-orange-300 to-amber-400",
} as const;

const SECTIONS: ExploreSection[] = [
  {
    title: "YAJ Favorites",
    items: [
      { label: "Buddy Dance", emojiId: "yaj-dance", background: backgrounds.green },
      { label: "Buddy Peace", emojiId: "yaj-peace", background: backgrounds.purple },
      { label: "Buddy Love", emojiId: "yaj-love", background: backgrounds.pink },
      { label: "Buddy Wave", emojiId: "yaj-wave", background: backgrounds.blue },
    ],
  },
  {
    title: "Action & Adventure",
    items: [
      { label: "Dragon Quest", emojiId: "dragon", background: backgrounds.purple },
      { label: "Rocket Run", emojiId: "rocket", background: backgrounds.green },
      { label: "Lightning Mode", emojiId: "lightning", background: backgrounds.yellow },
      { label: "Power Punch", emojiId: "punch", background: backgrounds.orange },
    ],
  },
  {
    title: "Sports",
    items: [
      { label: "Champions", emojiId: "trophy", background: backgrounds.blue },
      { label: "Game Face", emojiId: "flexed", background: backgrounds.green },
      { label: "Crowned", emojiId: "crown", background: backgrounds.purple },
      { label: "All Star", emojiId: "star", background: backgrounds.yellow },
    ],
  },
  {
    title: "Celebrities",
    items: [
      { label: "VIP Energy", emojiId: "cool", background: backgrounds.purple },
      { label: "Queen Status", emojiId: "queen", background: backgrounds.pink },
      { label: "Diamond Life", emojiId: "diamond", background: backgrounds.blue },
      { label: "Big Money", emojiId: "money", background: backgrounds.green },
    ],
  },
  {
    title: "Kids & Family",
    items: [
      { label: "Happy Buddy", emojiId: "yaj-wave", background: backgrounds.yellow },
      { label: "Love & Joy", emojiId: "yaj-love", background: backgrounds.pink },
      { label: "Flower Power", emojiId: "flowers", background: backgrounds.green },
      { label: "Little Alien", emojiId: "alien", background: backgrounds.blue },
    ],
  },
  {
    title: "Comedy",
    items: [
      { label: "Laugh Out Loud", emojiId: "laughcry", background: backgrounds.blue },
      { label: "Mind Blown", emojiId: "mindblown", background: backgrounds.purple },
      { label: "Oops", emojiId: "poop", background: backgrounds.orange },
      { label: "Shocked", emojiId: "shocked", background: backgrounds.yellow },
    ],
  },
  {
    title: "Self-Improvement",
    items: [
      { label: "Good Vibes", emojiId: "vibing", background: backgrounds.purple },
      { label: "Peace Mode", emojiId: "peace", background: backgrounds.blue },
      { label: "Level Up", emojiId: "thumbsup", background: backgrounds.pink },
      { label: "Keep Going", emojiId: "fire", background: backgrounds.orange },
    ],
  },
  {
    title: "The Garage",
    items: [
      { label: "DJ Booth", emojiId: "dj", background: backgrounds.purple },
      { label: "Studio Session", emojiId: "vibing", background: backgrounds.orange },
      { label: "Mic Check", emojiId: "mic", background: backgrounds.blue },
      { label: "Dance Floor", emojiId: "dance", background: backgrounds.green },
    ],
  },
];

function ExploreCard({ item }: { item: ExploreItem }) {
  return (
    <button
      type="button"
      className="w-[8.75rem] shrink-0 snap-start text-left active:scale-[0.98] transition-transform"
    >
      <div
        className={`relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br ${item.background} border border-black/5 shadow-sm`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.7),transparent_34%)]" />
        <img
          src={EMOJI_MAP[item.emojiId]}
          alt=""
          className="relative w-full h-full object-contain p-3 drop-shadow-[0_8px_8px_rgba(0,0,0,0.2)]"
        />
      </div>
      <p className="mt-1.5 px-0.5 text-xs font-semibold text-foreground truncate">{item.label}</p>
    </button>
  );
}

function SectionRow({ section }: { section: ExploreSection }) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-2">
        <h2 className="text-base font-bold text-foreground">{section.title}</h2>
        <button type="button" className="p-1 text-muted-foreground" aria-label={`About ${section.title}`}>
          <Info className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide overscroll-x-contain touch-pan-x">
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">Discover your next vibe</p>
            <h1 className="text-2xl font-black tracking-tight">Explore</h1>
          </div>
          <img src={yajLogo} alt="YAJ" className="h-14 w-auto -my-3" />
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sidekicks and collections"
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

      {!query && (
        <section className="px-4 mt-2 mb-6">
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl overflow-hidden text-left bg-gradient-to-br from-emerald-300 via-cyan-300 to-violet-400 shadow-sm"
          >
            <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_30%,white,transparent_25%),radial-gradient(circle_at_80%_70%,white,transparent_22%)]" />
            <div className="absolute left-4 top-4 z-10 max-w-[55%]">
              <div className="inline-flex items-center gap-1 rounded-full bg-black/75 text-white px-2 py-1 text-[10px] font-bold">
                <Sparkles className="w-3 h-3" />
                FEATURED
              </div>
              <h2 className="mt-3 text-xl font-black text-slate-950 leading-tight">Meet the YAJ Buddies</h2>
              <p className="mt-1 text-xs font-medium text-slate-800">Wave, react, dance, and celebrate together.</p>
            </div>
            <img
              src={EMOJI_MAP["yaj-dance"]}
              alt=""
              className="absolute -right-2 -bottom-6 w-40 h-40 object-contain drop-shadow-xl"
            />
          </button>
        </section>
      )}

      <div>
        {sections.length ? (
          sections.map((section) => <SectionRow key={section.title} section={section} />)
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">No collections found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
