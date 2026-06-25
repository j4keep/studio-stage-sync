/** Crop, rotate, and flip an image via canvas — used by the create-post crop editor. */

export interface CropRectPct {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type CropAspectKey = "original" | "free" | "3:4" | "9:16" | "1:1" | "4:3" | "16:9";

export const CROP_ASPECT_PRESETS: { key: CropAspectKey; label: string; ratio: number | null }[] = [
  { key: "original", label: "Original", ratio: null },
  { key: "free", label: "Freeform", ratio: null },
  { key: "3:4", label: "3:4", ratio: 3 / 4 },
  { key: "9:16", label: "9:16", ratio: 9 / 16 },
  { key: "1:1", label: "1:1", ratio: 1 },
  { key: "4:3", label: "4:3", ratio: 4 / 3 },
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
];

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function effectiveImageSize(iw: number, ih: number, rotation: number) {
  const rot = ((rotation % 360) + 360) % 360;
  if (rot === 90 || rot === 270) return { w: ih, h: iw };
  return { w: iw, h: ih };
}

export function imageFitRect(
  containerW: number,
  containerH: number,
  iw: number,
  ih: number,
  rotation: number,
) {
  const { w: effW, h: effH } = effectiveImageSize(iw, ih, rotation);
  const scale = Math.min(containerW / effW, containerH / effH);
  const dispW = effW * scale;
  const dispH = effH * scale;
  return {
    left: (containerW - dispW) / 2,
    top: (containerH - dispH) / 2,
    width: dispW,
    height: dispH,
    scale,
    effW,
    effH,
  };
}

export function fullCropRect(): CropRectPct {
  return { left: 0, top: 0, width: 100, height: 100 };
}

/** Largest crop rect with given aspect ratio, centered within 0–100 bounds. */
export function cropRectForAspect(
  aspect: number,
  imageAspect: number,
): CropRectPct {
  const boxAR = imageAspect;
  let w = 100;
  let h = 100;
  if (aspect > boxAR) {
    h = (100 * boxAR) / aspect;
  } else {
    w = (100 * aspect) / boxAR;
  }
  return {
    left: (100 - w) / 2,
    top: (100 - h) / 2,
    width: w,
    height: h,
  };
}

export function clampCropRect(rect: CropRectPct, minSize = 8): CropRectPct {
  const width = Math.max(minSize, Math.min(100, rect.width));
  const height = Math.max(minSize, Math.min(100, rect.height));
  let left = rect.left;
  let top = rect.top;
  left = Math.max(0, Math.min(100 - width, left));
  top = Math.max(0, Math.min(100 - height, top));
  return { left, top, width, height };
}

/** Apply crop + rotation + horizontal flip and return a JPEG blob. */
export async function applyImageCrop(
  imageUrl: string,
  crop: CropRectPct,
  rotation: number,
  flipH: boolean,
  maxSide = 4096,
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const rot = ((rotation % 360) + 360) % 360;
  const { w: cw, h: ch } = effectiveImageSize(iw, ih, rot);

  const stage = document.createElement("canvas");
  stage.width = cw;
  stage.height = ch;
  const sctx = stage.getContext("2d")!;

  sctx.translate(cw / 2, ch / 2);
  sctx.rotate((rot * Math.PI) / 180);
  sctx.scale(flipH ? -1 : 1, 1);
  sctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);

  const sx = (crop.left / 100) * cw;
  const sy = (crop.top / 100) * ch;
  const sw = (crop.width / 100) * cw;
  const sh = (crop.height / 100) * ch;

  let outW = Math.max(1, Math.round(sw));
  let outH = Math.max(1, Math.round(sh));
  const maxDim = Math.max(outW, outH);
  if (maxDim > maxSide) {
    const s = maxSide / maxDim;
    outW = Math.round(outW * s);
    outH = Math.round(outH * s);
  }

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d")!;
  octx.drawImage(stage, sx, sy, sw, sh, 0, 0, outW, outH);

  return new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop export failed"))), "image/jpeg", 0.92);
  });
}
