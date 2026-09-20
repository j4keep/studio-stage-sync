import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { WheuatTv, type WheuatTvItem } from "./wheuatTvStore";
import { YajTvShell } from "./YajTvShell";
import { YajTvRow } from "./YajTvRow";
import { YajTvPosterCard } from "./YajTvPosterCard";
import { HOME_SECTIONS, selectByCategory, type CategorySelection } from "./yajTvMeta";

const YajTvHomePage = () => {
  const [items, setItems] = useState<WheuatTvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategorySelection>("all");

  const refresh = async () => setItems(await WheuatTv.list());

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setLoading(false);
    })();
    const h = () => refresh();
    window.addEventListener("wheuat-tv-updated", h);
    return () => {
      active = false;
      window.removeEventListener("wheuat-tv-updated", h);
    };
  }, []);

  if (loading) {
    return (
      <YajTvShell category={category} onCategoryChange={setCategory}>
        <div className="flex justify-center py-16 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </YajTvShell>
    );
  }

  if (!items.length) {
    return (
      <YajTvShell category={category} onCategoryChange={setCategory}>
        <div className="px-4 py-16 text-center text-sm text-white/50">
          Nothing on YAJ.TV yet. Be the first to publish.
        </div>
      </YajTvShell>
    );
  }

  return (
    <YajTvShell category={category} onCategoryChange={setCategory}>
      {category === "all" ? (
        <div className="pt-1">
          {HOME_SECTIONS.map((section) => (
            <YajTvRow key={section.key} title={section.title} items={selectByCategory(items, section.key)} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 px-4 pt-1 sm:grid-cols-4 md:grid-cols-5">
          {selectByCategory(items, category).map((item) => (
            <YajTvPosterCard key={item.id} item={item} fluid />
          ))}
        </div>
      )}
    </YajTvShell>
  );
};

export default YajTvHomePage;
