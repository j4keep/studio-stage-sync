import { useEffect, useRef, useState } from "react";
import { ArrowUp, ExternalLink, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { happeningKindLabel, type HappeningItem } from "@/lib/happening-items";

/** Dedicated Happening-only vertical viewer; never mixes in regular feed items. */
export default function HappeningFullscreenViewer({
  items, startIndex, onClose,
}: { items: HappeningItem[]; startIndex: number; onClose: () => void }) {
  const navigate = useNavigate();
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("feed-nav-toggle", { detail: { hidden: true } }));
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prior;
      window.dispatchEvent(new CustomEvent("feed-nav-toggle", { detail: { hidden: false } }));
    };
  }, []);

  useEffect(() => {
    railRef.current?.children.item(startIndex)?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [startIndex]);

  const move = (next: number) => {
    const position = Math.max(0, Math.min(items.length - 1, next));
    railRef.current?.children.item(position)?.scrollIntoView({ block: "start", behavior: "smooth" });
    setIndex(position);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white" role="dialog" aria-modal="true" aria-label="Happening viewer">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <button onClick={onClose} aria-label="Close Happening viewer" className="rounded-full bg-black/60 p-3"><X className="h-5 w-5" /></button>
        <span className="rounded-full bg-black/60 px-4 py-2 text-sm font-bold">Happening · {index + 1} / {items.length}</span>
      </div>
      <div ref={railRef} className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-hide"
        onScroll={(event) => {
          const el = event.currentTarget;
          if (el.clientHeight) setIndex(Math.min(items.length - 1, Math.round(el.scrollTop / el.clientHeight)));
        }}>
        {items.map((item, i) => (
          <section key={item.id} className="relative flex h-full w-full snap-start snap-always flex-col items-center justify-center overflow-hidden bg-black">
            {item.previewVideoUrl && Math.abs(i - index) <= 1 ? (
              <video key={item.id} src={item.previewVideoUrl} poster={item.coverUrl || undefined} controls playsInline loop autoPlay={i === index} className="absolute inset-0 h-full w-full object-contain" />
            ) : item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} className="absolute inset-0 h-full w-full object-contain" />
            ) : <div className="text-7xl opacity-30">YAJ</div>}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),2rem)] z-10 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/75">{happeningKindLabel(item.kind)}</p>
              <h2 className="mb-2 text-xl font-bold">{item.title}</h2>
              {item.subtitle && <p className="mb-4 text-sm text-white/80">{item.subtitle}</p>}
              {(item.route || item.kind === "post") && (
                <button className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black"
                  onClick={() => { onClose(); navigate(item.route || `/feed?post=${encodeURIComponent(item.sourceId)}`); }}>
                  Open {happeningKindLabel(item.kind)} <ExternalLink className="h-4 w-4" />
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
        <button onClick={() => move(index - 1)} aria-label="Previous Happening" disabled={index === 0} className="rounded-full bg-black/55 p-3 disabled:opacity-30"><ArrowUp className="h-5 w-5" /></button>
        <button onClick={() => move(index + 1)} aria-label="Next Happening" disabled={index === items.length - 1} className="rounded-full bg-black/55 p-3 disabled:opacity-30"><ArrowUp className="h-5 w-5 rotate-180" /></button>
      </div>
    </div>
  );
}
