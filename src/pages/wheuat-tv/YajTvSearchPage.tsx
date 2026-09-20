import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { WheuatTv, type WheuatTvItem } from "./wheuatTvStore";
import { YajTvShell } from "./YajTvShell";
import { YajTvPosterCard } from "./YajTvPosterCard";

const YajTvSearchPage = () => {
  const [items, setItems] = useState<WheuatTvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await WheuatTv.list();
      if (active) {
        setItems(list);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => (query.trim() ? WheuatTv.search(items, query) : []), [items, query]);

  return (
    <YajTvShell headerTitle="Search" showBack>
      <div className="px-4 pt-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titles, creators, categories…"
            className="h-11 w-full rounded-xl border border-white/15 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/40"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-white/50">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !query.trim() ? (
          <p className="pt-10 text-center text-sm text-white/40">Search YAJ.TV's full catalog.</p>
        ) : results.length === 0 ? (
          <p className="pt-10 text-center text-sm text-white/40">No matches for "{query}".</p>
        ) : (
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 pt-5 sm:grid-cols-4 md:grid-cols-5">
            {results.map((item) => (
              <YajTvPosterCard key={item.id} item={item} fluid />
            ))}
          </div>
        )}
      </div>
    </YajTvShell>
  );
};

export default YajTvSearchPage;
