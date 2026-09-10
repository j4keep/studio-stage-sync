/**
 * Adult section cover art standard (match Harbor Lights / Stage Left /
 * Quiet Room / After the Bell reference set).
 *
 * When adding a new adult book cover:
 * 1. Use cinematic, photoreal digital art (not flat SVG gradients).
 * 2. Portrait ~2:3 (export ~900×1350 JPEG).
 * 3. Layout (centered text):
 *    - Title: large elegant serif, top third
 *    - Genre line: small all-caps “A … NOVELLA”
 *    - Tagline: small italic serif hook
 *    - Author: bottom, spaced all-caps
 * 4. Subtle left-edge spine shadow / book-like framing is OK.
 * 5. Mood lighting: strong directional light + atmospheric depth.
 * 6. Save as `src/assets/books/<slug>-cover.jpg` and set `coverImage` on the BookItem.
 * 7. Do NOT use placeholder CSS gradients as the primary adult cover when art exists.
 */
export const ADULT_COVER_SPEC = {
  width: 900,
  height: 1350,
  format: "jpg" as const,
  layout: ["title-serif", "genre-novella", "tagline-italic", "author-bottom"],
};
