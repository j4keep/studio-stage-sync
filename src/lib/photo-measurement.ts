export type ImagePoint = { x: number; y: number };
export type ImageDistanceMeasurement = {
  measuredLength: number;
  scaleUnitsPerPixel: number;
  referencePixels: number;
  targetPixels: number;
};

/** Points use normalized image coordinates [0,1], so calculations are
 * independent of the screen size. Reference and target must be in the same
 * flat plane and approximately the same distance from the camera.
 */
export function distance(a: ImagePoint, b: ImagePoint, aspectRatio = 1): number {
  return Math.hypot((a.x - b.x) * aspectRatio, a.y - b.y);
}

export function measureFromPhoto(
  points: ImagePoint[],
  referenceLength: number,
  aspectRatio = 1,
): ImageDistanceMeasurement | null {
  if (points.length !== 4 ||
      !Number.isFinite(referenceLength) || referenceLength <= 0 ||
      !Number.isFinite(aspectRatio) || aspectRatio <= 0 ||
      !points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) &&
        p.x >= 0 && p.y >= 0 && p.x <= 1 && p.y <= 1)) return null;
  const referencePixels = distance(points[0], points[1], aspectRatio);
  const targetPixels = distance(points[2], points[3], aspectRatio);
  if (referencePixels < 0.025 || targetPixels < 0.025) return null;
  const scaleUnitsPerPixel = referenceLength / referencePixels;
  return {
    measuredLength: Math.round(targetPixels * scaleUnitsPerPixel * 100) / 100,
    scaleUnitsPerPixel,
    referencePixels,
    targetPixels,
  };
}
