import type { WheuatTvItem } from "./wheuatTvStore";
import { YajTvPosterCard } from "./YajTvPosterCard";

export function YajTvRow({ title, items }: { title: string; items: WheuatTvItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-4 text-[15px] font-bold text-white">{title}</h2>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-hide">
        {items.map((item) => (
          <YajTvPosterCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
