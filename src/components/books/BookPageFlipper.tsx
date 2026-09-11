import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { BookItem } from "@/lib/books-catalog";
import { splitBookSentences, type NarrationHighlight } from "@/lib/books/book-narration";

export type BookPageFlipperHandle = {
  next: () => void;
  prev: () => void;
};

type Props = {
  book: BookItem;
  /** adult = full-screen Kindle-style; kids = illustrated / bigger type */
  mode: "adult" | "kids";
  controlsVisible: boolean;
  onToggleControls: () => void;
  index: number;
  onIndexChange: (next: number) => void;
  /** Extra bottom space for the Read-to-me bar */
  bottomReserve?: boolean;
  /** Soft highlight while YAJ is reading */
  highlight?: NarrationHighlight | null;
};

/**
 * Sideways page turner.
 * Adult mode: the page IS the screen (paper texture, generous type, slim chrome).
 * Kids mode: big illustration on top + short text underneath (picture-book layout).
 */
const BookPageFlipper = forwardRef<BookPageFlipperHandle, Props>(function BookPageFlipper(
  {
    book,
    mode,
    controlsVisible,
    onToggleControls,
    index,
    onIndexChange,
    bottomReserve = false,
    highlight = null,
  },
  ref,
) {
  const pages = book.pages.length ? book.pages : [{ text: "This book has no pages yet." }];
  const [flip, setFlip] = useState<"none" | "next" | "prev">("none");
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);
  const busy = useRef(false);
  const adult = mode === "adult";
  const highlightRef = useRef<HTMLSpanElement | null>(null);

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

  useImperativeHandle(ref, () => ({
    next: () => go("next"),
    prev: () => go("prev"),
  }), [go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go("next");
      if (e.key === "ArrowLeft") go("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    if (!highlight) return;
    highlightRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight?.paragraphIndex, highlight?.sentenceIndex, index]);

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
        .books-page-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .books-page-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        @media (hover: hover) {
          .books-page-scroll:hover {
            scrollbar-width: thin;
            scrollbar-color: rgba(120, 100, 70, 0.22) transparent;
          }
          .books-page-scroll:hover::-webkit-scrollbar {
            width: 3px;
            display: block;
          }
          .books-page-scroll:hover::-webkit-scrollbar-thumb {
            background: rgba(120, 90, 40, 0.22);
            border-radius: 999px;
          }
        }
        .kids-illust-frame {
          border-radius: 1.75rem;
          clip-path: ellipse(98% 96% at 50% 50%);
        }
      `}</style>

      <div
        className={`relative min-h-0 flex-1 overflow-hidden ${
          adult ? "" : "rounded-[1.75rem] border-[5px] border-white shadow-lg"
        } ${flip === "next" ? "flip-next" : flip === "prev" ? "flip-prev" : ""}`}
        style={
          adult
            ? {
                backgroundColor: "#F7F1E8",
                backgroundImage:
                  "linear-gradient(90deg, rgba(60,40,20,0.045) 0 1px, transparent 1px), radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.55), transparent 55%), linear-gradient(#F7F1E8, #F3EBDD)",
              }
            : {
                background: "#FFFDF8",
              }
        }
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onPageTap}
        role="document"
        aria-label={`${book.title}, page ${index + 1} of ${pages.length}`}
      >
        {adult ? (
          <div
            className="mx-auto flex h-full max-w-xl flex-col px-6 pr-8 pt-3 sm:px-10 sm:pr-12"
            style={{
              paddingBottom: bottomReserve
                ? "max(5.25rem, calc(env(safe-area-inset-bottom) + 4.25rem))"
                : "max(1.25rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="books-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
              {paragraphs.map((para, i) => {
                const sentences = splitBookSentences(para);
                const paraActive = highlight?.paragraphIndex === i;
                return (
                  <p
                    key={`${index}-${i}`}
                    className="mb-5 text-[17px] leading-[1.75] tracking-[0.01em] text-[#1C1917]"
                    style={{ fontFamily: '"Literata", "Georgia", "Times New Roman", serif' }}
                  >
                    {sentences.map((sentence, si) => {
                      const isActive = paraActive && highlight?.sentenceIndex === si;
                      const showDrop = i === 0 && si === 0 && sentence.length > 0;
                      return (
                        <span
                          key={`${index}-${i}-${si}`}
                          ref={isActive ? highlightRef : undefined}
                          className={
                            isActive
                              ? "rounded-[3px] bg-[#E8D9A8]/70 shadow-[inset_0_-1px_0_rgba(120,90,40,0.12)] transition-colors duration-300"
                              : "transition-colors duration-300"
                          }
                        >
                          {showDrop ? (
                            <>
                              <span className="float-left mr-2 mt-1 text-[2.35rem] font-semibold leading-none text-[#1C1917]">
                                {sentence.charAt(0)}
                              </span>
                              {sentence.slice(1)}
                            </>
                          ) : (
                            sentence
                          )}
                          {si < sentences.length - 1 ? " " : null}
                        </span>
                      );
                    })}
                  </p>
                );
              })}
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
                className="rounded-full px-2 py-1 text-[11px] font-medium text-stone-500 disabled:opacity-30"
              >
                ← Prev
              </button>
              <p className="tabular-nums text-[11px] text-stone-500">
                {index + 1} / {pages.length}
              </p>
              <button
                type="button"
                disabled={index >= pages.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  go("next");
                }}
                className="rounded-full px-2 py-1 text-[11px] font-medium text-stone-500 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div
            className="mx-auto flex h-full max-w-xl flex-col px-3 pb-3 pt-3"
            style={{
              paddingBottom: bottomReserve
                ? "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))"
                : undefined,
            }}
          >
            {/* Big picture-book illustration — ~60% of the page */}
            <div className="relative min-h-0 flex-[1.35]">
              <div
                className="kids-illust-frame absolute inset-0 overflow-hidden border-[3px] border-orange-100 shadow-sm"
                style={
                  page.image
                    ? undefined
                    : {
                        background: `linear-gradient(145deg, ${book.coverFrom}, ${book.coverTo})`,
                      }
                }
              >
                {page.image ? (
                  <img
                    src={page.image}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-6 text-center">
                    <p className="text-2xl font-extrabold leading-snug text-white/90 drop-shadow">
                      {book.title}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Short kid text underneath */}
            <div className="mt-3 flex min-h-[5.5rem] flex-col justify-center px-1">
              <div className="books-page-scroll max-h-[9.5rem] overflow-y-auto overscroll-contain text-center">
                {paragraphs.map((para, i) => {
                  const sentences = splitBookSentences(para);
                  const paraActive = highlight?.paragraphIndex === i;
                  return (
                    <p
                      key={`${index}-${i}`}
                      className="mb-1 text-[17px] font-extrabold leading-snug text-stone-800"
                      style={{ fontFamily: '"Nunito", "Trebuchet MS", "Segoe UI", sans-serif' }}
                    >
                      {sentences.map((sentence, si) => {
                        const isActive = paraActive && highlight?.sentenceIndex === si;
                        return (
                          <span
                            key={`${index}-${i}-${si}`}
                            ref={isActive ? highlightRef : undefined}
                            className={
                              isActive
                                ? "rounded-md bg-orange-200/80 px-0.5 transition-colors duration-300"
                                : "transition-colors duration-300"
                            }
                          >
                            {sentence}
                            {si < sentences.length - 1 ? " " : null}
                          </span>
                        );
                      })}
                    </p>
                  );
                })}
              </div>
            </div>

            <div
              className={`mt-2 flex items-center justify-between ${controlsVisible ? "opacity-100" : "opacity-90"}`}
            >
              <button
                type="button"
                disabled={index <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  go("prev");
                }}
                className="rounded-full bg-white px-3.5 py-2 text-xs font-extrabold text-orange-600 shadow-sm ring-1 ring-orange-100 disabled:opacity-30"
              >
                ← Prev
              </button>
              <p className="tabular-nums text-xs font-extrabold text-orange-700">
                {index + 1} / {pages.length}
              </p>
              <button
                type="button"
                disabled={index >= pages.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  go("next");
                }}
                className="rounded-full bg-orange-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default BookPageFlipper;
