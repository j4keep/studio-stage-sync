/** Flyer aspect ratio used by every deal card (16:10). */
export const DEAL_FLYER_ASPECT = 16 / 10;
const TARGET_W = 1600;
const TARGET_H = 1000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/**
 * Normalizes any uploaded flyer to the exact deal-card frame (1600x1000).
 * The image is scaled to cover and center-cropped, so cards never letterbox
 * or stretch regardless of what the business uploads.
 */
export async function normalizeDealFlyer(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const img = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Fill background first so transparent PNGs stay clean.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);

    const scale = Math.max(TARGET_W / img.width, TARGET_H / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (TARGET_W - w) / 2, (TARGET_H - h) / 2, w, h);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.92),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "flyer";
    return new File([blob], `${base}-flyer.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
