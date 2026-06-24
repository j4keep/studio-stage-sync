/** WhatsApp-style SVG sticker packs — not device/unicode emojis. */

export type StickerPackId =
  | "trending"
  | "reactions"
  | "funny"
  | "music"
  | "sports"
  | "love"
  | "celebration"
  | "wheuat";

export interface StickerAsset {
  id: string;
  label: string;
  pack: StickerPackId;
  /** SVG data URI with transparent background */
  src: string;
  tags?: string[];
}

const svg = (body: string, viewBox = "0 0 128 128") =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`,
  )}`;

/** Cartoon sticker graphics — bold fills, sticker-style outlines */
export const STICKER_ASSETS: StickerAsset[] = [
  // Trending
  { id: "st-fire", label: "Fire", pack: "trending", tags: ["hot", "lit"], src: svg('<ellipse cx="64" cy="100" rx="28" ry="8" fill="#000" opacity=".15"/><path d="M64 18c-8 22-24 28-24 48 0 18 14 32 32 32s32-14 32-32c0-20-16-26-24-48-4 12-8 18-16 18s-12-6-16-18z" fill="#ff6b00" stroke="#1a1a1a" stroke-width="3"/><path d="M64 42c-4 10-12 14-12 26 0 10 8 18 18 18s18-8 18-18c0-12-8-16-12-26-2 6-4 10-8 10s-6-4-8-10z" fill="#ffd000" stroke="#1a1a1a" stroke-width="2"/>') },
  { id: "st-clap", label: "Clap", pack: "trending", tags: ["hands", "applause"], src: svg('<ellipse cx="64" cy="108" rx="30" ry="8" fill="#000" opacity=".12"/><path d="M36 72c0-8 4-16 12-20v-8c0-6 4-10 10-10s10 4 10 10v4c4-2 8-2 12 2 4 4 4 10 0 14l-8 8c-6 6-14 8-22 4l-14-14z" fill="#fde68a" stroke="#1a1a1a" stroke-width="3"/><path d="M92 72c0-8-4-16-12-20v-8c0-6-4-10-10-10s-10 4-10 10v4c-4-2-8-2-12 2-4 4-4 10 0 14l8 8c6 6 14 8 22 4l14-14z" fill="#fde68a" stroke="#1a1a1a" stroke-width="3"/><rect x="20" y="20" width="88" height="88" rx="44" fill="none" stroke="#a855f7" stroke-width="4" stroke-dasharray="8 6"/>') },
  { id: "st-laugh", label: "LOL", pack: "trending", tags: ["funny", "happy"], src: svg('<circle cx="64" cy="64" r="48" fill="#fde047" stroke="#1a1a1a" stroke-width="4"/><circle cx="48" cy="56" r="6" fill="#1a1a1a"/><circle cx="80" cy="56" r="6" fill="#1a1a1a"/><path d="M40 78 Q64 102 88 78" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/><path d="M36 48 Q48 40 52 48" fill="none" stroke="#1a1a1a" stroke-width="3"/><path d="M76 48 Q88 40 92 48" fill="none" stroke="#1a1a1a" stroke-width="3"/>') },
  { id: "st-trophy", label: "Trophy", pack: "trending", tags: ["win", "champion"], src: svg('<ellipse cx="64" cy="108" rx="26" ry="7" fill="#000" opacity=".15"/><path d="M44 28h40v12c0 16-8 24-20 28-12-4-20-12-20-28V28z" fill="#fbbf24" stroke="#1a1a1a" stroke-width="3"/><path d="M44 32H32c0 12 6 20 16 22M84 32h12c0 12-6 20-16 22" fill="none" stroke="#1a1a1a" stroke-width="3"/><rect x="52" y="68" width="24" height="10" fill="#b45309" stroke="#1a1a1a" stroke-width="2"/><rect x="46" y="78" width="36" height="10" rx="2" fill="#92400e" stroke="#1a1a1a" stroke-width="2"/>') },

  // Reactions
  { id: "st-heart", label: "Heart", pack: "reactions", tags: ["love"], src: svg('<path d="M64 108 C20 72 8 48 28 32 C44 20 64 36 64 36 C64 36 84 20 100 32 C120 48 108 72 64 108Z" fill="#ef4444" stroke="#1a1a1a" stroke-width="3"/><path d="M64 108 C20 72 8 48 28 32 C44 20 64 36 64 36" fill="none" stroke="#fff" stroke-width="2" opacity=".3"/>') },
  { id: "st-thumbs", label: "Thumbs Up", pack: "reactions", src: svg('<ellipse cx="64" cy="108" rx="28" ry="7" fill="#000" opacity=".12"/><path d="M48 88V52c0-8 6-14 14-14h4c6 0 10 4 10 10v8h14c8 0 12 8 8 16l-8 16H48z" fill="#fbbf24" stroke="#1a1a1a" stroke-width="3"/><rect x="36" y="52" width="14" height="36" rx="6" fill="#fde68a" stroke="#1a1a1a" stroke-width="3"/>') },
  { id: "st-shock", label: "Shocked", pack: "reactions", src: svg('<circle cx="64" cy="64" r="48" fill="#fef3c7" stroke="#1a1a1a" stroke-width="4"/><circle cx="48" cy="58" r="10" fill="#fff" stroke="#1a1a1a" stroke-width="2"/><circle cx="80" cy="58" r="10" fill="#fff" stroke="#1a1a1a" stroke-width="2"/><circle cx="48" cy="58" r="4" fill="#1a1a1a"/><circle cx="80" cy="58" r="4" fill="#1a1a1a"/><ellipse cx="64" cy="88" rx="10" ry="14" fill="#1a1a1a"/>') },
  { id: "st-cool", label: "Cool", pack: "reactions", src: svg('<circle cx="64" cy="64" r="48" fill="#fde047" stroke="#1a1a1a" stroke-width="4"/><rect x="32" y="52" width="64" height="16" rx="8" fill="#1a1a1a"/><rect x="38" y="56" width="22" height="8" rx="2" fill="#60a5fa" opacity=".8"/><rect x="68" y="56" width="22" height="8" rx="2" fill="#60a5fa" opacity=".8"/><path d="M44 84 Q64 94 84 84" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>') },

  // Funny
  { id: "st-ghost", label: "Ghost", pack: "funny", src: svg('<path d="M64 24c-24 0-36 20-36 44v36l12-10 8 10 8-10 8 10 8-10 8 10 8-10 8 10V68c0-24-12-44-36-44z" fill="#f8fafc" stroke="#1a1a1a" stroke-width="3"/><circle cx="52" cy="60" r="6" fill="#1a1a1a"/><circle cx="76" cy="60" r="6" fill="#1a1a1a"/><ellipse cx="64" cy="74" rx="8" ry="5" fill="#1a1a1a"/>') },
  { id: "st-alien", label: "Alien", pack: "funny", src: svg('<ellipse cx="64" cy="70" rx="40" ry="44" fill="#86efac" stroke="#1a1a1a" stroke-width="3"/><ellipse cx="48" cy="58" rx="12" ry="16" fill="#fff" stroke="#1a1a1a" stroke-width="2"/><ellipse cx="80" cy="58" rx="12" ry="16" fill="#fff" stroke="#1a1a1a" stroke-width="2"/><circle cx="48" cy="58" r="5" fill="#1a1a1a"/><circle cx="80" cy="58" r="5" fill="#1a1a1a"/><path d="M58 82h12" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>') },
  { id: "st-poop", label: "Poop", pack: "funny", src: svg('<ellipse cx="64" cy="108" rx="24" ry="6" fill="#000" opacity=".12"/><path d="M64 28c-12 0-20 10-20 22 0 8 4 14 10 18-6 4-10 10-10 18 0 14 10 22 20 22s20-8 20-22c0-8-4-14-10-18 6-4 10-10 10-18 0-12-8-22-20-22z" fill="#a16207" stroke="#1a1a1a" stroke-width="3"/><circle cx="54" cy="72" r="4" fill="#1a1a1a"/><circle cx="74" cy="72" r="4" fill="#1a1a1a"/>') },
  { id: "st-skull", label: "Skull", pack: "funny", src: svg('<circle cx="64" cy="56" r="36" fill="#f8fafc" stroke="#1a1a1a" stroke-width="3"/><circle cx="52" cy="52" r="8" fill="#1a1a1a"/><circle cx="76" cy="52" r="8" fill="#1a1a1a"/><path d="M48 72h32" stroke="#1a1a1a" stroke-width="3"/><path d="M52 72v12M60 72v12M68 72v12M76 72v12" stroke="#1a1a1a" stroke-width="3"/>') },

  // Music
  { id: "st-music-note", label: "Music Note", pack: "music", tags: ["sound", "song"], src: svg('<ellipse cx="64" cy="108" rx="26" ry="7" fill="#000" opacity=".12"/><circle cx="44" cy="88" r="16" fill="#a855f7" stroke="#1a1a1a" stroke-width="3"/><rect x="56" y="28" width="8" height="60" fill="#1a1a1a"/><path d="M64 28 L92 36 L92 52 L64 44" fill="#c084fc" stroke="#1a1a1a" stroke-width="2"/>') },
  { id: "st-mic", label: "Microphone", pack: "music", src: svg('<ellipse cx="64" cy="108" rx="22" ry="6" fill="#000" opacity=".12"/><rect x="54" y="32" width="20" height="44" rx="10" fill="#3b82f6" stroke="#1a1a1a" stroke-width="3"/><path d="M44 68c0 14 10 24 20 24s20-10 20-24" fill="none" stroke="#1a1a1a" stroke-width="3"/><line x1="64" y1="92" x2="64" y2="104" stroke="#1a1a1a" stroke-width="3"/><line x1="52" y1="104" x2="76" y2="104" stroke="#1a1a1a" stroke-width="3"/>') },
  { id: "st-dj", label: "DJ", pack: "music", src: svg('<circle cx="64" cy="64" r="44" fill="#1e1b4b" stroke="#a855f7" stroke-width="4"/><circle cx="64" cy="64" r="20" fill="#312e81" stroke="#c084fc" stroke-width="3"/><circle cx="64" cy="64" r="6" fill="#e879f9"/><text x="64" y="28" text-anchor="middle" fill="#e879f9" font-size="14" font-weight="bold">DJ</text>') },
  { id: "st-headphones", label: "Headphones", pack: "music", src: svg('<path d="M32 64c0-20 14-36 32-36s32 16 32 36" fill="none" stroke="#1a1a1a" stroke-width="6" stroke-linecap="round"/><rect x="24" y="64" width="18" height="28" rx="8" fill="#22d3ee" stroke="#1a1a1a" stroke-width="3"/><rect x="86" y="64" width="18" height="28" rx="8" fill="#22d3ee" stroke="#1a1a1a" stroke-width="3"/>') },

  // Sports
  { id: "st-ball", label: "Ball", pack: "sports", src: svg('<circle cx="64" cy="64" r="40" fill="#f97316" stroke="#1a1a1a" stroke-width="3"/><path d="M64 24v80M24 64h80" stroke="#1a1a1a" stroke-width="2" opacity=".4"/><path d="M36 36 Q64 64 92 36" fill="none" stroke="#1a1a1a" stroke-width="2" opacity=".4"/>') },
  { id: "st-flex", label: "Flex", pack: "sports", src: svg('<ellipse cx="64" cy="108" rx="28" ry="7" fill="#000" opacity=".12"/><path d="M36 88c8-20 20-32 28-32s20 12 28 32" fill="#fde68a" stroke="#1a1a1a" stroke-width="3"/><circle cx="64" cy="48" r="20" fill="#fde68a" stroke="#1a1a1a" stroke-width="3"/><path d="M48 88 L36 72 M80 88 L92 72" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>') },
  { id: "st-medal", label: "Medal", pack: "sports", src: svg('<path d="M44 24 L52 48 L64 36 L76 48 L84 24" fill="#ef4444" stroke="#1a1a1a" stroke-width="2"/><circle cx="64" cy="72" r="28" fill="#fbbf24" stroke="#1a1a1a" stroke-width="3"/><text x="64" y="80" text-anchor="middle" fill="#92400e" font-size="24" font-weight="bold">1</text>') },

  // Love
  { id: "st-love-eyes", label: "Love Eyes", pack: "love", src: svg('<circle cx="64" cy="64" r="48" fill="#fecdd3" stroke="#1a1a1a" stroke-width="4"/><path d="M40 56 C40 48 48 44 52 52 C44 44 36 48 36 56 C36 64 44 68 48 60 C44 68 40 64 40 56" fill="#ef4444" stroke="#1a1a1a" stroke-width="1"/><path d="M88 56 C88 48 80 44 76 52 C84 44 92 48 92 56 C92 64 84 68 80 60 C84 68 88 64 88 56" fill="#ef4444" stroke="#1a1a1a" stroke-width="1"/><path d="M44 84 Q64 98 84 84" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>') },
  { id: "st-kiss", label: "Kiss", pack: "love", src: svg('<circle cx="64" cy="64" r="48" fill="#fbcfe8" stroke="#1a1a1a" stroke-width="4"/><circle cx="48" cy="58" r="5" fill="#1a1a1a"/><path d="M72 58 Q80 58 80 66 Q80 74 72 70" fill="#ef4444" stroke="#1a1a1a" stroke-width="2"/><path d="M48 82 Q64 92 80 82" fill="none" stroke="#1a1a1a" stroke-width="3"/>') },
  { id: "st-ring", label: "Ring", pack: "love", src: svg('<ellipse cx="64" cy="108" rx="24" ry="6" fill="#000" opacity=".12"/><circle cx="64" cy="64" r="28" fill="none" stroke="#fbbf24" stroke-width="10"/><path d="M64 36 L72 20 L80 28 L64 36" fill="#e879f9" stroke="#1a1a1a" stroke-width="2"/>') },

  // Celebration
  { id: "st-party", label: "Party", pack: "celebration", src: svg('<polygon points="64,16 72,44 104,44 78,60 88,92 64,72 40,92 50,60 24,44 56,44" fill="#fbbf24" stroke="#1a1a1a" stroke-width="2"/><circle cx="32" cy="32" r="6" fill="#ef4444"/><circle cx="96" cy="28" r="5" fill="#3b82f6"/><circle cx="100" cy="72" r="4" fill="#22c55e"/>') },
  { id: "st-confetti", label: "Confetti", pack: "celebration", src: svg('<rect x="28" y="40" width="12" height="12" rx="2" fill="#ef4444" transform="rotate(20 34 46)"/><rect x="80" y="32" width="10" height="10" fill="#3b82f6" transform="rotate(-15 85 37)"/><circle cx="64" cy="48" r="6" fill="#fbbf24"/><rect x="48" y="72" width="14" height="6" rx="1" fill="#a855f7" transform="rotate(45 55 75)"/><circle cx="88" cy="68" r="5" fill="#22c55e"/><circle cx="40" cy="80" r="4" fill="#ec4899"/>') },
  { id: "st-star-burst", label: "Star", pack: "celebration", src: svg('<polygon points="64,12 76,48 116,48 84,68 96,108 64,84 32,108 44,68 12,48 52,48" fill="#fde047" stroke="#1a1a1a" stroke-width="3"/>') },

  // WHEUAT custom
  { id: "st-wheuat-crown", label: "WHEUAT Crown", pack: "wheuat", src: svg('<ellipse cx="64" cy="108" rx="30" ry="7" fill="#000" opacity=".12"/><path d="M24 72 L36 40 L52 56 L64 32 L76 56 L92 40 L104 72 Z" fill="#a855f7" stroke="#1a1a1a" stroke-width="3"/><rect x="24" y="72" width="80" height="16" rx="4" fill="#7c3aed" stroke="#1a1a1a" stroke-width="2"/><text x="64" y="84" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">WHEUAT</text>') },
  { id: "st-wheuat-mic", label: "WHEUAT Mic", pack: "wheuat", src: svg('<circle cx="64" cy="64" r="44" fill="#0ea5e9" stroke="#1a1a1a" stroke-width="3"/><rect x="56" y="36" width="16" height="32" rx="8" fill="#fff" stroke="#1a1a1a" stroke-width="2"/><text x="64" y="98" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">WHEUAT</text>') },
  { id: "st-wheuat-wave", label: "Sound Wave", pack: "wheuat", tags: ["music"], src: svg('<rect x="20" y="48" width="8" height="32" rx="4" fill="#22d3ee" stroke="#1a1a1a" stroke-width="2"/><rect x="36" y="36" width="8" height="56" rx="4" fill="#a855f7" stroke="#1a1a1a" stroke-width="2"/><rect x="52" y="28" width="8" height="72" rx="4" fill="#f472b6" stroke="#1a1a1a" stroke-width="2"/><rect x="68" y="36" width="8" height="56" rx="4" fill="#a855f7" stroke="#1a1a1a" stroke-width="2"/><rect x="84" y="48" width="8" height="32" rx="4" fill="#22d3ee" stroke="#1a1a1a" stroke-width="2"/>') },
  { id: "st-wheuat-vibe", label: "Vibe", pack: "wheuat", src: svg('<circle cx="64" cy="64" r="48" fill="#312e81" stroke="#a855f7" stroke-width="4"/><text x="64" y="58" text-anchor="middle" fill="#e879f9" font-size="22" font-weight="bold">VIBE</text><text x="64" y="82" text-anchor="middle" fill="#fff" font-size="10">WHEUAT</text>') },
];

const ASSET_MAP = new Map(STICKER_ASSETS.map((s) => [s.id, s]));

export function getStickerAsset(id: string): StickerAsset | undefined {
  return ASSET_MAP.get(id);
}

export function getStickerAssetSrc(id: string): string | undefined {
  return ASSET_MAP.get(id)?.src;
}
