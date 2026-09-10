import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BooksShell from "@/components/books/BooksShell";
import BookCoverCard from "@/components/books/BookCoverCard";
import {
  REGULAR_CATEGORIES,
  booksForCategory,
  type RegularCategoryId,
} from "@/lib/books-catalog";

export default function BooksCategoryPage() {
  const { slug = "drama" } = useParams();
  const nav = useNavigate();
  const meta = REGULAR_CATEGORIES.find((c) => c.id === slug);
  const books = useMemo(
    () => booksForCategory((meta?.id ?? "drama") as RegularCategoryId),
    [meta?.id],
  );

  return (
    <BooksShell>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ background: "rgba(247,248,250,0.95)", borderColor: "var(--books-line)" }}
      >
        <button
          type="button"
          onClick={() => nav("/books/library")}
          className="flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{meta?.label ?? "Books"}</h1>
          <p className="text-[11px]" style={{ color: "var(--books-muted)" }}>
            {meta?.hint ?? ""} · {books.length} titles · YAJ Read to me
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-lg grid-cols-3 gap-3 px-4 pt-4">
        {books.map((b) => (
          <BookCoverCard key={b.id} book={b} onClick={() => nav(`/books/read/${b.id}`)} />
        ))}
      </div>
    </BooksShell>
  );
}
