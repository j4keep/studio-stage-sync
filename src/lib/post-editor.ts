/** Lightweight local-first post editor metadata (embedded in caption). */

export type TextOverlayStyle = "white" | "outline" | "yellow" | "neon" | "rounded";

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  style: TextOverlayStyle;
  color?: string;
}

export interface StickerOverlay {
  id: string;
  stickerId: string;
  /** @deprecated use stickerId */
  emojiId?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  points: DrawPoint[];
  color: string;
  width: number;
}

export interface PostEditorMeta {
  overlays: TextOverlay[];
  stickers: StickerOverlay[];
  drawings: DrawStroke[];
  trim?: { start: number; end: number };
  crop?: { scale: number; x: number; y: number };
  muteOriginal?: boolean;
  originalVolume?: number;
  music?: { loopId?: string; fileName?: string; audioUrl?: string; volume: number };
  coverTime?: number;
  location?: string;
}

const META_MARKER = "\u200B<!--wheuat:";

export const defaultEditorMeta = (): PostEditorMeta => ({
  overlays: [],
  stickers: [],
  drawings: [],
  muteOriginal: false,
  originalVolume: 1,
});

export function encodeCaptionWithMeta(caption: string, meta: PostEditorMeta): string {
  const trimmed = caption.trim();
  const hasMeta =
    meta.overlays.length > 0 ||
    meta.stickers.length > 0 ||
    (meta.drawings?.length ?? 0) > 0 ||
    meta.trim ||
    meta.crop ||
    meta.muteOriginal ||
    (meta.originalVolume !== undefined && meta.originalVolume !== 1) ||
    meta.music ||
    meta.coverTime !== undefined ||
    meta.location;

  if (!hasMeta) return trimmed || "";
  return `${trimmed}${META_MARKER}${JSON.stringify(meta)}-->`;
}

export function parsePostCaption(raw: string | null | undefined): {
  caption: string;
  meta: PostEditorMeta | null;
} {
  if (!raw) return { caption: "", meta: null };
  const idx = raw.indexOf(META_MARKER);
  if (idx === -1) return { caption: raw, meta: null };
  const caption = raw.slice(0, idx).trim();
  const jsonPart = raw.slice(idx + META_MARKER.length);
  const end = jsonPart.lastIndexOf("-->");
  if (end === -1) return { caption: raw, meta: null };
  try {
    const meta = JSON.parse(jsonPart.slice(0, end)) as PostEditorMeta;
    if (!meta.drawings) meta.drawings = [];
    meta.overlays = (meta.overlays || []).map((o) => ({ rotation: 0, ...o }));
    meta.stickers = (meta.stickers || []).map((s) => ({
      rotation: 0,
      stickerId: s.stickerId || s.emojiId || "",
      ...s,
    }));
    return { caption, meta };
  } catch {
    return { caption: raw, meta: null };
  }
}

export const TEXT_STYLE_CLASSES: Record<TextOverlayStyle, string> = {
  white: "text-white font-bold",
  outline:
    "text-white font-bold [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]",
  yellow: "text-yellow-300 font-bold",
  neon: "text-primary font-bold drop-shadow-[0_0_8px_hsl(var(--primary))]",
  rounded: "text-white font-bold bg-black/55 px-3 py-1 rounded-xl",
};

export const DRAW_COLORS = ["#ffffff", "#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
