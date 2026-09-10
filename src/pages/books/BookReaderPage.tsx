import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import BooksShell from "@/components/books/BooksShell";
import BookPageFlipper from "@/components/books/BookPageFlipper";
import { formatBookPrice, getBookById } from "@/lib/books-catalog";

export default function BookReaderPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const book = useMemo(() => getBookById(id), [id]);
  const kids = book?.audience === "kids";

  if (!book) {
    return (
      <BooksShell>
        <div className="px-6 pt-20 text-center">
          <p className="font-bold">Book not found</p>
          <button type="button" className="mt-4 text-sm font-semibold text-blue-600" onClick={() => nav("/books")}>
            Back to Books
          </button>
        </div>
      </BooksShell>
    );
  }

  return (
    <BooksShell variant={kids ? "kids" : "regular"} className="flex flex-col">
      <header
        className="flex items-start gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ borderBottom: "1px solid var(--books-line)" }}
      >
        <button
          type="button"
          onClick={() => nav(kids ? "/books/kids/library" : "/books/library")}
          className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{book.title}</h1>
          <p className="truncate text-[11px]" style={{ color: "var(--books-muted)" }}>
            {book.author} · {formatBookPrice(book)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => nav(kids ? "/books/kids/library" : "/books/library")}
          className="mt-0.5 rounded-full p-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" style={{ color: "var(--books-muted)" }} />
        </button>
      </header>

      <p className="px-4 pt-3 text-xs leading-relaxed" style={{ color: "var(--books-muted)" }}>
        {book.blurb}
      </p>

      <BookPageFlipper book={book} />
    </BooksShell>
  );
}
