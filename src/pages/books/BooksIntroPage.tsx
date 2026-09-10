import { useNavigate } from "react-router-dom";
import { BookOpen, Baby, Upload } from "lucide-react";
import BooksShell from "@/components/books/BooksShell";
import { markBooksIntroSeen } from "@/lib/books-catalog";

/** First-entry intro: Regular vs Kids. */
export default function BooksIntroPage() {
  const nav = useNavigate();

  const enter = (path: string) => {
    markBooksIntroSeen();
    nav(path);
  };

  return (
    <BooksShell>
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => nav("/explore")}
          className="self-start text-sm font-semibold"
          style={{ color: "var(--books-muted)" }}
        >
          ← Explore
        </button>

        <div className="mt-8 flex flex-1 flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--books-accent)" }}>
            YAJ Books
          </p>
          <h1
            className="mt-2 text-3xl font-bold leading-tight"
            style={{ fontFamily: '"Libre Baskerville", Georgia, serif', color: "var(--books-ink)" }}
          >
            Your library for quiet pages
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--books-muted)" }}>
            Browse original stories, flip pages sideways like a real book, and upload your own digital titles for sale,
            donation, or free.
          </p>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => enter("/books/library")}
              className="flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left shadow-sm transition active:scale-[0.99]"
              style={{ background: "var(--books-surface)", borderColor: "var(--books-line)" }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "var(--books-soft)", color: "var(--books-accent)" }}
              >
                <BookOpen className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">Regular books</span>
                <span className="block text-xs" style={{ color: "var(--books-muted)" }}>
                  Drama, sci-fi, romance, mystery, fantasy
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => enter("/books/kids")}
              className="flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left shadow-sm transition active:scale-[0.99]"
              style={{ background: "var(--books-surface)", borderColor: "var(--books-line)" }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-500">
                <Baby className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">Kids books</span>
                <span className="block text-xs" style={{ color: "var(--books-muted)" }}>
                  Bright covers, short stories, playful reading
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => enter("/books/upload")}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition active:scale-[0.99]"
              style={{ background: "var(--books-accent)", color: "var(--books-accent-ink)" }}
            >
              <Upload className="h-5 w-5" />
              <span className="text-sm font-bold">Upload a digital book</span>
            </button>
          </div>
        </div>
      </div>
    </BooksShell>
  );
}
