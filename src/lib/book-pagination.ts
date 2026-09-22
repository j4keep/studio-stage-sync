import type { BookAudience, BookPage } from "@/lib/books-catalog";

/**
 * Build natural YAJ reader pages from prose.
 * Adult pages intentionally hold several paragraphs, similar to the built-in YAJ novellas.
 * Kids pages stay shorter for easier reading aloud.
 */
export function paginateBookManuscript(body: string, audience: BookAudience): BookPage[] {
  const target = audience === "kids" ? 650 : 1800;
  const max = audience === "kids" ? 900 : 2400;

  const paragraphs = body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  if (!paragraphs.length) return [];

  const pages: BookPage[] = [];
  let current: string[] = [];
  let currentLength = 0;

  const flush = () => {
    if (!current.length) return;
    pages.push({ text: current.join("\n\n").trim() });
    current = [];
    currentLength = 0;
  };

  const splitOversizedParagraph = (paragraph: string): string[] => {
    if (paragraph.length <= max) return [paragraph];

    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph];
    const chunks: string[] = [];
    let chunk = "";

    for (const sentenceRaw of sentences) {
      const sentence = sentenceRaw.trim();
      if (!sentence) continue;
      const next = chunk ? `${chunk} ${sentence}` : sentence;
      if (next.length > target && chunk) {
        chunks.push(chunk);
        chunk = sentence;
      } else {
        chunk = next;
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  };

  for (const paragraph of paragraphs) {
    for (const piece of splitOversizedParagraph(paragraph)) {
      const addition = (current.length ? 2 : 0) + piece.length;
      const wouldExceed = currentLength + addition > target;

      // Do not flush a nearly empty page just because the next paragraph is long.
      if (wouldExceed && currentLength >= Math.round(target * 0.55)) {
        flush();
      }

      current.push(piece);
      currentLength += (current.length > 1 ? 2 : 0) + piece.length;

      if (currentLength >= max) flush();
    }
  }

  flush();
  return pages;
}

/**
 * Compatibility repair for creator books that were published before the page packer
 * was fixed. If most stored pages are tiny, rebuild them into normal reading pages
 * at display time so old test books do not remain hundreds of one-line pages.
 */
export function normalizeCreatorBookPages(
  pages: BookPage[],
  audience: BookAudience,
): BookPage[] {
  if (!Array.isArray(pages) || pages.length === 0) return [];

  const tinyCount = pages.filter((p) => (p?.text || "").trim().length < 220).length;
  const looksOverPaginated =
    pages.length > 40 && tinyCount / pages.length >= 0.6;

  if (!looksOverPaginated) return pages;

  const reconstructed = pages
    .map((p) => (p?.text || "").trim())
    .filter(Boolean)
    .join("\n\n");

  return paginateBookManuscript(reconstructed, audience);
}
