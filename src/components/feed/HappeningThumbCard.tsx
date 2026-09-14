import { Play, Image as ImageIcon } from "lucide-react";
import type { HappeningItem } from "@/lib/happening-items";
import { happeningKindLabel } from "@/lib/happening-items";

interface Props {
  item: HappeningItem;
  compact?: boolean;
  onOpen: () => void;
}

/** Compact social-style card for the Happening rail. */
export default function HappeningThumbCard({ item, compact = false, onOpen }: Props) {
  const isVideo = item.mediaType === "video";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-sm transition duration-150 active:scale-[0.985] ${
        compact ? "w-[6.4rem] shrink-0" : "w-full"
      }`}
    >
      <div className={`relative w-full overflow-hidden bg-muted ${compact ? "aspect-[4/5]" : "aspect-[4/5]"}`}>
        {item.coverUrl ? (
          <img src={item.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {isVideo ? <Play className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          </div>
        )}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 via-black/25 to-transparent px-2 pb-5 pt-2">
          <span className="inline-flex rounded-full bg-black/55 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
            {happeningKindLabel(item.kind)}
          </span>
        </div>
        {isVideo ? (
          <div className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white shadow-sm backdrop-blur-sm">
            <Play className="h-3 w-3 fill-white" />
          </div>
        ) : null}
      </div>
      <div className="px-2.5 py-2.5">
        <p className={`${compact ? "text-[11px]" : "text-xs"} line-clamp-2 font-bold leading-[1.3] text-foreground`}>
          {item.title}
        </p>
      </div>
    </button>
  );
}
