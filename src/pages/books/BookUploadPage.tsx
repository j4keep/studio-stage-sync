import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import BooksShell from "@/components/books/BooksShell";
import {
  REGULAR_CATEGORIES,
  saveUserBook,
  type BookAudience,
  type BookListingType,
  type BookItem,
  type RegularCategoryId,
} from "@/lib/books-catalog";

const COVER_PAIRS: [string, string][] = [
  ["#1e3a8a", "#93c5fd"],
  ["#9f1239", "#fda4af"],
  ["#14532d", "#86efac"],
  ["#7c2d12", "#fbbf24"],
  ["#4c1d95", "#c4b5fd"],
  ["#0e7490", "#a5f3fc"],
];

export default function BookUploadPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialAudience = (params.get("audience") === "kids" ? "kids" : "regular") as BookAudience;

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [audience, setAudience] = useState<BookAudience>(initialAudience);
  const [category, setCategory] = useState<RegularCategoryId>("drama");
  const [listingType, setListingType] = useState<BookListingType>("free");
  const [price, setPrice] = useState("4.99");
  const [blurb, setBlurb] = useState("");
  const [body, setBody] = useState("");

  const kids = audience === "kids";

  const pageChunks = useMemo(() => {
    const raw = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (raw.length) return raw;
    if (body.trim()) {
      // Split long single block into ~280 char pages
      const chunks: string[] = [];
      let rest = body.trim();
      while (rest.length) {
        chunks.push(rest.slice(0, 280));
        rest = rest.slice(280).trim();
      }
      return chunks;
    }
    return [];
  }, [body]);

  const publish = () => {
    if (!title.trim() || !author.trim()) {
      toast.error("Title and author are required");
      return;
    }
    if (!pageChunks.length) {
      toast.error("Add some story text (separate pages with a blank line)");
      return;
    }
    if (listingType === "sale" && !(Number(price) > 0)) {
      toast.error("Enter a valid sale price");
      return;
    }
    const [from, to] = COVER_PAIRS[Math.floor(Math.random() * COVER_PAIRS.length)];
    const book: BookItem = {
      id: `user-${Date.now().toString(36)}`,
      title: title.trim(),
      author: author.trim(),
      audience,
      category: audience === "kids" ? "kids" : category,
      listingType,
      price: listingType === "sale" ? Number(price) : null,
      coverFrom: from,
      coverTo: to,
      blurb: blurb.trim() || "A reader-uploaded digital book on YAJ.",
      pages: pageChunks.map((text) => ({ text })),
      userUploaded: true,
    };
    saveUserBook(book);
    toast.success("Book published to your library");
    nav(audience === "kids" ? "/books/kids/library" : `/books/category/${book.category}`);
  };

  return (
    <BooksShell variant={kids ? "kids" : "regular"}>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ background: kids ? "rgba(255,249,240,0.95)" : "rgba(247,248,250,0.95)", borderColor: "var(--books-line)" }}
      >
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold">Upload digital book</h1>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <p className="text-xs leading-relaxed" style={{ color: "var(--books-muted)" }}>
          Publish to Regular or Kids. List as <strong>sale</strong>, <strong>donation</strong>, or <strong>free</strong>.
          Separate pages with a blank line.
        </p>

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
            placeholder="Book title"
          />
        </Field>
        <Field label="Author">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
            placeholder="Your name"
          />
        </Field>

        <Field label="Section">
          <div className="flex gap-2">
            {(["regular", "kids"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className="h-10 flex-1 rounded-full text-xs font-bold capitalize"
                style={
                  audience === a
                    ? { background: "var(--books-accent)", color: "var(--books-accent-ink)" }
                    : { background: "var(--books-surface)", border: "1px solid var(--books-line)", color: "var(--books-ink)" }
                }
              >
                {a === "regular" ? "Regular" : "Kids"}
              </button>
            ))}
          </div>
        </Field>

        {audience === "regular" && (
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RegularCategoryId)}
              className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
              style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
            >
              {REGULAR_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Listing">
          <div className="flex gap-2">
            {(["free", "donation", "sale"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setListingType(t)}
                className="h-10 flex-1 rounded-full text-xs font-bold capitalize"
                style={
                  listingType === t
                    ? { background: "var(--books-accent)", color: "var(--books-accent-ink)" }
                    : { background: "var(--books-surface)", border: "1px solid var(--books-line)" }
                }
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        {listingType === "sale" && (
          <Field label="Price (USD)">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
              style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
              placeholder="4.99"
            />
          </Field>
        )}

        <Field label="Short blurb">
          <input
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
            style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
            placeholder="One-line description"
          />
        </Field>

        <Field label={`Story text (${pageChunks.length || 0} pages)`}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full resize-y rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
            placeholder={"Page one goes here.\n\nPage two starts after a blank line.\n\nKeep swiping sideways when reading."}
          />
        </Field>

        <button
          type="button"
          onClick={publish}
          className="h-12 w-full rounded-full text-sm font-bold"
          style={{ background: "var(--books-accent)", color: "var(--books-accent-ink)" }}
        >
          Publish book
        </button>
      </div>
    </BooksShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--books-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
