import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Upload } from "lucide-react";
import BooksShell from "@/components/books/BooksShell";
import BookCoverCard from "@/components/books/BookCoverCard";
import { REGULAR_CATEGORIES, regularBooks } from "@/lib/books-catalog";

/** Professional regular library — categories + recently added grid. */
export default function BooksLibraryPage() {
  const nav = useNavigate();
  const recent = useMemo(() => regularBooks().slice(0, 9), []);

  return (
    <BooksShell>
      <header
        className="sticky top-0 z-10 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur"
        style={{ background: "rgba(247,248,250,0.92)", borderColor: "var(--books-line)" }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/books")}
            className="flex h-9 w-9 items-center justify-center rounded-full border"
            style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="flex-1 text-lg font-bold tracking-tight">Books</h1>
          <button type="button" onClick={() => nav("/books/upload")} className="rounded-full p-2" aria-label="Upload">
            <Upload className="h-4 w-4" style={{ color: "var(--books-accent)" }} />
          </button>
          <button type="button" className="rounded-full p-2" aria-label="Search categories" onClick={() => nav("/books/library")}>
            <Search className="h-4 w-4" style={{ color: "var(--books-muted)" }} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        <section className="mb-6">
          <h2 className="text-sm font-bold" style={{ color: "var(--books-ink)" }}>
            Categories
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--books-muted)" }}>
            Every book includes Read to me with your YAJ Buddy voice
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {REGULAR_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => nav(`/books/category/${c.id}`)}
                className="shrink-0 rounded-full border px-3.5 py-2 text-left"
                style={{ background: "var(--books-surface)", borderColor: "var(--books-line)" }}
              >
                <span className="block text-xs font-bold">{c.label}</span>
                <span className="block text-[10px]" style={{ color: "var(--books-muted)" }}>
                  {c.hint}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-sm font-bold">Recently added</h2>
            <button
              type="button"
              onClick={() => nav("/books/category/drama")}
              className="text-xs font-semibold"
              style={{ color: "var(--books-accent)" }}
            >
              More →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {recent.map((b) => (
              <BookCoverCard key={b.id} book={b} tone="regular" onClick={() => nav(`/books/read/${b.id}`)} />
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={() => nav("/books/kids")}
          className="mt-8 mb-4 w-full rounded-2xl border px-4 py-3 text-sm font-semibold"
          style={{ borderColor: "var(--books-line)", background: "var(--books-soft)", color: "var(--books-accent)" }}
        >
          Switch to Kids books →
        </button>
      </div>
    </BooksShell>
  );
}
