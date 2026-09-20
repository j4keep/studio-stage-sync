import { useEffect, useState } from "react";
import { Loader2, Bookmark } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WheuatTv, type WheuatTvItem } from "./wheuatTvStore";
import { YajTvShell } from "./YajTvShell";
import { YajTvPosterCard } from "./YajTvPosterCard";

const YajTvMyListPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<WheuatTvItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => setItems(await WheuatTv.listWatchlist());

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
  }, [user?.id]);

  return (
    <YajTvShell headerTitle="My List" showBack>
      <div className="px-4 pt-2">
        {!user ? (
          <p className="pt-10 text-center text-sm text-white/40">Sign in to save titles to My List.</p>
        ) : loading ? (
          <div className="flex justify-center py-16 text-white/50">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-16 text-center text-sm text-white/40">
            <Bookmark className="h-6 w-6" />
            Tap the bookmark on any title to save it here.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 pt-5 sm:grid-cols-4 md:grid-cols-5">
            {items.map((item) => (
              <YajTvPosterCard key={item.id} item={item} fluid />
            ))}
          </div>
        )}
      </div>
    </YajTvShell>
  );
};

export default YajTvMyListPage;
