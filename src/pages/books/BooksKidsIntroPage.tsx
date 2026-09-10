import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BooksShell from "@/components/books/BooksShell";
import SmilingAppleMascot from "@/components/books/SmilingAppleMascot";
import { markKidsIntroSeen } from "@/lib/books-catalog";

/** Fun kids gate with animated smiling apple + book. */
export default function BooksKidsIntroPage() {
  const nav = useNavigate();

  return (
    <BooksShell variant="kids">
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => nav("/books")}
          className="flex items-center gap-1 self-start text-sm font-bold text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" /> Books home
        </button>

        <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
          <SmilingAppleMascot />
          <h1 className="mt-4 text-3xl font-extrabold text-orange-600">Kids Story Time!</h1>
          <p className="mt-2 max-w-xs text-sm font-semibold leading-relaxed" style={{ color: "var(--books-muted)" }}>
            Bright covers, short pages, and sideways page flips — made for little readers (and grown-ups who giggle).
          </p>

          <button
            type="button"
            onClick={() => {
              markKidsIntroSeen();
              nav("/books/kids/library");
            }}
            className="mt-8 h-14 w-full max-w-xs rounded-full bg-orange-500 text-base font-extrabold text-white shadow-lg shadow-orange-200 transition active:scale-[0.98]"
          >
            Let’s read! →
          </button>

          <button
            type="button"
            onClick={() => nav("/books/upload?audience=kids")}
            className="mt-3 text-sm font-bold text-orange-600 underline-offset-2 hover:underline"
          >
            Upload a kids book
          </button>
        </div>
      </div>
    </BooksShell>
  );
}
