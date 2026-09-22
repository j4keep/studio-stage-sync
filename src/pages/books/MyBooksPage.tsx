import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import BooksShell from "@/components/books/BooksShell";
import BookCoverCard from "@/components/books/BookCoverCard";
import { useAuth } from "@/contexts/AuthContext";
import { deleteCreatorBook, listMyCreatorBooks } from "@/lib/creator-books";
import type { BookItem } from "@/lib/books-catalog";

export default function MyBooksPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) {
      setBooks([]);
      setLoading(false);
      return;
    }
    try {
      setBooks(await listMyCreatorBooks(user.id));
    } catch (e: any) {
      toast.error(e?.message || "Could not load your books");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const remove = async (book: BookItem) => {
    if (!user) return;
    if (!window.confirm(`Delete "${book.title}"? This permanently removes it from YAJ Books.`)) return;
    setDeletingId(book.id);
    try {
      await deleteCreatorBook(user.id, book.id);
      setBooks((current) => current.filter((item) => item.id !== book.id));
      toast.success("Book deleted");
    } catch (e: any) {
      toast.error(e?.message || "Could not delete book");
    } finally {
      setDeletingId(null);
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
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">My Books</h1>
          <p className="text-[11px]" style={{ color: "var(--books-muted)" }}>
            Manage the books you created and published.
          </p>
        </div>
        <button
          type="button"
          onClick={() => nav("/books/create")}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--books-accent)", color: "var(--books-accent-ink)" }}
          aria-label="Create a Book"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <div className="mx-auto max-w-lg px-4 pb-10 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-2xl border px-5 py-12 text-center" style={{ borderColor: "var(--books-line)" }}>
            <BookOpen className="mx-auto h-8 w-8" style={{ color: "var(--books-muted)" }} />
            <p className="mt-3 text-sm font-bold">No creator books yet</p>
            <p className="mt-1 text-xs" style={{ color: "var(--books-muted)" }}>
              Create your first book and it will live here.
            </p>
            <button
              type="button"
              onClick={() => nav("/books/create")}
              className="mt-4 rounded-full px-4 py-2 text-xs font-bold"
              style={{ background: "var(--books-accent)", color: "var(--books-accent-ink)" }}
            >
              Create a Book
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {books.map((book) => (
              <article
                key={book.id}
                className="rounded-2xl border p-3"
                style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
              >
                <div className="flex gap-3">
                  <div className="w-24 shrink-0">
                    <BookCoverCard book={book} tone={book.audience === "kids" ? "kids" : "regular"} onClick={() => nav(`/books/read/${book.id}`)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold">{book.title}</h2>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--books-muted)" }}>
                      {book.audience === "kids" ? "Kids" : String(book.category)} · {book.pages.length} pages
                    </p>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed" style={{ color: "var(--books-muted)" }}>
                      {book.blurb}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => nav(`/books/edit/${book.id}`)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-bold"
                        style={{ background: "var(--books-soft)", color: "var(--books-accent)" }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === book.id}
                        onClick={() => void remove(book)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-bold text-red-600 disabled:opacity-50"
                        style={{ borderColor: "var(--books-line)" }}
                      >
                        {deletingId === book.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </BooksShell>
  );
}
