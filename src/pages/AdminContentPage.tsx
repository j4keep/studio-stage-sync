import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Film, Loader2, Search, Shield, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminDeleteCreatorBook, listAllCreatorBooksForAdmin } from "@/lib/creator-books";
import type { BookItem } from "@/lib/books-catalog";
import { WheuatTv, type WheuatTvItem } from "@/pages/wheuat-tv/wheuatTvStore";

type Tab = "books" | "tv";

export default function AdminContentPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("books");
  const [books, setBooks] = useState<BookItem[]>([]);
  const [tv, setTv] = useState<WheuatTvItem[]>([]);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("Policy violation");
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [bookRows, tvRows] = await Promise.all([listAllCreatorBooksForAdmin(), WheuatTv.list()]);
      setBooks(bookRows);
      setTv(tvRows.filter((item) => !item.isOriginal));
    } catch (e: any) {
      toast.error(e?.message || "Could not load creator content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const q = query.trim().toLowerCase();
  const filteredBooks = useMemo(
    () => !q ? books : books.filter((book) => [book.title, book.author, book.category, book.blurb].join(" ").toLowerCase().includes(q)),
    [books, q],
  );
  const filteredTv = useMemo(
    () => !q ? tv : tv.filter((item) => [item.title, item.creator.displayName, item.category, item.description].filter(Boolean).join(" ").toLowerCase().includes(q)),
    [tv, q],
  );

  const removeBook = async (book: BookItem) => {
    if (!user) return;
    if (!window.confirm(`Remove "${book.title}" from YAJ Books for: ${reason}?`)) return;
    setRemoving(`book:${book.id}`);
    try {
      await adminDeleteCreatorBook(user.id, book, reason);
      setBooks((current) => current.filter((item) => item.id !== book.id));
      toast.success("Book removed and moderation action logged");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove book");
    } finally {
      setRemoving(null);
    }
  };

  const removeTv = async (item: WheuatTvItem) => {
    if (!user) return;
    if (!window.confirm(`Remove "${item.title}" from YAJ.TV for: ${reason}?`)) return;
    setRemoving(`tv:${item.id}`);
    try {
      const { error: logError } = await (supabase as any).from("admin_content_removals").insert({
        admin_user_id: user.id,
        content_type: "tv",
        content_id: item.id,
        creator_user_id: item.creator.id,
        title: item.title,
        reason: reason.trim() || "Policy violation",
      });
      if (logError) throw logError;
      await WheuatTv.remove(item.id, item.videoKey);
      setTv((current) => current.filter((row) => row.id !== item.id));
      toast.success("YAJ.TV title removed and moderation action logged");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove YAJ.TV title");
    } finally {
      setRemoving(null);
    }
  };

  if (isAdmin === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) {
    return (
      <div className="px-4 pt-6">
        <button onClick={() => nav(-1)} className="mb-4"><ArrowLeft className="h-5 w-5" /></button>
        <div className="rounded-2xl border p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">Admin only</p>
        </div>
      </div>
    );
  }

  const items = tab === "books" ? filteredBooks : filteredTv;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button onClick={() => nav("/admin/trust-safety")} className="flex h-9 w-9 items-center justify-center rounded-full border">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Content Moderation</h1>
          <p className="text-xs text-muted-foreground">Operator removal controls for creator Books and YAJ.TV.</p>
        </div>
      </header>

      <div className="mt-5 flex gap-2">
        <button onClick={() => setTab("books")} className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === "books" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <BookOpen className="mr-1.5 inline h-4 w-4" /> Books
        </button>
        <button onClick={() => setTab("tv")} className={`flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === "tv" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <Film className="mr-1.5 inline h-4 w-4" /> YAJ.TV
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search creator content" className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm">
          <option>Policy violation</option>
          <option>Adult/graphic content in Kids</option>
          <option>Pornographic content</option>
          <option>Wrong category</option>
          <option>Copyright complaint</option>
          <option>Spam or deceptive content</option>
          <option>Safety violation</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No matching creator content.</p>
      ) : tab === "books" ? (
        <div className="mt-5 space-y-3">
          {filteredBooks.map((book) => (
            <article key={book.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {book.coverImage ? <img src={book.coverImage} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{book.title}</p>
                <p className="text-xs text-muted-foreground">{book.author} · {book.audience} · {book.category}</p>
                {book.audience === "kids" && <p className="mt-1 text-[10px] font-semibold text-orange-600">Kids catalog content</p>}
              </div>
              <button disabled={removing === `book:${book.id}`} onClick={() => void removeBook(book)} className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-red-600 disabled:opacity-50">
                {removing === `book:${book.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filteredTv.map((item) => (
            <article key={item.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black">
                {item.thumbUrl ? <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.creator.displayName} · {item.category || item.kind}</p>
              </div>
              <button disabled={removing === `tv:${item.id}`} onClick={() => void removeTv(item)} className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-red-600 disabled:opacity-50">
                {removing === `tv:${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
