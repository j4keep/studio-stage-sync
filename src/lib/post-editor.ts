/** Lightweight local-first post editor metadata (embedded in caption). */

export type TextOverlayStyle =
  | "bubble"
  | "neon"
  | "outline"
  | "comic"
  | "typewriter"
  | "marker"
  | "rounded"
  | "graffiti"
  | "handwritten"
  | "shadow3d"
  /** legacy aliases */
  | "white"
  | "yellow";

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
  /** Highlighter = semi-transparent wide stroke */
  highlighter?: boolean;
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

const LEGACY_STYLE_MAP: Record<string, TextOverlayStyle> = {
  white: "bubble",
  yellow: "marker",
};

export function normalizeTextStyle(style: TextOverlayStyle): TextOverlayStyle {
  return LEGACY_STYLE_MAP[style] ?? style;
}

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
    meta.overlays = (meta.overlays || []).map((o) => ({
      rotation: 0,
      ...o,
      style: normalizeTextStyle(o.style),
    }));
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

export const DRAW_COLORS = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#39ff14",
  "#eab308",
  "#ec4899",
  "#f97316",
];

export const BRUSH_PRESETS = [
  { id: "thin", label: "Thin", width: 2 },
  { id: "medium", label: "Med", width: 6 },
  { id: "thick", label: "Thick", width: 12 },
  { id: "marker", label: "Marker", width: 18 },
  { id: "highlighter", label: "Hi-Lite", width: 24, highlighter: true },
] as const;

/** Smooth polyline into SVG path (quadratic bezier midpoints) */
export function strokeToSmoothPath(points: DrawPoint[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/** Erase strokes near a point (radius in % coords) */
export function eraseStrokesNear(
  drawings: DrawStroke[],
  x: number,
  y: number,
  radius = 6,
): DrawStroke[] {
  return drawings.filter(
    (stroke) =>
      !stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) < radius),
  );
}
