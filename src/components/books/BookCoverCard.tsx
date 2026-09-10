import type { BookItem } from "@/lib/books-catalog";
import { formatBookPrice } from "@/lib/books-catalog";

type Props = {
  book: BookItem;
  onClick?: () => void;
  /** kids = chunkier, playful frame */
  tone?: "regular" | "kids";
};

export default function BookCoverCard({ book, onClick, tone = "regular" }: Props) {
  const kids = tone === "kids";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition active:scale-[0.98]"
      aria-label={`Open ${book.title} by ${book.author}`}
    >
      <div
        className={`relative overflow-hidden shadow-sm ${
          kids ? "rounded-2xl border-4 border-white aspect-[3/4]" : "rounded-md border border-black/5 aspect-[2/3]"
        }`}
        style={{
          background: `linear-gradient(160deg, ${book.coverFrom}, ${book.coverTo})`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.35),transparent_42%)]" />
        <div className="absolute inset-x-0 bottom-0 p-2.5 pt-8 bg-gradient-to-t from-black/55 to-transparent">
          <p className={`font-bold text-white leading-tight line-clamp-2 ${kids ? "text-sm" : "text-xs"}`}>
            {book.title}
          </p>
        </div>
        {kids && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-extrabold text-orange-600">
            Kids
          </span>
        )}
      </div>
      <p className={`mt-1.5 font-bold leading-snug line-clamp-2 ${kids ? "text-sm" : "text-[13px]"}`} style={{ color: "var(--books-ink)" }}>
        {book.title}
      </p>
      <p className="text-[11px] line-clamp-1" style={{ color: "var(--books-muted)" }}>
        {book.author}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold" style={{ color: "var(--books-accent)" }}>
        {formatBookPrice(book)}
      </p>
    </button>
  );
}
