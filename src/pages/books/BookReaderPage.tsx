import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BooksShell from "@/components/books/BooksShell";
import BookPageFlipper from "@/components/books/BookPageFlipper";
import { formatBookPrice, getBookById } from "@/lib/books-catalog";

export default function BookReaderPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const book = useMemo(() => getBookById(id), [id]);
  const kids = book?.audience === "kids";
  const [showCover, setShowCover] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setShowCover(true);
    setPageIndex(0);
    setControlsVisible(true);
  }, [id]);

  // Hide bottom nav scroll locks aren't needed; keep reader immersive.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

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

  const backTo = kids ? "/books/kids/library" : "/books/library";
  const chapter = book.pages[pageIndex]?.chapter;

  if (showCover) {
    return (
      <BooksShell variant={kids ? "kids" : "regular"} className="!pb-0">
        <div className="flex h-[100dvh] flex-col" style={{ background: kids ? undefined : "#0B1220" }}>
          <div className="flex items-center gap-2 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => nav(backTo)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <p className="truncate text-sm font-semibold text-white/80">{book.title}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowCover(false)}
            className="mx-auto mt-4 flex w-full max-w-sm flex-1 flex-col items-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2"
            aria-label={`Open ${book.title}`}
          >
            <div
              className={`w-full max-h-[52dvh] overflow-hidden shadow-2xl ${kids ? "rounded-3xl border-4 border-white aspect-[3/4]" : "rounded-sm aspect-[2/3]"}`}
              style={
                book.coverImage
                  ? undefined
                  : { background: `linear-gradient(160deg, ${book.coverFrom}, ${book.coverTo})` }
              }
            >
              {book.coverImage ? (
                <img src={book.coverImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/55 to-transparent p-5">
                  <p className="text-2xl font-bold text-white">{book.title}</p>
                  <p className="mt-1 text-sm text-white/80">{book.author}</p>
                </div>
              )}
            </div>
            <p className={`mt-4 text-center text-sm ${kids ? "font-extrabold text-orange-100" : "text-stone-300"}`}>
              {book.blurb}
            </p>
            <p className={`mt-2 text-xs ${kids ? "font-bold text-orange-200" : "text-stone-500"}`}>
              {formatBookPrice(book)} · {book.pages.length} pages
            </p>
            <span
              className={`mt-auto inline-flex h-12 w-full max-w-xs items-center justify-center rounded-full px-8 text-sm font-bold ${
                kids ? "bg-orange-500 text-white" : "bg-white text-stone-900"
              }`}
            >
              {kids ? "Start story →" : "Begin reading →"}
            </span>
          </button>
        </div>
      </BooksShell>
    );
  }

  return (
    <BooksShell variant={kids ? "kids" : "regular"} className={`flex !pb-0 ${kids ? "" : "!bg-[#F7F1E8]"}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600&display=swap');
      `}</style>
      <div className="flex h-[100dvh] flex-col">
        <header
          className={`z-10 flex items-center gap-2 px-3 transition-all duration-200 ${
            controlsVisible
              ? "pt-[max(0.55rem,env(safe-area-inset-top))] opacity-100"
              : "pointer-events-none h-0 overflow-hidden pt-0 opacity-0"
          }`}
          style={
            kids
              ? { background: "rgba(255,249,240,0.96)", borderBottom: "1px solid var(--books-line)" }
              : {
                  background: "rgba(247,241,232,0.94)",
                  borderBottom: "1px solid rgba(120,100,70,0.12)",
                }
          }
        >
          <button
            type="button"
            onClick={() => nav(backTo)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: kids ? "#fff" : "rgba(0,0,0,0.05)" }}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 py-1.5">
            <h1 className="truncate text-[13px] font-semibold tracking-tight" style={{ color: "var(--books-ink)" }}>
              {book.title}
            </h1>
            {chapter ? (
              <p className="truncate text-[10px]" style={{ color: "var(--books-muted)" }}>
                {chapter}
              </p>
            ) : (
              <p className="truncate text-[10px]" style={{ color: "var(--books-muted)" }}>
                {book.author}
              </p>
            )}
          </div>
        </header>

        <BookPageFlipper
          book={book}
          mode={kids ? "kids" : "adult"}
          controlsVisible={controlsVisible}
          onToggleControls={() => setControlsVisible((v) => !v)}
          index={pageIndex}
          onIndexChange={setPageIndex}
        />
      </div>
    </BooksShell>
  );
}
