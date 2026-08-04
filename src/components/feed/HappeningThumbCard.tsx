import { Play, Image as ImageIcon } from "lucide-react";
import type { HappeningItem } from "@/lib/happening-items";
import { happeningKindLabel } from "@/lib/happening-items";

interface Props {
  item: HappeningItem;
  compact?: boolean;
  onOpen: () => void;
}

/** Compact card for the Happening rail — tap opens the source destination. */
export default function HappeningThumbCard({ item, compact = false, onOpen }: Props) {
  const isVideo = item.mediaType === "video";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm active:scale-[0.98] transition-transform"
    >
      <div className={`relative w-full overflow-hidden bg-muted ${compact ? "aspect-[3/4]" : "aspect-[4/5]"}`}>
        {item.coverUrl ? (
          isVideo ? (
            <video
              src={item.coverUrl}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {isVideo ? <Play className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          </div>
        )}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-1.5 pb-4 pt-1.5">
          <span className="rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
            {happeningKindLabel(item.kind)}
          </span>
        </div>
        {isVideo ? (
          <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white">
            <Play className="h-3 w-3 fill-white" />
          </div>
        ) : null}
      </div>
      <div className="px-1.5 py-1.5">
        <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">{item.title}</p>
      </div>
    </button>
  );
}
