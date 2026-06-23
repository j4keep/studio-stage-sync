import type { PostEditorMeta } from "@/lib/post-editor";
import { getStickerSrc } from "@/lib/sticker-library";

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * (w / 400);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    stroke.points.forEach((p, i) => {
      const px = (p.x / 100) * w;
      const py = (p.y / 100) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  for (const s of meta.stickers) {
    const src = getStickerSrc(s.stickerId || s.emojiId || "");
    if (!src) continue;
    const stickerImg = await loadImage(src);
    const size = 80 * s.scale * (w / 400);
    const x = (s.x / 100) * w;
    const y = (s.y / 100) * h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((s.rotation ?? 0) * Math.PI) / 180);
    ctx.drawImage(stickerImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  for (const o of meta.overlays) {
    const fontSize = Math.round(32 * o.scale * (w / 400));
    ctx.save();
    ctx.translate((o.x / 100) * w, (o.y / 100) * h);
    ctx.rotate(((o.rotation ?? 0) * Math.PI) / 180);
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (o.style === "rounded") {
      const metrics = ctx.measureText(o.text);
      const pad = 12;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const rw = metrics.width + pad * 2;
      const rh = fontSize + pad;
      ctx.beginPath();
      ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 8);
      ctx.fill();
    }
    if (o.style === "outline") {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.strokeText(o.text, 0, 0);
      ctx.fillStyle = "#fff";
    } else if (o.style === "yellow") ctx.fillStyle = "#fde047";
    else if (o.style === "neon") {
      ctx.fillStyle = "#00a8ff";
      ctx.shadowColor = "#00a8ff";
      ctx.shadowBlur = 12;
    } else ctx.fillStyle = o.color || "#fff";
    ctx.fillText(o.text, 0, 0);
    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/jpeg", 0.92);
  });
}
