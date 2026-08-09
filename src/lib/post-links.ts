/**
 * Posts shared out of an app section (deals, events, marketplace, gigs…) carry the
 * source link inside the caption. This turns that link back into an in-app CTA so
 * viewers can tap through to the page the post came from.
 */
export type PostSourceLink = { path: string; label: string };

const RULES: { re: RegExp; label: string }[] = [
  { re: /\/deals\/(?!my|create|business)[\w-]+/, label: "View this deal" },
  { re: /\/events\/[\w-]+/, label: "View this event" },
  { re: /\/marketplace\/product\/[\w-]+/, label: "See it in the $1–$5 Store" },
  { re: /\/marketplace\/store\/[\w-]+/, label: "Visit this storefront" },
  { re: /\/marketplace\/listing\/[\w-]+/, label: "View this marketplace item" },
  { re: /\/marketplace\/five-under/, label: "Shop the $1–$5 Store" },
  { re: /\/marketplace(?:\/[\w-]+)?/, label: "Open Marketplace" },
  { re: /\/local-help\/pro\/[\w-]+/, label: "View this pro" },
  { re: /\/local-help(?:\/[\w-]+)?/, label: "Find local help" },
  { re: /\/gigs\/[\w-]+/, label: "View this gig" },
  { re: /\/gigs/, label: "Browse gigs" },
  { re: /\/jobs\/[\w-]+/, label: "View this opportunity" },
  { re: /\/jobs/, label: "Browse opportunities" },
  { re: /\/services\/[\w-]+/, label: "View this service" },
  { re: /\/wellness(?:\/[\w-]+)?/, label: "Open Wellness" },
  { re: /\/battle\/[\w-]+/, label: "Watch this battle" },
  { re: /\/games(?:\/[\w-]+\/[\w-]+)?/, label: "Play in YAJ Games" },
  { re: /\/artist\/[\w-]+/, label: "View this profile" },
];

/** Find the first in-app destination referenced by a caption, if any. */
export function detectPostSourceLink(caption?: string | null): PostSourceLink | null {
  if (!caption) return null;
  // Only consider our own origin's links (or bare paths) so external URLs stay external.
  const cleaned = caption.replace(new RegExp(escapeRe(window.location.origin), "g"), "");
  for (const rule of RULES) {
    const m = cleaned.match(rule.re);
    if (m) return { path: m[0], label: rule.label };
  }
  return null;
}

/** Strip the raw source URL out of the caption so the CTA replaces it visually. */
export function captionWithoutSourceLink(caption?: string | null): string {
  if (!caption) return "";
  return caption
    .replace(/https?:\/\/\S+/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
