import { EMOJI_CHARACTERS } from "@/lib/emoji-characters";

export type StickerCategory =
  | "recent"
  | "reactions"
  | "funny"
  | "sports"
  | "music"
  | "creator"
  | "wheuat";

export interface StickerDef {
  id: string;
  label: string;
  src: string;
  category: Exclude<StickerCategory, "recent">;
}

const CATEGORY_MAP: Record<string, StickerCategory> = {
  fire: "reactions", heart: "reactions", thumbsup: "reactions", laughcry: "reactions",
  shocked: "reactions", angry: "reactions", cool: "reactions", clap: "reactions",
  crown: "wheuat", trophy: "wheuat", star: "wheuat", mic: "wheuat", dj: "wheuat",
  music: "music", guitar: "music", vibing: "music", dance: "music",
  punch: "sports", flexed: "sports", lion: "sports", hundred: "sports",
  dragon: "funny", ghost: "funny", poop: "funny", alien: "funny", robot: "funny",
  skull: "funny", bomb: "funny", boom: "funny", mindblown: "funny",
  rocket: "creator", diamond: "creator", money: "creator", sparkles: "creator",
  lightning: "creator", tornado: "creator", eyes: "creator", queen: "creator",
};

export const STICKER_CATEGORIES: { id: StickerCategory; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "reactions", label: "Reactions" },
  { id: "funny", label: "Funny" },
  { id: "sports", label: "Sports" },
  { id: "music", label: "Music" },
  { id: "creator", label: "Creator" },
  { id: "wheuat", label: "WHEUAT" },
];

export const STICKER_LIBRARY: StickerDef[] = EMOJI_CHARACTERS.map((e) => ({
  id: e.id,
  label: e.label,
  src: e.src,
  category: (CATEGORY_MAP[e.id] ?? "reactions") as StickerDef["category"],
}));

const STICKER_MAP = new Map(STICKER_LIBRARY.map((s) => [s.id, s]));

export function getStickerSrc(id: string): string | undefined {
  return STICKER_MAP.get(id)?.src ?? STICKER_MAP.get(id.replace(/^emoji-/, ""))?.src;
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
  } else {
    list = STICKER_LIBRARY.filter((s) => s.category === category);
  }
  if (q) list = list.filter((s) => s.label.toLowerCase().includes(q) || s.id.includes(q));
  return list;
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
