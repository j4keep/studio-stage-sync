import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ImagePlus, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import BooksShell from "@/components/books/BooksShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  REGULAR_CATEGORIES,
  type BookAudience,
  type BookListingType,
  type BookPage,
  type RegularCategoryId,
} from "@/lib/books-catalog";
import { generateCreatorBookCover, publishCreatorBook } from "@/lib/creator-books";

const COVER_PAIRS: [string, string][] = [
  ["#1e3a8a", "#93c5fd"],
  ["#9f1239", "#fda4af"],
  ["#14532d", "#86efac"],
  ["#7c2d12", "#fbbf24"],
  ["#4c1d95", "#c4b5fd"],
  ["#0e7490", "#a5f3fc"],
];

function splitLongText(text: string, target = 900): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= target) return [clean];

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const pages: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > target && current) {
      pages.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  }
  if (current) pages.push(current);
  return pages;
}

function manuscriptToPages(body: string): BookPage[] {
  const sections = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pageTexts = sections.length
    ? sections.flatMap((section) => splitLongText(section))
    : splitLongText(body);

  return pageTexts.map((text) => ({ text }));
}

export default function BookUploadPage() {
  const nav = useNavigate();
  const { user } = useAuth();
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
  const [coverPrompt, setCoverPrompt] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const kids = audience === "kids";
  const pages = useMemo(() => manuscriptToPages(body), [body]);
  const [fallbackFrom, fallbackTo] = useMemo(
    () => COVER_PAIRS[Math.abs(title.length + body.length) % COVER_PAIRS.length],
    [title.length, body.length],
  );

  useEffect(() => {
    if (!user || author.trim()) return;
    let active = true;
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.display_name) setAuthor(data.display_name);
      });
    return () => {
      active = false;
    };
  }, [user, author]);

  const generateCover = async () => {
    if (!user) {
      toast.error("Sign in to generate a cover");
      return;
    }
    if (!title.trim()) {
      toast.error("Add your book title first");
      return;
    }
    if (!author.trim()) {
      toast.error("Add the author name first");
      return;
    }

    setGeneratingCover(true);
    try {
      const categoryLabel =
        audience === "kids"
          ? "kids"
          : REGULAR_CATEGORIES.find((item) => item.id === category)?.label || category;
      const prompt =
        coverPrompt.trim() ||
        `Original ${categoryLabel} book cover for "${title.trim()}". Use the story description: ${blurb.trim() || body.slice(0, 300) || "cinematic, original YAJ creator story"}.`;

      const generated = await generateCreatorBookCover({
        userId: user.id,
        title: title.trim(),
        author: author.trim(),
        category: categoryLabel,
        prompt,
      });
      setCoverUrl(generated.url);
      setCoverKey(generated.key);
      toast.success("Cover created");
    } catch (error: any) {
      toast.error(error?.message || "Could not generate the cover");
    } finally {
      setGeneratingCover(false);
    }
  };

  const publish = async () => {
    if (!user) {
      toast.error("Sign in to publish a book");
      return;
    }
    if (!title.trim() || !author.trim()) {
      toast.error("Title and author are required");
      return;
    }
    if (!pages.length) {
      toast.error("Write or paste your manuscript first");
      return;
    }
    if (listingType === "sale" && !(Number(price) > 0)) {
      toast.error("Enter a valid sale price");
      return;
    }

    setPublishing(true);
    try {
      const book = await publishCreatorBook(user.id, {
        title: title.trim(),
        author: author.trim(),
        audience,
        category: audience === "kids" ? "kids" : category,
        listingType,
        price: listingType === "sale" ? Number(price) : null,
        blurb: blurb.trim() || "A creator-published book on YAJ.",
        pages,
        coverUrl,
        coverKey,
      });
      toast.success("Your book is live in YAJ Books");
      nav(`/books/read/${book.id}`);
    } catch (error: any) {
      toast.error(error?.message || "Could not publish your book");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <BooksShell variant={kids ? "kids" : "regular"}>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur"
        style={{
          background: kids ? "rgba(255,249,240,0.95)" : "rgba(247,248,250,0.95)",
          borderColor: "var(--books-line)",
        }}
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
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">Create a Book</h1>
          <p className="text-[11px]" style={{ color: "var(--books-muted)" }}>
            Write it here, paste a manuscript, create a cover, then publish.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-5 px-4 pb-10 pt-4">
        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: "var(--books-accent)" }} />
            <h2 className="text-sm font-bold">Book details</h2>
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
                placeholder="Your book title"
              />
            </Field>

            <Field label="Author">
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
                placeholder="Author name"
              />
            </Field>

            <Field label="Audience">
              <div className="flex gap-2">
                {(["regular", "kids"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudience(a)}
                    className="h-10 flex-1 rounded-full text-xs font-bold"
                    style={
                      audience === a
                        ? { background: "var(--books-accent)", color: "var(--books-accent-ink)" }
                        : { background: "var(--books-soft)", color: "var(--books-ink)" }
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

            <Field label="Description">
              <textarea
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
                placeholder="What is your book about?"
              />
            </Field>
          </div>
        </section>

        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Write or paste your manuscript</h2>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--books-muted)" }}>
                YAJ automatically turns your manuscript into readable pages.
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ background: "var(--books-soft)", color: "var(--books-accent)" }}
            >
              {pages.length} {pages.length === 1 ? "page" : "pages"}
            </span>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="mt-3 w-full resize-y rounded-xl border px-3 py-3 text-[15px] leading-relaxed outline-none"
            style={{ borderColor: "var(--books-line)", background: "var(--books-surface)", color: "var(--books-ink)" }}
            placeholder={
              "Start writing here, or paste a manuscript you already wrote.\n\nUse a blank line when you want a natural page or section break."
            }
          />

          {pages.length > 0 && (
            <div className="mt-3 rounded-xl p-3" style={{ background: "var(--books-soft)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--books-muted)" }}>
                Reader preview
              </p>
              <p className="mt-1 line-clamp-4 text-xs leading-relaxed" style={{ color: "var(--books-ink)" }}>
                {pages[0]?.text}
              </p>
            </div>
          )}
        </section>

        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
        >
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4" style={{ color: "var(--books-accent)" }} />
            <div>
              <h2 className="text-sm font-bold">Book cover</h2>
              <p className="text-[11px]" style={{ color: "var(--books-muted)" }}>
                Let YAJ create an original cover from your idea.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-4">
            <div
              className="aspect-[2/3] w-[7.2rem] shrink-0 overflow-hidden rounded-xl shadow-md"
              style={
                coverUrl
                  ? undefined
                  : { background: `linear-gradient(155deg, ${fallbackFrom}, ${fallbackTo})` }
              }
            >
              {coverUrl ? (
                <img src={coverUrl} alt="Generated book cover" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/55 to-transparent p-3 text-white">
                  <p className="text-sm font-bold leading-tight">{title.trim() || "Your Book"}</p>
                  <p className="mt-1 text-[10px] text-white/75">{author.trim() || "Your name"}</p>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <textarea
                value={coverPrompt}
                onChange={(e) => setCoverPrompt(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border px-3 py-2 text-xs leading-relaxed outline-none"
                style={{ borderColor: "var(--books-line)", background: "var(--books-soft)", color: "var(--books-ink)" }}
                placeholder="Optional: describe the cover you imagine. Example: rainy Miami street at night, cinematic, dramatic lighting."
              />
              <button
                type="button"
                disabled={generatingCover}
                onClick={generateCover}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-bold disabled:opacity-60"
                style={{ background: "var(--books-accent)", color: "var(--books-accent-ink)" }}
              >
                {generatingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                {generatingCover ? "Creating cover…" : coverUrl ? "Create another cover" : "Create cover with YAJ AI"}
              </button>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--books-accent)" }} />
            <h2 className="text-sm font-bold">Publishing</h2>
          </div>

          <div className="mt-4">
            <Field label="How readers get it">
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
                        : { background: "var(--books-soft)", color: "var(--books-ink)" }
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            {listingType === "sale" && (
              <div className="mt-4">
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
              </div>
            )}
          </div>
        </section>

        <button
          type="button"
          disabled={publishing || !title.trim() || !author.trim() || !pages.length}
          onClick={publish}
          className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold shadow-sm disabled:opacity-50"
          style={{ background: "var(--books-accent)", color: "var(--books-accent-ink)" }}
        >
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          {publishing ? "Publishing…" : "Publish to YAJ Books"}
        </button>

        <p className="px-3 text-center text-[10px] leading-relaxed" style={{ color: "var(--books-muted)" }}>
          Only publish work you created or have permission to publish. Creator books use the same YAJ reader and Read to me experience as catalog books.
        </p>
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
