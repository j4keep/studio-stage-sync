/**
 * Make “YAJ” speak as one word (“Yaj”), never letter-by-letter “Y.A.J.”
 * Use before any TTS / spoken playback.
 */
export function speakableYajText(text: string): string {
  return text
    .replace(/\bY\s*[\.\-–]?\s*A\s*[\.\-–]?\s*J\b/gi, "Yaj")
    .replace(/\bYAJ\b/g, "Yaj")
    .replace(/\bYaj Buddy\b/gi, "Yaj")
    .replace(/\bYAJ Buddy\b/g, "Yaj");
}

/** Short spoken name for intros. */
export const YAJ_SPOKEN_NAME = "Yaj";
