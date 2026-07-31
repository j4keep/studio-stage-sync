import type { WellnessSkinTone } from "@/lib/wellness";

/** Target skin RGB for coach still remapping (matches dashboard swatches). */
export const COACH_SKIN_RGB: Record<WellnessSkinTone, [number, number, number]> = {
  porcelain: [230, 196, 168],
  warm: [201, 149, 108],
  medium: [168, 137, 108],
  rich: [139, 94, 60],
  deep: [92, 58, 36],
};

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

/**
 * Broad skin detector covering porcelain → deep tones.
 * Excludes near-white card backgrounds, teal/green shirts, and dark hair/shorts.
 */
export function isCoachSkinPixel(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  if (v < 0.18 || v > 0.96) return false;
  if (s < 0.08 || s > 0.78) return false;
  // Skin hue band (reds / oranges / warm browns); wrap near 0°.
  const warmHue = h <= 55 || h >= 340;
  if (!warmHue) return false;
  // Teal / cyan clothing (YAJ shirt, sneakers).
  if (g > r + 18 && b > r - 5) return false;
  // Prefer R-dominant warm pixels (typical skin).
  if (r < g - 8) return false;
  return true;
}

/**
 * Remap skin pixels toward `tone` while preserving relative shading.
 * Non-skin pixels (clothes, text, background) stay untouched.
 */
export function remapCoachSkinTone(
  imageData: ImageData,
  tone: WellnessSkinTone,
): ImageData {
  const [tr, tg, tb] = COACH_SKIN_RGB[tone] ?? COACH_SKIN_RGB.medium;
  const data = imageData.data;

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isCoachSkinPixel(r, g, b)) continue;
    sr += r;
    sg += g;
    sb += b;
    count += 1;
  }
  if (count < 40) return imageData;

  sr /= count;
  sg /= count;
  sb /= count;
  const scaleR = tr / Math.max(1, sr);
  const scaleG = tg / Math.max(1, sg);
  const scaleB = tb / Math.max(1, sb);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isCoachSkinPixel(r, g, b)) continue;
    data[i] = Math.min(255, Math.max(0, Math.round(r * scaleR)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g * scaleG)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(b * scaleB)));
  }

  return imageData;
}

/**
 * Load an image URL, remap skin to `tone`, return a blob object URL (caller must revoke).
 */
export async function tintCoachStill(
  src: string,
  tone: WellnessSkinTone,
): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  remapCoachSkinTone(imageData, tone);
  ctx.putImageData(imageData, 0, 0);
  return await new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("skin tint failed"));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/webp",
      0.92,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}
