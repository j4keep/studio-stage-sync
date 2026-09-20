import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Bookmark, BookmarkCheck, Lock } from "lucide-react";
import { WheuatTv, type WheuatTvItem } from "./wheuatTvStore";
import { KIND_META, formatViews } from "./yajTvMeta";
import { YajTvPosterPlaceholder } from "./YajTvPosterPlaceholder";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export function YajTvPosterCard({
  item,
  size = "md",
  fluid = false,
}: {
  item: WheuatTvItem;
  size?: "sm" | "md";
  /** Fill the parent (grid cell) instead of using a fixed carousel width. */
  fluid?: boolean;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [inList, setInList] = useState(item.inMyList);
  const poster = item.posterUrl || item.thumbUrl;
  const Icon = KIND_META[item.kind].Icon;

  const toggleMyList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast({ title: "Sign in to use My List" });
      return;
    }
    const next = !inList;
    setInList(next);
    try {
      await WheuatTv.toggleWatchlist(item.id, inList);
    } catch {
      setInList(!next);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/tv/title/${item.id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/tv/title/${item.id}`)}
      className={`group cursor-pointer text-left ${
        fluid ? "w-full" : `shrink-0 snap-start ${size === "sm" ? "w-[104px]" : "w-[132px] sm:w-[150px]"}`
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-neutral-900 shadow-lg shadow-black/40 ring-1 ring-white/5 transition-transform duration-200 group-active:scale-95">
        {poster ? (
          <img src={poster} alt={item.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <YajTvPosterPlaceholder title={item.title} kind={item.kind} className="absolute inset-0" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
        {item.isOriginal && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black">
            YAJ Original
          </span>
        )}
        {item.accessTier === "subscribers" && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
            <Lock className="h-2 w-2" /> Subscribers
          </span>
        )}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMyList}
            aria-label={inList ? "Remove from My List" : "Add to My List"}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
          >
            {inList ? <BookmarkCheck className="h-3 w-3 text-primary" /> : <Bookmark className="h-3 w-3" />}
          </button>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
            <Icon className="h-3 w-3" />
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-1.5">
          <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-white">{item.title}</p>
          <div className="mt-0.5 flex items-center gap-1 text-[9px] text-white/70">
            {item.rating != null && (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-current text-amber-400" />
                {item.rating.toFixed(1)}
              </span>
            )}
            {item.rating != null && item.views > 0 && <span>·</span>}
            {item.views > 0 && <span>{formatViews(item.views)}</span>}
          </div>
        </div>
      </div>
      <p className="mt-1 truncate text-[10px] text-white/50">{item.creator.displayName}</p>
    </div>
  );
}
