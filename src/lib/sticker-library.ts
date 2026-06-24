import {
  STICKER_ASSETS,
  getStickerAssetSrc,
  type StickerPackId,
} from "./sticker-assets";

export type StickerCategory =
  | "recent"
  | "trending"
  | "reactions"
  | "funny"
  | "music"
  | "sports"
  | "love"
  | "celebration"
  | "wheuat";

export interface StickerDef {
  id: string;
  label: string;
  src: string;
  pack: StickerPackId;
  tags?: string[];
}

export const STICKER_CATEGORIES: { id: StickerCategory; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "trending", label: "Trending" },
  { id: "reactions", label: "Reactions" },
  { id: "funny", label: "Funny" },
  { id: "music", label: "Music" },
  { id: "sports", label: "Sports" },
  { id: "love", label: "Love" },
  { id: "celebration", label: "Celebrate" },
  { id: "wheuat", label: "WHEUAT" },
];

export const STICKER_LIBRARY: StickerDef[] = STICKER_ASSETS.map((a) => ({
  id: a.id,
  label: a.label,
  src: a.src,
  pack: a.pack,
  tags: a.tags,
}));

const STICKER_MAP = new Map(STICKER_LIBRARY.map((s) => [s.id, s]));

export function getStickerSrc(id: string): string | undefined {
  return getStickerAssetSrc(id) ?? STICKER_MAP.get(id)?.src;
}

export function getStickersByCategory(
  category: StickerCategory,
  recentIds: string[],
  query = "",
): StickerDef[] {
  const q = query.trim().toLowerCase();
  let list: StickerDef[];

  if (category === "recent") {
    list = recentIds.map((id) => STICKER_MAP.get(id)).filter(Boolean) as StickerDef[];
  } else if (category === "trending") {
    list = STICKER_LIBRARY.filter((s) => s.pack === "trending" || s.pack === "celebration");
  } else if (category === "celebration") {
    list = STICKER_LIBRARY.filter((s) => s.pack === "celebration");
  } else {
    list = STICKER_LIBRARY.filter((s) => s.pack === category);
  }

  if (q) {
    list = list.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.id.includes(q) ||
        s.tags?.some((t) => t.includes(q)),
    );
  }
  return list;
}

/** Local smart suggestions — no AI API */
export function getSuggestedStickers(ctx: {
  mediaType: "image" | "video";
  hasMusic: boolean;
  caption?: string;
  /** Fake face detection — video uploads assumed to often include faces */
  likelyHasFace?: boolean;
}): StickerDef[] {
  const ids: string[] = [];

  if (ctx.hasMusic) {
    ids.push("st-music-note", "st-dj", "st-mic", "st-headphones", "st-wheuat-wave");
  }
  if (ctx.mediaType === "video" || ctx.likelyHasFace) {
    ids.push("st-wheuat-crown", "st-heart", "st-cool", "st-star-burst");
  }
  if (ctx.mediaType === "video") {
    ids.push("st-fire", "st-clap", "st-laugh", "st-trophy", "st-party");
  } else {
    ids.push("st-heart", "st-star-burst", "st-cool", "st-love-eyes");
  }
  if (ctx.caption?.match(/love|heart|bae/i)) {
    ids.unshift("st-heart", "st-kiss", "st-ring", "st-love-eyes");
  }
  if (ctx.caption?.match(/win|champ|goal/i)) {
    ids.unshift("st-trophy", "st-medal", "st-flex");
  }

  const unique = [...new Set(ids)];
  return unique
    .map((id) => STICKER_MAP.get(id))
    .filter(Boolean) as StickerDef[];
}

const RECENT_KEY = "wheuat_sticker_recent";

export function loadRecentStickers(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function pushRecentSticker(id: string): string[] {
  const prev = loadRecentStickers().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, 24);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}
