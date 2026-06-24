import type { PostEditorMeta, TextOverlayStyle } from "@/lib/post-editor";
import { getStickerSrc } from "@/lib/sticker-library";
import { normalizeTextStyle, strokeToSmoothPath } from "@/lib/post-editor";

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fontForStyle(style: TextOverlayStyle): string {
  const s = normalizeTextStyle(style);
  const map: Record<string, string> = {
    bubble: "bold 32px Fredoka, Arial Rounded MT Bold, sans-serif",
    neon: "bold 32px Inter, sans-serif",
    outline: "900 32px Inter, sans-serif",
    comic: "32px Bangers, Comic Sans MS, cursive",
    typewriter: "bold 28px Courier New, monospace",
    marker: "32px Permanent Marker, cursive",
    rounded: "600 30px Inter, sans-serif",
    graffiti: "32px Impact, sans-serif",
    handwritten: "bold 34px Caveat, Segoe Script, cursive",
    shadow3d: "900 32px Inter, sans-serif",
  };
  return map[s] ?? "bold 32px Inter, sans-serif";
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  o: PostEditorMeta["overlays"][0],
  w: number,
) {
  const fontSize = Math.round(32 * o.scale * (w / 400));
  const style = normalizeTextStyle(o.style);
  const color = o.color || "#ffffff";

  ctx.save();
  ctx.translate((o.x / 100) * w, (o.y / 100) * w * (ctx.canvas.height / w));
  ctx.rotate(((o.rotation ?? 0) * Math.PI) / 180);
  ctx.font = fontForStyle(style).replace("32px", `${fontSize}px`).replace("28px", `${fontSize}px`).replace("30px", `${fontSize}px`).replace("34px", `${fontSize}px`);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (style === "rounded") {
    const metrics = ctx.measureText(o.text);
    const pad = 14;
    const rw = metrics.width + pad * 2;
    const rh = fontSize + pad;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 10);
    ctx.fill();
  }

  if (style === "outline" || style === "bubble") {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = style === "bubble" ? 6 : 4;
    ctx.strokeText(o.text, 0, 0);
  }

  if (style === "neon") {
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
  } else if (style === "shadow3d") {
    ctx.fillStyle = color;
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 0;
    ctx.fillText(o.text, 3, 3);
    ctx.fillStyle = "#000";
    ctx.fillText(o.text, 5, 5);
    ctx.fillStyle = color;
  } else if (style === "comic") {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.strokeText(o.text, 0, 0);
  } else {
    ctx.fillStyle = color;
  }

  ctx.fillText(o.text, 0, 0);
  ctx.restore();
}

/** Bake all overlays + drawing into a single JPEG blob for image posts. */
export async function exportEditedImage(
  imageUrl: string,
  meta: PostEditorMeta,
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const scale = meta.crop?.scale ?? 1;
  const cx = (meta.crop?.x ?? 50) / 100;
  const cy = (meta.crop?.y ?? 50) / 100;
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (w - sw) * cx, (h - sh) * cy, sw, sh, 0, 0, w, h);

  for (const stroke of meta.drawings || []) {
    if (stroke.points.length < 2) continue;
    const pixelPts = stroke.points.map((p) => ({
      x: (p.x / 100) * w,
      y: (p.y / 100) * h,
    }));
    const d = strokeToSmoothPath(pixelPts);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * (w / 400);
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
    const size = 96 * s.scale * (w / 400);
    const x = (s.x / 100) * w;
    const y = (s.y / 100) * h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((s.rotation ?? 0) * Math.PI) / 180);
    ctx.drawImage(stickerImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  for (const o of meta.overlays) {
    drawTextOverlay(ctx, o, w);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/jpeg", 0.92);
  });
}
