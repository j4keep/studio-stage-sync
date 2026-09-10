import { useCallback, useEffect, useRef, useState } from "react";
import type { BookItem } from "@/lib/books-catalog";

type Props = {
  book: BookItem;
  onClose?: () => void;
};

/**
 * Sideways page-flip reader — swipe left/right (or buttons), not vertical scroll.
 */
export default function BookPageFlipper({ book }: Props) {
  const pages = book.pages.length ? book.pages : [{ text: "This book has no pages yet." }];
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState<"none" | "next" | "prev">("none");
  const touchX = useRef<number | null>(null);
  const busy = useRef(false);

  const go = useCallback(
    (dir: "next" | "prev") => {
      if (busy.current) return;
      if (dir === "next" && index >= pages.length - 1) return;
      if (dir === "prev" && index <= 0) return;
      busy.current = true;
      setFlip(dir);
      window.setTimeout(() => {
        setIndex((i) => (dir === "next" ? i + 1 : i - 1));
        setFlip("none");
        busy.current = false;
      }, 280);
    },
    [index, pages.length],
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

  return (
    <div className="flex flex-1 flex-col">
      <style>{`
        @keyframes flip-out-left {
          from { transform: rotateY(0deg); opacity: 1; }
          to { transform: rotateY(-75deg); opacity: 0.35; }
        }
        @keyframes flip-out-right {
          from { transform: rotateY(0deg); opacity: 1; }
          to { transform: rotateY(75deg); opacity: 0.35; }
        }
        .flip-next { animation: flip-out-left 0.28s ease-in forwards; transform-origin: left center; }
        .flip-prev { animation: flip-out-right 0.28s ease-in forwards; transform-origin: right center; }
      `}</style>

      <div
        className="relative mx-auto w-full max-w-md flex-1 px-4"
        style={{ perspective: "1200px" }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 40) return;
          if (dx < 0) go("next");
          else go("prev");
        }}
      >
        <div
          className={`mt-2 min-h-[58vh] rounded-sm border bg-[var(--books-surface)] p-6 shadow-[0_12px_40px_rgba(15,23,42,0.12)] ${
            flip === "next" ? "flip-next" : flip === "prev" ? "flip-prev" : ""
          }`}
          style={{
            borderColor: "var(--books-line)",
            backgroundImage:
              "linear-gradient(90deg, rgba(15,23,42,0.04) 0%, transparent 12px), linear-gradient(#fffaf3, #fffef9)",
          }}
        >
          <p
            className="text-[15px] leading-7 tracking-[0.01em]"
            style={{
              color: "var(--books-ink)",
              fontFamily: '"Libre Baskerville", "Georgia", serif',
            }}
          >
            {page.text}
          </p>
        </div>

        <p className="mt-3 text-center text-[11px]" style={{ color: "var(--books-muted)" }}>
          Swipe sideways · Page {index + 1} of {pages.length}
        </p>
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-md items-center justify-between gap-3 px-4 pb-2">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => go("prev")}
          className="h-11 flex-1 rounded-full border text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--books-line)", color: "var(--books-ink)", background: "var(--books-surface)" }}
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={index >= pages.length - 1}
          onClick={() => go("next")}
          className="h-11 flex-1 rounded-full text-sm font-semibold disabled:opacity-40"
          style={{ background: "var(--books-accent)", color: "var(--books-accent-ink)" }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
