import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * App-wide image viewer. Any image on the app opens full-screen (phone-size)
 * when tapped, instead of staying boxed inside its card.
 *
 * When the tapped image belongs to a group of photos (marketplace listing,
 * gig photos, business portfolio, chat album), the whole group opens as a
 * swipeable gallery with arrows and dots.
 *
 * Opt out on a specific image/container with `data-no-zoom`.
 * Force-enable inside a button/link with `data-zoom`.
 * Group images explicitly with `data-gallery` on a shared ancestor.
 */

const MIN_SIZE = 72;

function isZoomable(img: HTMLImageElement) {
  if (!img.currentSrc && !img.src) return false;
  if (img.closest("[data-no-zoom]")) return false;
  const rect = img.getBoundingClientRect();
  const forced = !!img.closest("[data-zoom]");
  if (!forced && (rect.width < MIN_SIZE || rect.height < MIN_SIZE)) return false;
  return true;
}

function collectGroup(img: HTMLImageElement): string[] {
  let scope: HTMLElement | null = img.closest("[data-gallery]") as HTMLElement | null;
  if (!scope) {
    // Walk up a few levels to find the nearest container holding sibling photos
    let node: HTMLElement | null = img.parentElement;
    let hops = 0;
    while (node && hops < 5) {
      const found = Array.from(node.querySelectorAll("img")).filter((i) =>
        isZoomable(i as HTMLImageElement)
      );
      if (found.length > 1) {
        scope = node;
        break;
      }
      node = node.parentElement;
      hops += 1;
    }
  }
  const source = scope ? Array.from(scope.querySelectorAll("img")) : [img];
  const urls = source
    .filter((i) => isZoomable(i as HTMLImageElement))
    .map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src)
    .filter(Boolean);
  const unique = Array.from(new Set(urls));
  const self = img.currentSrc || img.src;
  return unique.length ? unique : [self];
}

const ImageLightbox = () => {
  const [items, setItems] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [alt, setAlt] = useState("");
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const img = target.closest("img") as HTMLImageElement | null;
      if (!img) return;
      if (!isZoomable(img)) return;

      const forced = !!img.closest("[data-zoom]");
      if (!forced && img.closest("button, a, [role='button'], label")) return;

      e.preventDefault();
      e.stopPropagation();
      const group = collectGroup(img);
      const self = img.currentSrc || img.src;
      setItems(group);
      setIndex(Math.max(0, group.indexOf(self)));
      setAlt(img.alt || "Image");
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!items) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setItems(null);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % items.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + items.length) % items.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [items]);

  if (!items || !items.length) return null;

  const many = items.length > 1;
  const go = (dir: number) => setIndex((i) => (i + dir + items.length) % items.length);

  return (
    <div
      data-no-zoom
      onClick={() => setItems(null)}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 animate-in fade-in"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setItems(null);
        }}
        aria-label="Close image"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
      >
        <X className="h-5 w-5" />
      </button>

      {many && (
        <span className="absolute left-4 top-[max(1.4rem,env(safe-area-inset-top))] z-10 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {index + 1} / {items.length}
        </span>
      )}

      <div
        className="flex h-full w-full touch-pan-y items-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 45 && many) go(dx < 0 ? 1 : -1);
        }}
      >
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {items.map((url, i) => (
            <div key={`${url}-${i}`} className="flex h-full w-full shrink-0 items-center justify-center p-2">
              <img src={url} alt={alt} className="max-h-[92vh] w-full object-contain" />
            </div>
          ))}
        </div>
      </div>

      {many && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next image"
            className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 z-10 flex justify-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                aria-label={`Image ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageLightbox;
