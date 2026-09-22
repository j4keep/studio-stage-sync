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
import { paginateBookManuscript } from "@/lib/book-pagination";
import {
  generateCreatorBookCover,
  generateCreatorKidsPageIllustration,
  publishCreatorBook,
} from "@/lib/creator-books";

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
  const [artDirection, setArtDirection] = useState("");
  const [illustratedPages, setIllustratedPages] = useState<BookPage[]>([]);
  const [generatingIllustrations, setGeneratingIllustrations] = useState(false);
  const [generatingPageIndex, setGeneratingPageIndex] = useState<number | null>(null);
  const [illustrationProgress, setIllustrationProgress] = useState({ done: 0, total: 0 });

  const kids = audience === "kids";
  const basePages = useMemo(() => paginateBookManuscript(body, audience), [body, audience]);
  const pages = kids ? illustratedPages : basePages;
  const illustratedCount = kids ? illustratedPages.filter((page) => Boolean(page.image)).length : 0;
  const allKidsPagesIllustrated = !kids || (illustratedPages.length > 0 && illustratedCount === illustratedPages.length);
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

  useEffect(() => {
    if (!kids) {
      setIllustratedPages([]);
      return;
    }
    setIllustratedPages((previous) =>
      basePages.map((page, index) => {
        const existing = previous[index];
        return existing?.text === page.text
          ? { ...page, image: existing.image, imageKey: existing.imageKey, imagePrompt: existing.imagePrompt }
          : page;
      }),
    );
  }, [basePages, kids]);

  const defaultArtDirection = () => {
    const storyHint = (blurb.trim() || body.slice(0, 500)).trim();
    return [
      "Warm, expressive children's picture-book illustration.",
      "Keep the same recurring characters, facial features, skin tones, hair, clothing, proportions, and color palette on every page.",
      "Friendly cinematic composition, colorful but not overly busy, suitable for children.",
      storyHint ? `Story world and character context: ${storyHint}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

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

  const generatePageIllustration = async (pageIndex: number) => {
    if (!user) {
      toast.error("Sign in to create illustrations");
      return;
    }
    if (!kids) return;
    if (!title.trim() || !author.trim()) {
      toast.error("Add the title and author first");
      return;
    }
    const page = illustratedPages[pageIndex];
    if (!page?.text) return;

    setGeneratingPageIndex(pageIndex);
    try {
      const direction = artDirection.trim() || defaultArtDirection();
      const generated = await generateCreatorKidsPageIllustration({
        userId: user.id,
        title: title.trim(),
        author: author.trim(),
        pageText: page.text,
        pageNumber: pageIndex + 1,
        totalPages: illustratedPages.length,
        artDirection: direction,
        previousImageKey: page.imageKey || null,
      });
      setIllustratedPages((current) =>
        current.map((item, index) =>
          index === pageIndex
            ? { ...item, image: generated.url, imageKey: generated.key || undefined, imagePrompt: generated.prompt }
            : item,
        ),
      );
      toast.success(`Page ${pageIndex + 1} illustration created`);
    } catch (error: any) {
      toast.error(error?.message || `Could not create page ${pageIndex + 1}`);
    } finally {
      setGeneratingPageIndex(null);
    }
  };

  const generateAllIllustrations = async () => {
    if (!user) {
      toast.error("Sign in to create illustrations");
      return;
    }
    if (!kids || !illustratedPages.length) {
      toast.error("Add your kids story first");
      return;
    }
    if (!title.trim() || !author.trim()) {
      toast.error("Add the title and author first");
      return;
    }

    const missingIndexes = illustratedPages
      .map((page, index) => (page.image ? -1 : index))
      .filter((index) => index >= 0);

    if (!missingIndexes.length) {
      toast.success("Every page already has an illustration");
      return;
    }

    setGeneratingIllustrations(true);
    setIllustrationProgress({ done: 0, total: missingIndexes.length });
    const direction = artDirection.trim() || defaultArtDirection();

    try {
      let working = [...illustratedPages];
      let failed = 0;
      for (let step = 0; step < missingIndexes.length; step += 1) {
        const index = missingIndexes[step];
        setGeneratingPageIndex(index);
        const page = working[index];
        try {
          const generated = await generateCreatorKidsPageIllustration({
            userId: user.id,
            title: title.trim(),
            author: author.trim(),
            pageText: page.text,
            pageNumber: index + 1,
            totalPages: working.length,
            artDirection: direction,
            previousImageKey: page.imageKey || null,
          });
          working[index] = {
            ...page,
            image: generated.url,
            imageKey: generated.key || undefined,
            imagePrompt: generated.prompt,
          };
          setIllustratedPages([...working]);
        } catch (error: any) {
          failed += 1;
          toast.error(error?.message || `Page ${index + 1} could not be illustrated`);
        }
        setIllustrationProgress({ done: step + 1, total: missingIndexes.length });
      }
      if (failed > 0) {
        toast.warning(`${failed} page${failed === 1 ? "" : "s"} still need an illustration. You can retry them individually.`);
      } else {
        toast.success("Kids book illustrations are ready");
      }
    } finally {
      setGeneratingPageIndex(null);
      setGeneratingIllustrations(false);
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
    if (kids && !allKidsPagesIllustrated) {
      toast.error("Create an illustration for every Kids page before publishing");
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
                YAJ automatically groups your manuscript into full reading pages.
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
              "Start writing here, or paste a manuscript you already wrote.\n\nBlank lines create paragraph breaks — YAJ will combine them into full reading pages automatically."
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

        {kids && (
          <section
            className="rounded-2xl border p-4"
            style={{ borderColor: "var(--books-line)", background: "var(--books-surface)" }}
          >
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold">Kids page illustrations</h2>
                <p className="mt-0.5 text-[11px]" style={{ color: "var(--books-muted)" }}>
                  YAJ creates one picture for every page and keeps the same characters and art style throughout the book.
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={{ background: "var(--books-soft)", color: "var(--books-accent)" }}
              >
                {illustratedCount}/{illustratedPages.length || 0}
              </span>
            </div>

            <div className="mt-4">
              <Field label="Character & art guide (optional)">
                <textarea
                  value={artDirection}
                  onChange={(event) => setArtDirection(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border px-3 py-2 text-xs leading-relaxed outline-none"
                  style={{ borderColor: "var(--books-line)", background: "var(--books-soft)", color: "var(--books-ink)" }}
                  placeholder="Example: Maya is a 7-year-old Black girl with two puff ponytails, yellow overalls and red sneakers. Warm watercolor-cartoon style, sunny colors. Keep Maya looking the same on every page."
                />
              </Field>
              <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: "var(--books-muted)" }}>
                If you leave this blank, YAJ builds a shared style guide from your book title, description and story.
              </p>
            </div>

            <button
              type="button"
              disabled={generatingIllustrations || !illustratedPages.length || !title.trim() || !author.trim()}
              onClick={generateAllIllustrations}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-4 text-xs font-extrabold text-white shadow-sm disabled:opacity-50"
            >
              {generatingIllustrations ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="h-4 w-4" />
              )}
              {generatingIllustrations
                ? `Creating ${illustrationProgress.done}/${illustrationProgress.total}…`
                : illustratedCount === illustratedPages.length && illustratedPages.length > 0
                  ? "All page illustrations ready"
                  : `Create ${Math.max(0, illustratedPages.length - illustratedCount)} page illustration${illustratedPages.length - illustratedCount === 1 ? "" : "s"}`}
            </button>

            {illustratedPages.length > 0 && (
              <div className="mt-4 space-y-3">
                {illustratedPages.map((page, index) => {
                  const generatingThisPage = generatingPageIndex === index;
                  return (
                    <div
                      key={`kids-page-preview-${index}`}
                      className="overflow-hidden rounded-2xl border"
                      style={{ borderColor: "var(--books-line)", background: "var(--books-soft)" }}
                    >
                      <div className="flex gap-3 p-3">
                        <div className="relative aspect-[4/3] w-[7.5rem] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-orange-200 to-pink-200">
                          {page.image ? (
                            <img src={page.image} alt={`Page ${index + 1} illustration`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-bold text-orange-700/70">
                              {generatingThisPage ? "Creating…" : "Illustration not created yet"}
                            </div>
                          )}
                          {generatingThisPage && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-extrabold uppercase tracking-wide text-orange-600">
                            Page {index + 1}
                          </p>
                          <p className="mt-1 line-clamp-4 text-[11px] font-medium leading-relaxed" style={{ color: "var(--books-ink)" }}>
                            {page.text}
                          </p>
                          <button
                            type="button"
                            disabled={generatingIllustrations || generatingThisPage}
                            onClick={() => void generatePageIllustration(index)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-bold text-orange-600 shadow-sm disabled:opacity-50"
                          >
                            {generatingThisPage ? <Loader2 className="h-3 w-3 animate-spin" /> : <WandSparkles className="h-3 w-3" />}
                            {page.image ? "Regenerate" : "Create image"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

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
          disabled={
            publishing ||
            generatingIllustrations ||
            !title.trim() ||
            !author.trim() ||
            !pages.length ||
            (kids && !allKidsPagesIllustrated)
          }
          onClick={publish}
          className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold shadow-sm disabled:opacity-50"
          style={{ background: "var(--books-accent)", color: "var(--books-accent-ink)" }}
        >
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          {publishing
            ? "Publishing…"
            : kids && pages.length > 0 && !allKidsPagesIllustrated
              ? "Create all page illustrations first"
              : "Publish to YAJ Books"}
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
