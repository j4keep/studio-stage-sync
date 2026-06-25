/** Shared editor ↔ export coordinate mapping (object-cover full-screen preview). */

export const EDITOR_TEXT_BASE_PX = 24;
export const EDITOR_STICKER_BASE_PX = 64;
export const EDITOR_DRAW_STROKE_DIVISOR = 16;

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ObjectCoverRect {
  offsetX: number;
  offsetY: number;
  visibleW: number;
  visibleH: number;
  viewportW: number;
  viewportH: number;
}

/** Visible portion of the image when shown with object-cover in the editor viewport. */
export function getObjectCoverRect(
  imageW: number,
  imageH: number,
  viewportW: number,
  viewportH: number,
): ObjectCoverRect {
  const imageAR = imageW / imageH;
  const viewAR = viewportW / viewportH;
  if (imageAR > viewAR) {
    const visibleH = imageH;
    const visibleW = viewportW / (viewportH / imageH);
    return {
      offsetX: (imageW - visibleW) / 2,
      offsetY: 0,
      visibleW,
      visibleH,
      viewportW,
      viewportH,
    };
  }
  const visibleW = imageW;
  const visibleH = viewportH / (viewportW / imageW);
  return {
    offsetX: 0,
    offsetY: (imageH - visibleH) / 2,
    visibleW,
    visibleH,
    viewportW,
    viewportH,
  };
}

export function pctToImagePoint(
  xPct: number,
  yPct: number,
  imageW: number,
  imageH: number,
  viewport: ViewportSize,
) {
  const r = getObjectCoverRect(imageW, imageH, viewport.width, viewport.height);
  return {
    x: r.offsetX + (xPct / 100) * r.visibleW,
    y: r.offsetY + (yPct / 100) * r.visibleH,
    rect: r,
  };
}

/** Convert an on-screen pixel size in the editor to image pixel size. */
export function editorPxToImagePx(editorPx: number, rect: ObjectCoverRect): number {
  return editorPx * (rect.visibleW / rect.viewportW);
}

export function defaultExportViewport(): ViewportSize {
  if (typeof window !== "undefined" && window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
    };
  }
  if (typeof window !== "undefined") {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width: 390, height: 844 };
}
