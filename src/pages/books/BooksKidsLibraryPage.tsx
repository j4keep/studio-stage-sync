import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import BooksShell from "@/components/books/BooksShell";
import BookCoverCard from "@/components/books/BookCoverCard";
import { kidsBooks } from "@/lib/books-catalog";

export default function BooksKidsLibraryPage() {
  const nav = useNavigate();
  const books = useMemo(() => kidsBooks(), []);

  return (
    <BooksShell variant="kids">
      <header className="sticky top-0 z-10 border-b border-amber-200 bg-[#FFF9F0]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/books/kids")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white border-2 border-amber-200"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4 text-orange-600" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-orange-600">Kids Books</h1>
            <p className="text-[11px] font-semibold" style={{ color: "var(--books-muted)" }}>
              {books.length} fun stories
            </p>
          </div>
          <button
            type="button"
            onClick={() => nav("/books/upload?audience=kids")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white"
            aria-label="Upload"
          >
            <Upload className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-orange-400 to-pink-400 px-4 py-3 text-white shadow-md">
          <p className="text-sm font-extrabold">Tap a cover · swipe pages sideways</p>
          <p className="text-[11px] font-semibold opacity-90">Like turning a real picture book</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {books.map((b) => (
            <BookCoverCard key={b.id} book={b} tone="kids" onClick={() => nav(`/books/read/${b.id}`)} />
          ))}
        </div>
      </div>
    </BooksShell>
  );
}
