import type { PostEditorMeta, TextOverlayStyle } from "@/lib/post-editor";
import { getStickerSrc } from "@/lib/sticker-library";
import { normalizeTextStyle, strokeToSmoothPath } from "@/lib/post-editor";
import {
  EDITOR_DRAW_STROKE_DIVISOR,
  EDITOR_STICKER_BASE_PX,
  EDITOR_TEXT_BASE_PX,
  defaultExportViewport,
  getObjectCoverRect,
  pctToImagePoint,
  editorPxToImagePx,
  type ViewportSize,
} from "@/lib/overlay-coords";

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fontForStyle(style: TextOverlayStyle, fontSize: number): string {
  const s = normalizeTextStyle(style);
  const map: Record<string, string> = {
    bubble: `bold ${fontSize}px Inter, sans-serif`,
    neon: `bold ${fontSize}px Inter, sans-serif`,
    outline: `900 ${fontSize}px Inter, sans-serif`,
    comic: `${fontSize}px Bangers, Comic Sans MS, cursive`,
    typewriter: `bold ${fontSize}px Courier New, monospace`,
    marker: `${fontSize}px Permanent Marker, cursive`,
    rounded: `600 ${fontSize}px Inter, sans-serif`,
    graffiti: `${fontSize}px Impact, sans-serif`,
    handwritten: `bold ${fontSize}px Caveat, Segoe Script, cursive`,
    shadow3d: `900 ${fontSize}px Inter, sans-serif`,
  };
  return map[s] ?? `bold ${fontSize}px Inter, sans-serif`;
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  o: PostEditorMeta["overlays"][0],
  rect: ReturnType<typeof getObjectCoverRect>,
) {
  const { x, y } = pctToImagePoint(o.x, o.y, ctx.canvas.width, ctx.canvas.height, {
    width: rect.viewportW,
    height: rect.viewportH,
  });
  const fontSize = Math.round(editorPxToImagePx(EDITOR_TEXT_BASE_PX * o.scale, rect));
  const style = normalizeTextStyle(o.style);
  const color = o.color || "#ffffff";

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((o.rotation ?? 0) * Math.PI) / 180);
  ctx.font = fontForStyle(style, fontSize);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (style === "rounded") {
    const metrics = ctx.measureText(o.text);
    const pad = Math.round(fontSize * 0.35);
    const rw = metrics.width + pad * 2;
    const rh = fontSize + pad;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.roundRect(-rw / 2, -rh / 2, rw, rh, fontSize * 0.35);
    ctx.fill();
  }

  if (style === "outline" || style === "bubble") {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = style === "bubble" ? fontSize * 0.12 : fontSize * 0.08;
    ctx.strokeText(o.text, 0, 0);
  }

  if (style === "neon") {
    ctx.shadowColor = color;
    ctx.shadowBlur = fontSize * 0.45;
    ctx.fillStyle = color;
  } else if (style === "shadow3d") {
    ctx.fillStyle = color;
    ctx.fillText(o.text, fontSize * 0.06, fontSize * 0.06);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText(o.text, fontSize * 0.12, fontSize * 0.12);
    ctx.fillStyle = color;
  } else if (style === "comic") {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = Math.max(1, fontSize * 0.05);
    ctx.strokeText(o.text, 0, 0);
  } else {
    ctx.fillStyle = style === "rounded" && color === "#ffffff" ? "#1a1a1a" : color;
  }

  ctx.fillText(o.text, 0, 0);
  ctx.restore();
}

/** Bake all overlays + drawing into a single JPEG blob for image posts. */
export async function exportEditedImage(
  imageUrl: string,
  meta: PostEditorMeta,
  viewport: ViewportSize = defaultExportViewport(),
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const coverRect = getObjectCoverRect(w, h, viewport.width, viewport.height);

  const cropScale = meta.crop?.scale ?? 1;
  const cx = (meta.crop?.x ?? 50) / 100;
  const cy = (meta.crop?.y ?? 50) / 100;
  const sw = w / cropScale;
  const sh = h / cropScale;
  ctx.drawImage(img, (w - sw) * cx, (h - sh) * cy, sw, sh, 0, 0, w, h);

  for (const stroke of meta.drawings || []) {
    if (stroke.points.length < 2) continue;
    const pixelPts = stroke.points.map((p) => {
      const pt = pctToImagePoint(p.x, p.y, w, h, viewport);
      return { x: pt.x, y: pt.y };
    });
    const d = strokeToSmoothPath(pixelPts);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = editorPxToImagePx(
      (stroke.width / EDITOR_DRAW_STROKE_DIVISOR) * (viewport.width / 100),
      coverRect,
    );
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = stroke.highlighter ? 0.45 : 1;
    ctx.stroke(new Path2D(d));
    ctx.globalAlpha = 1;
  }

  for (const s of meta.stickers) {
    const src = getStickerSrc(s.stickerId || s.emojiId || "");
    if (!src) continue;
    const stickerImg = await loadImage(src);
    const size = editorPxToImagePx(EDITOR_STICKER_BASE_PX * s.scale, coverRect);
    const { x, y } = pctToImagePoint(s.x, s.y, w, h, viewport);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((s.rotation ?? 0) * Math.PI) / 180);
    ctx.drawImage(stickerImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  for (const o of meta.overlays) {
    drawTextOverlay(ctx, o, coverRect);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/jpeg", 0.92);
  });
}
