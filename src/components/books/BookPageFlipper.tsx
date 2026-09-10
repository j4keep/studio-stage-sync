import { useCallback, useEffect, useRef, useState } from "react";
import type { BookItem } from "@/lib/books-catalog";

type Props = {
  book: BookItem;
  /** adult = full-screen Kindle-style; kids = illustrated / bigger type */
  mode: "adult" | "kids";
  controlsVisible: boolean;
  onToggleControls: () => void;
  index: number;
  onIndexChange: (next: number) => void;
};

/**
 * Sideways page turner.
 * Adult mode: the page IS the screen (paper texture, generous type, slim chrome).
 * Kids mode: chunkier type, playful card frame, less text density.
 */
export default function BookPageFlipper({
  book,
  mode,
  controlsVisible,
  onToggleControls,
  index,
  onIndexChange,
}: Props) {
  const pages = book.pages.length ? book.pages : [{ text: "This book has no pages yet." }];
  const [flip, setFlip] = useState<"none" | "next" | "prev">("none");
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);
  const busy = useRef(false);
  const adult = mode === "adult";

  const go = useCallback(
    (dir: "next" | "prev") => {
      if (busy.current) return;
      if (dir === "next" && index >= pages.length - 1) return;
      if (dir === "prev" && index <= 0) return;
      busy.current = true;
      setFlip(dir);
      window.setTimeout(() => {
        onIndexChange(dir === "next" ? index + 1 : index - 1);
        setFlip("none");
        busy.current = false;
      }, 260);
    },
    [index, onIndexChange, pages.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go("next");
      if (e.key === "ArrowLeft") go("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const page = pages[index];
  const paragraphs = page.text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
    touchY.current = e.touches[0]?.clientY ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const x = e.changedTouches[0]?.clientX ?? 0;
    const y = e.changedTouches[0]?.clientY ?? 0;
    const dx = x - touchX.current;
    const dy = y - (touchY.current ?? y);
    touchX.current = null;
    touchY.current = null;
    // Prefer horizontal swipes; ignore mostly-vertical gestures.
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    if (dx < 0) go("next");
    else go("prev");
  };

  const onPageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    // Left / right thirds turn pages; center toggles chrome.
    if (ratio < 0.28) {
      go("prev");
      return;
    }
    if (ratio > 0.72) {
      go("next");
      return;
    }
    onToggleControls();
  };

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col ${adult ? "" : "px-3 pt-2"}`}>
      <style>{`
        @keyframes flip-out-left {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-18%); opacity: 0.2; }
        }
        @keyframes flip-out-right {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(18%); opacity: 0.2; }
        }
        .flip-next { animation: flip-out-left 0.26s ease-in forwards; }
        .flip-prev { animation: flip-out-right 0.26s ease-in forwards; }
      `}</style>

      <div
        className={`relative min-h-0 flex-1 overflow-hidden ${
          adult ? "" : "rounded-3xl border-4 border-white shadow-lg"
        } ${flip === "next" ? "flip-next" : flip === "prev" ? "flip-prev" : ""}`}
        style={
          adult
            ? {
                backgroundColor: "#F7F1E8",
                backgroundImage:
                  "linear-gradient(90deg, rgba(60,40,20,0.045) 0 1px, transparent 1px), radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.55), transparent 55%), linear-gradient(#F7F1E8, #F3EBDD)",
              }
            : {
                background: `linear-gradient(165deg, ${book.coverFrom}22, #fff8e7 42%, ${book.coverTo}33)`,
              }
        }
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onPageTap}
        role="document"
        aria-label={`${book.title}, page ${index + 1} of ${pages.length}`}
      >
        <div
          className={`mx-auto flex h-full max-w-xl flex-col ${
            adult
              ? "px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-10"
              : "px-4 py-4"
          }`}
        >
          {!adult && (
            <div
              className="mb-3 aspect-[16/9] overflow-hidden rounded-2xl"
              style={{ background: `linear-gradient(145deg, ${book.coverFrom}, ${book.coverTo})` }}
              aria-hidden
            />
          )}

          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${adult ? "pr-1" : ""}`}>
            {paragraphs.map((para, i) => (
              <p
                key={`${index}-${i}`}
                className={adult ? "mb-5 text-[17px] leading-[1.75] tracking-[0.01em] text-[#1C1917]" : "mb-3 text-base font-semibold leading-7 text-stone-800"}
                style={adult ? { fontFamily: '"Literata", "Georgia", "Times New Roman", serif' } : undefined}
              >
                {adult && i === 0 ? (
                  <>
                    <span className="float-left mr-2 mt-1 text-[2.35rem] font-semibold leading-none text-[#1C1917]">
                      {para.charAt(0)}
                    </span>
                    {para.slice(1)}
                  </>
                ) : (
                  para
                )}
              </p>
            ))}
          </div>

          <div
            className={`mt-2 flex items-center justify-between ${controlsVisible ? "opacity-100" : "opacity-70"}`}
          >
            <button
              type="button"
              disabled={index <= 0}
              onClick={(e) => {
                e.stopPropagation();
                go("prev");
              }}
              className={`disabled:opacity-30 ${
                adult
                  ? "rounded-full px-2 py-1 text-[11px] font-medium text-stone-500"
                  : "rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-orange-600"
              }`}
            >
              ← Prev
            </button>
            <p className={`tabular-nums ${adult ? "text-[11px] text-stone-500" : "text-xs font-bold text-orange-700"}`}>
              {index + 1} / {pages.length}
            </p>
            <button
              type="button"
              disabled={index >= pages.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                go("next");
              }}
              className={`disabled:opacity-30 ${
                adult
                  ? "rounded-full px-2 py-1 text-[11px] font-medium text-stone-500"
                  : "rounded-full bg-orange-500 px-3 py-1.5 text-xs font-extrabold text-white"
              }`}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
