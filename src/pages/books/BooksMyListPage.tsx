import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import BooksShell from "@/components/books/BooksShell";
import BookCoverCard from "@/components/books/BookCoverCard";
import { useAuth } from "@/contexts/AuthContext";
import { allBooks, type BookItem } from "@/lib/books-catalog";
import { listBookLibraryEntries, listPublishedCreatorBooks, removeSavedBookFromLibrary } from "@/lib/creator-books";

type LibraryBook = { book: BookItem; acquisition: "saved" | "purchased" };

export default function BooksMyListPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);

  const seedBooks = useMemo(() => allBooks(), []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) {
        if (active) {
          setItems([]);
          setLoading(false);
        }
        return;
      }
      try {
        const [entries, creatorBooks] = await Promise.all([
          listBookLibraryEntries(user.id),
          listPublishedCreatorBooks(),
        ]);
        const byId = new Map([...creatorBooks, ...seedBooks].map((book) => [book.id, book]));
        const next = entries
          .map((entry) => {
            const book = byId.get(entry.bookId);
            return book ? { book, acquisition: entry.acquisition } : null;
          })
          .filter((item): item is LibraryBook => Boolean(item));
        if (active) setItems(next);
      } catch (e: any) {
        toast.error(e?.message || "Could not load My List");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id, seedBooks]);

  const removeSaved = async (bookId: string) => {
    if (!user) return;
    try {
      await removeSavedBookFromLibrary(user.id, bookId);
      setItems((current) => current.filter((item) => item.book.id !== bookId || item.acquisition === "purchased"));
      toast.success("Removed from My List");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove book");
    }
  };

  return (
    <BooksShell>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur"
        style={{ background: "rgba(247,248,250,0.95)", borderColor: "var(--books-line)" }}
      >
        <button
          type="button"
          onClick={() => nav("/books")}
          className="flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold">My List</h1>
          <p className="text-[11px]" style={{ color: "var(--books-muted)" }}>
            Saved books and books you own.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pb-10 pt-4">
        {!user ? (
          <p className="py-16 text-center text-sm" style={{ color: "var(--books-muted)" }}>
            Sign in to keep a Books My List.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <Bookmark className="mx-auto h-7 w-7" style={{ color: "var(--books-muted)" }} />
            <p className="mt-3 text-sm font-bold">Your list is empty</p>
            <p className="mt-1 text-xs" style={{ color: "var(--books-muted)" }}>
              Save a book from its reader and it will show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {items.map(({ book, acquisition }) => (
              <div key={book.id} className="min-w-0">
                <BookCoverCard book={book} tone={book.audience === "kids" ? "kids" : "regular"} onClick={() => nav(`/books/read/${book.id}`)} />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="rounded-full px-2 py-1 text-[9px] font-bold" style={{ background: "var(--books-soft)", color: "var(--books-accent)" }}>
                    {acquisition === "purchased" ? "Owned" : "Saved"}
                  </span>
                  {acquisition === "saved" && (
                    <button
                      type="button"
                      onClick={() => void removeSaved(book.id)}
                      className="text-[10px] font-semibold"
                      style={{ color: "var(--books-muted)" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BooksShell>
  );
}
